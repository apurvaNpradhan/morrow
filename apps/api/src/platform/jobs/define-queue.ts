import { fromDrizzle } from "pg-boss";
import type { JobResult, PgBoss } from "pg-boss";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import * as Sentry from "@sentry/node";
import { db } from "#api/platform/database/index";
import { logFailure, runLoggedJob } from "#api/platform/logger";
import { bossForEnqueue } from "./boss";

/** A transaction, or `db` itself: anything that can run SQL for Drizzle. */
type Executor = Pick<typeof db, "execute">;

export type JobContext = {
  /** Failures so far; 0 on the first attempt. */
  retryCount: number;
  retryLimit: number;
  isFinalAttempt: boolean;
};

type QueueSettings = {
  /** Dedupes enqueues that carry the same `singletonKey` while one is still queued. */
  dedupe?: boolean;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
};

// Payloads hold only IDs, so finished jobs are cheap to keep for inspection.
const KEEP_FINISHED_SECONDS = 7 * 24 * 60 * 60;

type QueueDefinition<T extends object> = QueueSettings & {
  name: string;
  schema: z.ZodType<T>;
  /**
   * Throw to retry. Return to finish: a permanent failure, or a job whose
   * subject no longer exists, is not worth another attempt.
   */
  handler(data: T, context: JobContext): Promise<void>;
  /** Fields safe to log when the last attempt fails; defaults to none. */
  describe?(data: T): Record<string, string>;
};

export type JobQueue<T extends object = object> = {
  readonly name: string;
  /** Enqueues inside `tx` when given, so the job commits with the caller's write. */
  enqueue(
    data: T,
    options?: { tx?: Executor; singletonKey?: string },
  ): Promise<void>;
  /** Enqueues many jobs at once, with the same transaction rule. */
  enqueueMany(
    jobs: { data: T; singletonKey?: string }[],
    options?: { tx?: Executor },
  ): Promise<void>;
  /** Creates the queue and starts its worker. */
  work(boss: PgBoss): Promise<void>;
};

export function defineQueue<T extends object>(
  definition: QueueDefinition<T>,
): JobQueue<T> {
  const { name, schema, handler, describe, dedupe, ...overrides } = definition;
  const queueOptions = {
    policy: dedupe ? ("short" as const) : ("standard" as const),
    deleteAfterSeconds: KEEP_FINISHED_SECONDS,
    // The same retry policy for every queue unless one says otherwise.
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    ...overrides,
  };
  let created: Promise<void> | undefined;
  const ensureQueue = (boss: PgBoss) =>
    (created ??= boss.createQueue(name, queueOptions).catch((error) => {
      created = undefined;
      throw error;
    }));

  return {
    name,
    async enqueue(data, options = {}) {
      const boss = await bossForEnqueue();
      await ensureQueue(boss);
      await boss.send(name, schema.parse(data), {
        singletonKey: options.singletonKey,
        ...(options.tx ? { db: fromDrizzle(options.tx, sql) } : {}),
      });
    },
    async enqueueMany(jobs, options = {}) {
      if (jobs.length === 0) return;
      const boss = await bossForEnqueue();
      await ensureQueue(boss);
      await boss.insert(
        name,
        jobs.map((job) => ({
          data: schema.parse(job.data),
          singletonKey: job.singletonKey,
        })),
        options.tx ? { db: fromDrizzle(options.tx, sql) } : {},
      );
    },
    async work(boss) {
      await ensureQueue(boss);
      // Batches keep throughput up (a single job per poll would drain one every
      // 2s), and per-job results stop one failure from re-running its siblings.
      await boss.work(
        name,
        { includeMetadata: true, perJobResults: true, batchSize: 10 },
        (jobs) =>
          Promise.all(
            jobs.map(async (job): Promise<JobResult> => {
              const parsed = schema.safeParse(job.data);
              if (!parsed.success) {
                // Retrying cannot repair a payload that fails its schema.
                logFailure("jobs.invalid-payload", { queue: name });
                return { id: job.id, status: "completed" };
              }
              const context: JobContext = {
                retryCount: job.retryCount,
                retryLimit: job.retryLimit,
                isFinalAttempt: job.retryCount >= job.retryLimit,
              };
              try {
                await runLoggedJob(name, () => handler(parsed.data, context));
                return { id: job.id, status: "completed" };
              } catch (error) {
                if (context.isFinalAttempt) {
                  reportFinalFailure(name, describe?.(parsed.data), error);
                }
                return { id: job.id, status: "failed" };
              }
            }),
          ),
      );
    },
  };
}

function reportFinalFailure(
  queue: string,
  fields: Record<string, string> | undefined,
  error: unknown,
) {
  // Provider errors can carry addresses or tokens, so only the name and code are logged.
  const failure = error as { name?: string; code?: string } | null;
  logFailure("jobs.exhausted", {
    queue,
    ...fields,
    errorName: failure?.name,
    code: failure?.code,
  });
  Sentry.captureMessage(`Job exhausted its retries: ${queue}`, "error");
}
