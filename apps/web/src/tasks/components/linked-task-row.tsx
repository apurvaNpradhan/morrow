import type { ProjectColumnRow, TaskRow } from "@morrow/sync-schemas";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ColumnMarker } from "./column-marker";
import { PersonAvatar } from "./person-avatar";
import { useTaskView } from "./task-view-context";

/**
 * A task the open task points at, in a section of the sheet: ticket id, title
 * and Column, and its Assignee when it is one of this Project's. A task of this
 * Project opens in place; one of another Project goes to its own page.
 * `trailing` holds the row's action, outside the link. `compact` leaves out the
 * ticket id and Assignee, for the properties rail.
 */
export function LinkedTaskRow({
  task,
  ticketId,
  column,
  trailing,
  compact = false,
}: {
  task: TaskRow;
  ticketId: string;
  column: ProjectColumnRow | undefined;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const view = useTaskView();
  const assignee = task.assigneeId
    ? view.personById.get(task.assigneeId)
    : undefined;
  const className =
    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      {column ? <ColumnMarker column={column} /> : <span className="size-4" />}
      {compact ? null : (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {ticketId}
        </span>
      )}
      <span className="truncate">{task.title}</span>
      {assignee && !compact ? (
        <PersonAvatar person={assignee} className="ms-auto shrink-0" />
      ) : null}
    </>
  );

  return (
    <li className="group flex items-center gap-1 rounded-md hover:bg-accent/40">
      {task.projectId === view.project.id ? (
        <button
          type="button"
          className={className}
          onClick={() => view.openTask(task)}
        >
          {content}
        </button>
      ) : (
        <Link
          to="/$slug/tasks/$ticketId"
          params={{ slug: view.workspace.slug, ticketId }}
          className={className}
        >
          {content}
        </Link>
      )}
      {trailing}
    </li>
  );
}
