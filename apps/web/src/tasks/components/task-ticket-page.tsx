import { parseTicketId } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { ProjectNotFound } from "@/projects";
import { TaskPage } from "./task-page";

/**
 * A task's own address, `/<workspace>/tasks/MOR-12`, opened cold: the task on
 * its own page. An address that is not a ticket id, or names a Project that is
 * not here, says "not found".
 */
export function TaskTicketPage({
  workspace,
  ticketId,
}: {
  workspace: { id: string; slug: string };
  ticketId: string;
}) {
  const { t } = useTranslation("projects");
  const ticket = parseTicketId(ticketId);

  if (!ticket) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }
  return (
    <TaskPage
      workspace={workspace}
      projectKey={ticket.key}
      number={ticket.number}
    />
  );
}
