import { TASK_DESCRIPTION_MAX, type TaskRow } from "@morrow/sync-schemas";
import { Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setActiveTaskId } from "../lib/active-task-store";
import { useTaskActions } from "../actions/use-task-actions";
import { useDescriptionAutosave } from "../actions/use-description-autosave";
import { useTaskDescription } from "../queries/use-task-queries";
import { updateTask } from "../actions/task-actions";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { PageTitle } from "@/design-system/page-title";
import { toast } from "@/design-system/toast";
import { Textarea } from "@/design-system/ui/textarea";
import { TaskDescriptionEditor } from "./task-description-editor";
import { TaskLinks } from "./task-links";
import { TaskParentLink } from "./task-parent-link";
import { TaskAttachments } from "./task-attachments";
import { TaskRelations } from "./task-relations";
import { TaskSubtasks } from "./task-subtasks";
import { TaskProperties } from "./task-properties";
import { TaskTimeline } from "./task-timeline";
import { displayTicketId } from "../lib/task-links";
import { useTaskView } from "./task-view-context";

/**
 * A task's title, description and timeline, with its properties in a right rail
 * when the container is wide and as a chip row above when it is narrow, so the
 * sheet and the full page are one view. Everything is read-only for a viewer
 * and in an archived Project; an archived task is editable and says so.
 */
export function TaskDetails({
  task,
  fullPage = false,
}: {
  task: TaskRow;
  /** The task page centres its content; the scrollbar stays at the screen edge. */
  fullPage?: boolean;
}) {
  const { t } = useTranslation("tasks");
  const { can, frozen, project, workspace } = useTaskView();
  const actions = useTaskActions();
  const saveDescription = useDescriptionAutosave(task.id);
  const description = useTaskDescription(task.id);
  const editable = can.edit && !frozen;
  const [title, setTitle] = useState(task.title);
  // The title shown follows the task unless it is being typed in.
  const [editingTitle, setEditingTitle] = useState(false);
  const shownTitle = editingTitle ? title : task.title;

  // The task commands act on the task that is open.
  useEffect(() => {
    setActiveTaskId(task.id);
    return () => setActiveTaskId(null);
  }, [task.id]);

  async function commitTitle() {
    setEditingTitle(false);
    const next = title.replace(/[\r\n]+/g, " ").trim();
    if (next === "" || next === task.title) return;
    try {
      await updateTask(task.id, { title: next });
    } catch (error) {
      toast.error(errorMessage(t, error, t("errors.generic")));
    }
  }

  return (
    <>
      <PageTitle
        title={`${displayTicketId(project.key, task.number)} ${task.title} · ${project.name}`}
      />
      {task.archivedAt ? (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Archive aria-hidden="true" className="size-3.5" />
          <span className="flex-1">{t("sheet.archivedBanner")}</span>
          {editable ? (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void actions.unarchive(task)}
            >
              {t("menu.unarchive")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="@container min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            "flex flex-col gap-6 p-4 @min-[720px]:flex-row",
            fullPage && "mx-auto w-full max-w-5xl",
          )}
        >
          <div className="order-2 min-w-0 flex-1 space-y-4 @min-[720px]:order-1">
            <TaskParentLink task={task} />
            <Textarea
              unstyled
              rows={1}
              aria-label={t("sheet.titleLabel")}
              readOnly={!editable}
              maxLength={500}
              className="w-full resize-none bg-transparent font-heading text-xl font-semibold outline-none"
              value={shownTitle}
              onFocus={() => {
                setTitle(task.title);
                setEditingTitle(true);
              }}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            />
            {description === undefined ? (
              <div className="min-h-40" aria-busy="true" />
            ) : (
              <TaskDescriptionEditor
                label={t("sheet.descriptionLabel")}
                placeholder={
                  editable ? t("sheet.descriptionPlaceholder") : undefined
                }
                value={description}
                editable={editable}
                onChange={(markdown) => saveDescription(markdown)}
                className="min-h-40"
                limit={TASK_DESCRIPTION_MAX}
                workspaceId={workspace.id}
              />
            )}
            <TaskSubtasks task={task} />
            <TaskRelations task={task} />
            <TaskAttachments task={task} />
            <TaskLinks task={task} />
            <TaskTimeline task={task} />
          </div>
          <aside
            aria-label={t("sheet.properties")}
            className="order-1 shrink-0 @min-[720px]:order-2 @min-[720px]:w-56"
          >
            <TaskProperties task={task} />
          </aside>
        </div>
      </div>
    </>
  );
}
