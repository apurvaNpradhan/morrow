import { isCalendarDate, TASK_DESCRIPTION_MAX } from "@morrow/sync-schemas";
import { CalendarDays, Layers, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { formatDate } from "@/design-system/format";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { MenuRadioGroup, MenuRadioItem } from "@/design-system/ui/menu";
import { Textarea } from "@/design-system/ui/textarea";
import {
  useProjectColumnsWithoutSuspense,
  useProjectFieldsWithoutSuspense,
  useProjectsWithoutSuspense,
} from "@/projects";
import { useWorkspacePermission } from "@/workspace";
import { createTask } from "../actions/task-actions";
import { useCreatedToast } from "../actions/use-created-toast";
import { parseDay } from "../lib/calendar-day";
import {
  closeCreateTask,
  type CreateTaskPreset,
} from "../lib/create-task-store";
import { useCurrentProjectKey } from "../lib/use-current-project-key";
import { useToday } from "../queries/use-today";
import { useWorkspacePeople } from "../queries/use-workspace-people";
import { ColumnMarker } from "./column-marker";
import { DraftFieldChips } from "./draft-field-chips";
import { DraftLabelField } from "./draft-label-field";
import type { TaskDraft } from "./create-task-draft";
import { FieldChipMenu } from "./field-chip-menu";
import { PersonAvatar } from "./person-avatar";
import {
  AssigneeItems,
  ColumnItems,
  DueDateItems,
  PriorityItems,
} from "./task-field-items";
import { TaskDescriptionEditor } from "./task-description-editor";
import { TaskPriorityIcon } from "./task-priority-icon";

/**
 * The fields of the create dialog. The Project is chosen only when the dialog
 * is opened outside one; the Column starts at the Project's first `unstarted`
 * Column unless a header's "+" named another.
 */
export function CreateTaskForm({
  workspace,
  preset,
  draft,
  onDraftChange,
  onClose,
}: {
  workspace: { id: string; slug: string };
  preset: CreateTaskPreset;
  draft: TaskDraft;
  onDraftChange: (draft: TaskDraft) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  const permission = useWorkspacePermission();
  const { people, meId } = useWorkspacePeople(workspace.id);
  const today = useToday();
  const showCreated = useCreatedToast();
  const currentKey = useCurrentProjectKey();
  const projects = useProjectsWithoutSuspense(workspace.id).filter(
    (project) => !project.archivedAt,
  );
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const insideProject =
    preset.projectId !== undefined || currentKey !== undefined;
  const project =
    projects.find((candidate) => candidate.id === draft.projectId) ??
    projects.find((candidate) => candidate.id === preset.projectId) ??
    projects.find((candidate) => candidate.key === currentKey) ??
    projects[0];
  const columns = useProjectColumnsWithoutSuspense(project?.id);
  const fields = useProjectFieldsWithoutSuspense(project?.id);
  const column =
    columns.find((candidate) => candidate.id === draft.columnId) ??
    columns.find((candidate) => candidate.id === preset.columnId) ??
    columns.find((candidate) => candidate.category === "unstarted");

  const update = (patch: Partial<TaskDraft>) =>
    onDraftChange({ ...draft, ...patch });
  const canSubmit =
    project !== undefined &&
    column !== undefined &&
    draft.title.trim() !== "" &&
    !submitting;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function submit() {
    if (!canSubmit || !project || !column) return;
    setSubmitting(true);
    try {
      const created = await createTask({
        projectId: project.id,
        column,
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        dueDate: draft.dueDate,
        labelIds: draft.labelIds,
        // Values chosen for another Project's Fields (the Project was changed after) are left out.
        fieldValues: Object.fromEntries(
          fields.flatMap((field) => {
            const optionId = draft.fieldValues[field.id];
            return optionId === undefined ? [] : [[field.id, optionId]];
          }),
        ),
        userId: meId,
      });
      showCreated(project.key, created.number);
      if (createMore) {
        // Next one: everything clears except where it goes.
        onDraftChange({
          ...draft,
          projectId: project.id,
          columnId: column.id,
          title: "",
          description: "",
          priority: "none",
          assigneeId: null,
          dueDate: null,
          labelIds: [],
          fieldValues: {},
        });
        setPickingDate(false);
        titleRef.current?.focus();
      } else {
        closeCreateTask();
      }
    } catch (error) {
      toast.error(errorMessage(t, error, t("create.error")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void submit();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
          <span className="font-mono text-foreground">
            {project?.key ?? "—"}
          </span>
          <span aria-hidden="true">/</span>
          {t("create.title")}
        </DialogTitle>
      </DialogHeader>
      <DialogPanel className="space-y-3">
        <Textarea
          ref={titleRef}
          unstyled
          rows={1}
          aria-label={t("create.titleLabel")}
          placeholder={t("create.titlePlaceholder")}
          maxLength={500}
          className="w-full resize-none bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground"
          value={draft.title}
          onChange={(event) =>
            update({ title: event.target.value.replace(/[\r\n]+/g, " ") })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <TaskDescriptionEditor
          label={t("create.descriptionLabel")}
          placeholder={t("create.descriptionPlaceholder")}
          value={draft.description}
          onChange={(description) => update({ description })}
          onSubmit={() => void submit()}
          className="min-h-24"
          limit={TASK_DESCRIPTION_MAX}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {!insideProject ? (
            <FieldChipMenu
              label={t("fields.project")}
              icon={<Layers aria-hidden="true" className="size-3.5" />}
              value={project?.name ?? t("create.noProject")}
            >
              <MenuRadioGroup
                value={project?.id ?? ""}
                onValueChange={(projectId) =>
                  update({ projectId, columnId: undefined, fieldValues: {} })
                }
              >
                {projects.map((candidate) => (
                  <MenuRadioItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </FieldChipMenu>
          ) : null}
          <FieldChipMenu
            label={t("fields.column")}
            icon={column ? <ColumnMarker column={column} /> : null}
            value={column?.name ?? "—"}
          >
            <ColumnItems
              columns={columns}
              value={column?.id ?? ""}
              onSelect={(columnId) => update({ columnId })}
            />
          </FieldChipMenu>
          <FieldChipMenu
            label={t("fields.priority")}
            icon={<TaskPriorityIcon priority={draft.priority} />}
            value={t(`priority.${draft.priority}`)}
          >
            <PriorityItems
              value={draft.priority}
              onSelect={(priority) => update({ priority })}
            />
          </FieldChipMenu>
          <FieldChipMenu
            label={t("fields.assignee")}
            icon={
              draft.assigneeId &&
              people.find((p) => p.id === draft.assigneeId) ? (
                <PersonAvatar
                  person={people.find((p) => p.id === draft.assigneeId)!}
                  className="size-4"
                />
              ) : (
                <UserRound aria-hidden="true" className="size-3.5" />
              )
            }
            value={
              people.find((person) => person.id === draft.assigneeId)?.name ??
              t("assignee.unassigned")
            }
          >
            <AssigneeItems
              people={people}
              meId={meId}
              canAssign={permission.canAssignTasks()}
              value={draft.assigneeId}
              onSelect={(assigneeId) => update({ assigneeId })}
            />
          </FieldChipMenu>
          <FieldChipMenu
            label={t("fields.dueDate")}
            icon={<CalendarDays aria-hidden="true" className="size-3.5" />}
            value={
              draft.dueDate
                ? formatDate(parseDay(draft.dueDate), {
                    month: "short",
                    day: "numeric",
                  })
                : t("fields.noDueDate")
            }
          >
            <DueDateItems
              today={today}
              hasValue={draft.dueDate !== null}
              onSelect={(dueDate) => {
                setPickingDate(false);
                update({ dueDate });
              }}
              onPickDate={() => setPickingDate(true)}
            />
          </FieldChipMenu>
          <DraftLabelField
            workspaceId={workspace.id}
            labelIds={draft.labelIds}
            onChange={(labelIds) => update({ labelIds })}
          />
          <DraftFieldChips
            fields={fields}
            fieldValues={draft.fieldValues}
            onChange={(fieldValues) => update({ fieldValues })}
          />
          {pickingDate ? (
            <Input
              type="date"
              size="sm"
              className="h-7 w-40"
              aria-label={t("fields.dueDate")}
              value={draft.dueDate ?? ""}
              onChange={(event) =>
                update({
                  dueDate: isCalendarDate(event.target.value)
                    ? event.target.value
                    : null,
                })
              }
            />
          ) : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <label className="me-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={createMore}
            onChange={(event) => setCreateMore(event.target.checked)}
          />
          {t("create.more")}
        </label>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitting ? t("create.creating") : t("create.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
