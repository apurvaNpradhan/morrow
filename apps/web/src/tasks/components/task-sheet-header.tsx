import type { TaskRow } from "@morrow/sync-schemas";
import { taskDescriptionCollection } from "../collections/task-description-collection";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Ellipsis,
  Link2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { ProjectIcon } from "@/projects";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { SheetTitle } from "@/design-system/ui/sheet";
import { useTaskActions } from "../actions/use-task-actions";
import { displayTicketId, taskUrl } from "../lib/task-links";
import { taskAsMarkdown } from "../lib/task-markdown";
import { requestDeleteTask } from "./delete-task-dialog";
import { useTaskView } from "./task-view-context";

/**
 * The sheet's top row: the Project and ticket id (click to copy it), a button
 * that copies the link, and a menu with the other ways to share, archive or
 * delete the task. The sheet's own close button sits at the far end.
 */
export function TaskSheetHeader({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { workspace, project, can, frozen } = useTaskView();
  const actions = useTaskActions();
  const ticket = displayTicketId(project.key, task.number);
  const url = taskUrl(workspace.slug, project.key, task.number);
  const editable = can.edit && !frozen;

  return (
    <div className="flex items-center gap-1 border-b px-4 py-2 pe-14">
      <SheetTitle className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-normal">
        <ProjectIcon
          project={project}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="truncate text-muted-foreground">{project.name}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ›
        </span>
        <button
          type="button"
          title={t("sheet.copyId")}
          aria-label={t("sheet.copyIdLabel", { id: ticket })}
          className="rounded-sm px-1 font-mono text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void actions.copy(ticket)}
        >
          {ticket}
        </button>
      </SheetTitle>
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
          <MenuItem onClick={() => void actions.copy(ticket)}>
            <Copy aria-hidden="true" />
            {t("sheet.copyIdItem")}
          </MenuItem>
          <MenuItem onClick={() => void actions.copy(task.title)}>
            <Copy aria-hidden="true" />
            {t("sheet.copyTitle")}
          </MenuItem>
          <MenuItem
            onClick={() =>
              void actions.copy(
                taskAsMarkdown({
                  ticket,
                  title: task.title,
                  url,
                  description:
                    taskDescriptionCollection.get(task.id)?.description ?? "",
                }),
              )
            }
          >
            <Copy aria-hidden="true" />
            {t("sheet.copyMarkdown")}
          </MenuItem>
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
            </MenuItem>
          ) : null}
        </MenuPopup>
      </Menu>
    </div>
  );
}
