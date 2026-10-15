import { parseTicketId } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";
import { ProjectNotFound } from "@/projects";
import { ProjectTasksPage } from "./project-tasks-page";

/**
 * A task's own address, `/<workspace>/tasks/MOR-12`, opened cold: its Project's
 * board or list (whichever this device last used) with the task in the sheet.
 * An address that is not a ticket id, or names a Project that is not here,
 * says "not found".
 */
export function TaskTicketPage({
  workspace,
  ticketId,
}: {
  workspace: { id: string; slug: string };
  ticketId: string;
}) {
  const { t } = useTranslation("projects");
  const { taskView } = useDevicePreferences();
  const ticket = parseTicketId(ticketId);

  if (!ticket) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }
  return (
    <ProjectTasksPage
      workspace={workspace}
      projectKey={ticket.key}
      layout={taskView}
      route="task"
      ticketNumber={ticket.number}
    />
  );
}
