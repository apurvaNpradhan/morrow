import type { TaskRow } from "@morrow/sync-schemas";
import type { PublishedView } from "./view-order-store";

const STEPS = {
  ArrowUp: { lane: false, delta: -1 },
  ArrowDown: { lane: false, delta: 1 },
  ArrowLeft: { lane: true, delta: -1 },
  ArrowRight: { lane: true, delta: 1 },
} as const;

/**
 * The task an arrow key moves to from `taskId`, or undefined when it does not
 * move. In the list, up and down walk the rows. On the board, up and down walk
 * a lane, and left and right go to the neighbouring lane at the same height
 * (or its last card), skipping lanes with no tasks.
 */
export function arrowTarget(
  { tasks, lanes }: Pick<PublishedView, "tasks" | "lanes">,
  key: string,
  taskId: string,
): TaskRow | undefined {
  if (!(key in STEPS)) return undefined;
  const step = STEPS[key as keyof typeof STEPS];

  if (!lanes) {
    if (step.lane) return undefined;
    const at = tasks.findIndex((task) => task.id === taskId);
    return at === -1 ? undefined : tasks[at + step.delta];
  }

  const laneAt = lanes.findIndex((lane) =>
    lane.some((task) => task.id === taskId),
  );
  if (laneAt === -1) return undefined;
  const lane = lanes[laneAt]!;
  const height = lane.findIndex((task) => task.id === taskId);
  if (!step.lane) return lane[height + step.delta];

  for (let at = laneAt + step.delta; lanes[at]; at += step.delta) {
    const cards = lanes[at]!;
    const target = cards[Math.min(height, cards.length - 1)];
    if (target) return target;
  }
  return undefined;
}
