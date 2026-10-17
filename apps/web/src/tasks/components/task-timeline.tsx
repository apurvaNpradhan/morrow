import type { TaskRow } from "@morrow/sync-schemas";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildTimeline } from "../lib/timeline";
import { useTaskComments, useTaskEvents } from "../queries/use-task-queries";
import { CommentComposer } from "./comment-composer";
import { TaskComment } from "./task-comment";
import { TaskEventLine } from "./task-event-line";
import { useTaskView } from "./task-view-context";

/**
 * A task's story, oldest first: what was said and what changed, with the box
 * to say more at the bottom. Everyone who can see a task can comment on it,
 * Viewers included; only an archived Project is read-only.
 */
export function TaskTimeline({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { can, frozen } = useTaskView();
  const comments = useTaskComments(task.id);
  const events = useTaskEvents(task.id);
  const items = useMemo(
    () => buildTimeline(comments, events),
    [comments, events],
  );
  // Folded runs the reader opened, by the id of their first entry.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  return (
    <section aria-label={t("comments.timeline")} className="space-y-3">
      <h2 className="text-xs font-medium text-muted-foreground">
        {t("comments.title")}
      </h2>
      {items.length > 0 ? (
        <ol className="space-y-3">
          {items.map((item) => {
            if (item.kind === "comment") {
              return (
                <TaskComment key={item.comment.id} comment={item.comment} />
              );
            }
            if (item.kind === "event") {
              return (
                <TaskEventLine key={item.event.row.id} entry={item.event} />
              );
            }
            const first = item.events[0]!.row.id;
            return opened.has(first) ? (
              item.events.map((entry) => (
                <TaskEventLine key={entry.row.id} entry={entry} />
              ))
            ) : (
              <li key={first}>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setOpened(new Set([...opened, first]))}
                >
                  {t("history.more", { count: item.events.length })}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {can.comment && !frozen ? <CommentComposer task={task} /> : null}
    </section>
  );
}
