import { MAX_MOVE_TASKS, type ProjectRow } from "@morrow/sync-schemas";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Checkbox } from "@/design-system/ui/checkbox";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/design-system/ui/command";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Label } from "@/design-system/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import {
  ProjectIcon,
  useProjectColumnsWithoutSuspense,
  useProjectFieldsWithoutSuspense,
  useProjectsWithoutSuspense,
} from "@/projects";
import { useMoveTasks } from "../actions/use-move-tasks";
import {
  backToProjects,
  chooseMoveProject,
  closeMove,
  useMove,
} from "../lib/move-store";
import { needsNoConfirmation, planMove } from "../lib/move-plan";
import { displayTicketId } from "../lib/task-links";
import { projectTasks } from "../queries/task-queries";
import { useTaskView } from "./task-view-context";
import type { TaskRow } from "@morrow/sync-schemas";

/** The Column choice that keeps each task's state. */
const KEEP_STATE = "keep";

/**
 * Moves the chosen tasks to another Project, from any menu, shortcut or the
 * selection bar. Two steps: the Project, then a question that lists what the
 * move will do and drop. A single task that lands in a matching Column with
 * nothing to lose moves straight after the Project is picked. A page showing a
 * moved task follows it on its own (`useFollowMovedTask`).
 */
export function MoveTasksDialog() {
  const move = useMove();
  return (
    <>
      <CommandDialog
        open={move !== null && move.to === null}
        onOpenChange={(open) => {
          if (!open) closeMove();
        }}
      >
        <CommandDialogPopup>
          {move ? <ProjectStep tasks={move.tasks} /> : null}
        </CommandDialogPopup>
      </CommandDialog>
      <Dialog
        open={move?.to != null}
        onOpenChange={(open) => {
          if (!open) closeMove();
        }}
      >
        {move?.to ? (
          <ConfirmStep key={move.to.id} tasks={move.tasks} to={move.to} />
        ) : null}
      </Dialog>
    </>
  );
}

function ProjectStep({ tasks }: { tasks: TaskRow[] }) {
  const { t } = useTranslation("tasks");
  const { workspace, project } = useTaskView();
  const [query, setQuery] = useState("");
  // Archived Projects are read-only, and the task is already in this one.
  const destinations = useProjectsWithoutSuspense(workspace.id).filter(
    (candidate) => candidate.id !== project.id && !candidate.archivedAt,
  );
  const [first] = tasks;

  return (
    <Command
      items={destinations}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(item: unknown) => {
        const { name, key } = item as ProjectRow;
        return `${name} ${key}`;
      }}
    >
      <CommandInput
        placeholder={t("move.searchPlaceholder")}
        aria-label={
          tasks.length === 1 && first
            ? t("move.title", {
                id: displayTicketId(project.key, first.number),
              })
            : t("move.bulkTitle", { count: tasks.length })
        }
      />
      <CommandPanel>
        <CommandEmpty>{t("move.empty")}</CommandEmpty>
        <CommandList>
          {(item: ProjectRow) => (
            <CommandItem
              key={item.id}
              value={item}
              onClick={() => chooseMoveProject(item)}
              className="px-3"
            >
              <ProjectIcon project={item} />
              <span className="flex-1 truncate">{item.name}</span>
              <span className="text-muted-foreground text-xs">{item.key}</span>
            </CommandItem>
          )}
        </CommandList>
      </CommandPanel>
    </Command>
  );
}

