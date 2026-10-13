import { logFailure } from "#api/platform/logger";
import { startBoss, stopBoss } from "./boss";
import { startCrons } from "./crons";
import { queues } from "./queues";

const removedQueuePrefixes = ["notification."];

/** Drops stored queues of verticals that no longer exist, with any jobs waiting in them. */
async function dropRemovedQueues(boss: Awaited<ReturnType<typeof startBoss>>) {
  try {
    for (const { name } of await boss.getQueues()) {
      if (removedQueuePrefixes.some((prefix) => name.startsWith(prefix))) {
        await boss.deleteQueue(name);
      }
    }
  } catch (error) {
    logFailure("jobs.drop-removed-queues", {}, error);
  }
}

let working: Promise<void> | undefined;

/** Starts pg-boss, every queue's worker and the schedules. Safe to call twice. */
export function startJobs(): Promise<void> {
  working ??= (async () => {
    const boss = await startBoss();
    await dropRemovedQueues(boss);
    for (const queue of queues) await queue.work(boss);
    await startCrons(boss);
  })();
  working.catch(() => {
    working = undefined;
  });
  return working;
}

export async function stopJobs(timeoutMs?: number): Promise<void> {
  working = undefined;
  await stopBoss(timeoutMs);
}
