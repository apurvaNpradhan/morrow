type Node = { id: string; parentId: string | null; number: number };

/**
 * The tasks parent first, then depth first: roots (tasks whose parent is not in
 * the list) by `rank`, then by number, and each task's children by number. A
 * moved group takes new Ticket numbers in this order, so the ids read like the
 * tree.
 */
export function treeOrder<Task extends Node>(
  tasks: readonly Task[],
  rank: (task: Task) => number,
): Task[] {
  const ids = new Set(tasks.map((task) => task.id));
  const byNumber = (a: Task, b: Task) => a.number - b.number;
  const children = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) {
      children.set(task.parentId, [
        ...(children.get(task.parentId) ?? []),
        task,
      ]);
    } else roots.push(task);
  }
  roots.sort((a, b) => rank(a) - rank(b) || byNumber(a, b));

  const ordered: Task[] = [];
  const pending = [...roots].reverse();
  while (pending.length > 0) {
    const task = pending.pop()!;
    ordered.push(task);
    pending.push(
      ...[...(children.get(task.id) ?? [])].sort(byNumber).reverse(),
    );
  }
  return ordered;
}
