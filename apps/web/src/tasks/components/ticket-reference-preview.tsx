import type { TaskRow } from "@morrow/sync-schemas";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useTranslation } from "react-i18next";
import { workspaceMemberUserCollection } from "@/members";
import { useProjectColumnsWithoutSuspense } from "@/projects";
import { PersonAvatar } from "./person-avatar";

/** The assignee's account, undefined when nobody is assigned or it has not synced. */
function useAssignee(assigneeId: string | null) {
  const { data } = useLiveQuery({
    query: (q) =>
      assigneeId
        ? q
            .from({ user: workspaceMemberUserCollection })
            .where(({ user }) => eq(user.id, assigneeId))
        : undefined,
  });
  return data?.[0];
}

/** What a hover over a ticket reference shows: the title, Column and assignee. */
export function TicketReferencePreview({
  task,
  ticketId,
}: {
  task: TaskRow;
  ticketId: string;
}) {
  const { t } = useTranslation("tasks");
  const columns = useProjectColumnsWithoutSuspense(task.projectId);
  const column = columns.find((candidate) => candidate.id === task.columnId);
  const assignee = useAssignee(task.assigneeId);

  return (
    <div className="grid w-full gap-2 p-3 text-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{ticketId}</span>
        {column ? <span>{column.name}</span> : null}
      </div>
      <p className="font-medium leading-snug">{task.title}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {assignee ? <PersonAvatar person={assignee} /> : null}
        <span>{assignee ? assignee.name : t("assignee.unassigned")}</span>
      </div>
    </div>
  );
}