function ConfirmStep({ tasks, to }: { tasks: TaskRow[]; to: ProjectRow }) {
  const { t } = useTranslation("tasks");
  const { project, columns: fromColumns, fields: fromFields } = useTaskView();
  const toColumns = useProjectColumnsWithoutSuspense(to.id);
  const toFields = useProjectFieldsWithoutSuspense(to.id);
  const moveTasks = useMoveTasks();
  const [withSubtasks, setWithSubtasks] = useState(true);
  // Empty until the user picks: then the Column each task's state maps to.
  const [picked, setPicked] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [sourceTasks, setSourceTasks] = useState<TaskRow[] | null>(null);

  // Subtasks and their Field values count even when the board has not loaded them.
  useEffect(() => {
    let current = true;
    const query = projectTasks(project.id);
    void query.preload().then(() => {
      if (current) setSourceTasks(query.toArray);
    });
    return () => {
      current = false;
    };
  }, [project.id]);

  const plan =
    sourceTasks && toColumns.length > 0
      ? planMove({
          selected: tasks,
          projectTasks: sourceTasks,
          withSubtasks,
          from: { key: project.key, columns: fromColumns, fields: fromFields },
          to: { key: to.key, columns: toColumns, fields: toFields },
          columnId: picked ?? undefined,
        })
      : null;

  async function run() {
    if (!plan || moving) return;
    setMoving(true);
    const done = await moveTasks({
      selected: tasks,
      plan,
      to,
      columnId: picked ?? undefined,
      withSubtasks,
    });
    setMoving(false);
    if (done) closeMove();
  }

  // One task with nothing to ask goes straight away.
  const skip = plan !== null && needsNoConfirmation(plan, tasks.length);
  const started = useRef(false);
  useEffect(() => {
    if (skip && !started.current) {
      started.current = true;
      void run();
    }
  });
  if (skip) return null;

  const tooMany = plan !== null && plan.tasks.length > MAX_MOVE_TASKS;
  // A bulk move keeps each task's state unless one Column is picked; a single
  // task shows the Column its state maps to.
  const bulk = tasks.length > 1;
  const [only] = tasks;
  const columnItems = [
    ...(bulk ? [{ value: KEEP_STATE, label: t("move.keepState") }] : []),
    ...toColumns.map((column) => ({ value: column.id, label: column.name })),
  ];
  const columnValue =
    picked ??
    (bulk ? KEEP_STATE : (only && plan?.columnOf.get(only.id)?.id) || null);

  return (
    <DialogPopup className="w-full max-w-md">
      <DialogHeader>
        <DialogTitle>
          {t("move.confirmTitle", { project: to.name })}
        </DialogTitle>
      </DialogHeader>
      <DialogPanel className="space-y-4">
        <p className="text-sm" aria-live="polite">
          {plan === null
            ? " "
            : tooMany
              ? t("move.tooMany", {
                  count: plan.tasks.length,
                  max: MAX_MOVE_TASKS,
                })
              : t("move.summary", { count: plan.tasks.length })}
        </p>
        <div className="space-y-1.5">
          <Label>{t("move.column")}</Label>
          <Select
            items={columnItems}
            value={columnValue}
            onValueChange={(next) =>
              setPicked(next === KEEP_STATE ? null : next)
            }
          >
            <SelectTrigger aria-label={t("move.column")}>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {columnItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        {plan?.hasSubtasks ? (
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={withSubtasks}
              onCheckedChange={(checked) => setWithSubtasks(checked === true)}
            />
            {t("move.subtasks")}
          </Label>
        ) : null}
        {plan && plan.dropped.length > 0 ? (
          <div className="space-y-1.5 text-sm">
            <p className="font-medium">{t("move.droppedTitle")}</p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-muted-foreground text-xs">
              {plan.dropped.map((lost) => (
                <li key={`${lost.ticketId}:${lost.field}`}>
                  {t("move.droppedItem", {
                    ticket: lost.ticketId,
                    field: lost.field,
                    value: Array.isArray(lost.value)
                      ? lost.value.join(", ")
                      : String(lost.value),
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogPanel>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="me-auto"
          disabled={moving}
          onClick={backToProjects}
        >
          <ArrowLeft aria-hidden="true" />
          {t("move.back")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={moving}
          onClick={closeMove}
        >
          {t("common:actions.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!plan || tooMany || moving}
          onClick={() => void run()}
        >
          {moving
            ? t("move.pending")
            : t("move.confirm", { count: plan?.tasks.length ?? tasks.length })}
        </Button>
      </DialogFooter>
    </DialogPopup>
  );
}
