import { storageQueues } from "#api/storage/index";
import type { JobQueue } from "./define-queue";

/** One of the static lists a vertical joins the app through: every queue with a worker. */
export const queues: JobQueue<never>[] = [...storageQueues];
