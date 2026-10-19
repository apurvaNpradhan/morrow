import type { TaskRow } from "@morrow/sync-schemas";
import { ListTree, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { parentChoices } from "../lib/picker-choices";
import { displayTicketId } from "../lib/task-links";
import { useTask } from "../queries/use-task-queries";
import type { TaskHit } from "../queries/use-task-search";
import { TaskPicker } from "./task-picker";
import { useTaskView } from "./task-view-context";

/**
 * The parent of a task, in the properties: its ticket id and title, or a
 * prompt. The picker offers the Project's tasks except the task itself and
 * those under it; the last row takes the parent away.
 */
export function TaskParentField({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { workspace, project, columnById, can, frozen } = useTaskView();
  const actions = useTaskActions();
  const parent = useTask(task.parentId ?? "");
  const [open, setOpen] = useState(false);
  const editable = can.edit && !frozen;

  // A snapshot of what is in memory, read when the popup opens.
  const local: TaskHit[] = (open ? taskCollection.toArray : [])
    .filter((row) => row.projectId === project.id && !row.archivedAt)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      ticketId: displayTicketId(project.key, row.number),
      title: row.title,
      category: columnById.get(row.columnId)?.category ?? "unstarted",
    }));

  function pick(parentId: string | null) {
    setOpen(false);
    void actions.setParent(task, parentId);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!editable}
        aria-label={t("parent.field")}
        data-sheet-field="parent"
        className={cn(
          "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-md border bg-control px-2 text-xs outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64",
          "@min-[720px]:h-8 @min-[720px]:w-full @min-[720px]:justify-start @min-[720px]:border-transparent @min-[720px]:bg-transparent @min-[720px]:text-sm @min-[720px]:hover:bg-accent",
          !parent && "text-muted-foreground",
        )}
      >
        <ListTree aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">
          {parent
            ? `${displayTicketId(project.key, parent.number)} ${parent.title}`
            : t("parent.set")}
        </span>
      </PopoverTrigger>
      <PopoverPopup>
        <div className="flex flex-col">
          <TaskPicker
            workspaceId={workspace.id}
            label={t("parent.field")}
            local={local}
            choose={(hits) =>
              parentChoices(hits, task, taskCollection.toArray).filter(
                (hit) => hit.id !== task.parentId,
              )
            }
            onPick={(hit) => pick(hit.id)}
          />
          {task.parentId ? (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => pick(null)}
            >
              <X aria-hidden="true" className="size-3.5" />
              {t("parent.remove")}
            </button>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
