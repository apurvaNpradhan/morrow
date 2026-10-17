import type { TaskRow } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  Expand,
  Link2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuHint } from "@/design-system/tooltip-label";
import { Button } from "@/design-system/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { useTaskActions } from "../actions/use-task-actions";
import { displayTicketId, taskUrl } from "../lib/task-links";
import { TaskCopyItems } from "./task-copy-items";
import { requestDeleteTask } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";

/**
 * The buttons at the end of a task's header, in the sheet and on the full
 * page: copy the link, open the full page (from the sheet), and a menu with the
 * other ways to share, archive or delete the task.
 */
export function TaskHeaderActions({
  task,
  fullPage = false,
}: {
  task: TaskRow;
  /** Already on the full page: no button to open it. */
  fullPage?: boolean;
}) {
  const { t } = useTranslation("tasks");
  const { workspace, project, can, frozen } = useTaskView();
  const actions = useTaskActions();
  const navigate = useNavigate();
  const ticket = displayTicketId(project.key, task.number);
  const url = taskUrl(workspace.slug, project.key, task.number);
  const editable = can.edit && !frozen;

  return (
    <>
      {fullPage ? null : (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("menu.openFullPage")}
          onClick={() =>
            void navigate({
              to: "/$slug/tasks/$ticketId",
              params: { slug: workspace.slug, ticketId: ticket },
            })
          }
        >
          <Expand aria-hidden="true" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("menu.copyLink")}
        onClick={() => void actions.copy(url)}
      >
        <Link2 aria-hidden="true" />
      </Button>
      <Menu>
        <MenuTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          aria-label={t("sheet.more")}
        >
          <Ellipsis aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48">
          <TaskCopyItems task={task} />
          {editable ? (
            <>
              <MenuSeparator />
              {task.archivedAt ? (
                <MenuItem onClick={() => void actions.unarchive(task)}>
                  <ArchiveRestore aria-hidden="true" />
                  {t("menu.unarchive")}
                </MenuItem>
              ) : (
                <MenuItem onClick={() => void actions.archive(task)}>
                  <Archive aria-hidden="true" />
                  {t("menu.archive")}
                </MenuItem>
              )}
            </>
          ) : null}
          {can.delete && !frozen ? (
            <MenuItem
              variant="destructive"
              onClick={() => requestDeleteTask(task)}
            >
              <Trash2 aria-hidden="true" />
              {t("menu.delete")}
              <MenuHint hotkeyId="deleteTask" />
            </MenuItem>
          ) : null}
        </MenuPopup>
      </Menu>
    </>
  );
}
