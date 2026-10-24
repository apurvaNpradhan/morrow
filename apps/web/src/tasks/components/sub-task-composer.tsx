import {
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  type TaskPriority,
  type TaskRow,
} from "@morrow/sync-schemas";
import {
  CalendarDays,
  Ellipsis,
  Layers,
  Paperclip,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Menu, MenuPopup, MenuTrigger } from "@/design-system/ui/menu";
import { createTask } from "../actions/task-actions";
import { DraftLabelField } from "./draft-label-field";
import { FieldChipMenu } from "./field-chip-menu";
import { PersonAvatar } from "./person-avatar";
import { formatTaskDateText } from "../lib/format-task-date";
import { DraftDateInputs } from "./draft-date-inputs";
import { AssigneeItems, DueDateItems, PriorityItems } from "./task-field-items";
import { TaskDescriptionEditor } from "./task-description-editor";
import { TaskPriorityIcon } from "./task-priority-icon";
import { ColumnMarker } from "./column-marker";
import { useTaskView } from "./task-view-context";

type Draft = {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string | null;
  labelIds: string[];
  dueDate: string | null;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  priority: "none",
  assigneeId: null,
  labelIds: [],
  dueDate: null,
};

/**
 * Adds sub-tasks under `parent` in place: a status circle and title, an
 * optional description, and chips for the fixed Project, Priority, Assignee,
 * Labels and, under the ellipsis, the due date. Create keeps it open for the
 * next one; Enter in the title creates, Escape or Cancel closes. The sub-task
 * starts in the Project's first To Do column.
 */
export function SubTaskComposer({
  parent,
  onClose,
}: {
  parent: TaskRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  const { project, columns, people, meId, today, timeZone, can, workspace } =
    useTaskView();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attach, setAttach] = useState<(() => void) | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const column =
    columns.find((candidate) => candidate.category === "unstarted") ??
    columns[0];
  const assignee = people.find((person) => person.id === draft.assigneeId);
  const canSubmit =
    draft.title.trim() !== "" &&
    column !== undefined &&
    !submitting &&
    !uploading;
  const update = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  async function submit() {
    if (!canSubmit || !column) return;
    setSubmitting(true);
    try {
      await createTask({
        projectId: project.id,
        column,
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        dueDate: draft.dueDate,
        labelIds: draft.labelIds,
        parentId: parent.id,
        userId: meId,
      });
      setDraft(EMPTY_DRAFT);
      setPickingDate(false);
      titleRef.current?.focus();
    } catch (error) {
      toast.error(errorMessage(t, error, t("subtasks.error")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      aria-label={t("subtasks.add")}
      className="space-y-2 rounded-lg border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="flex items-center gap-2">
        {column ? <ColumnMarker column={column} /> : null}
        <Input
          ref={titleRef}
          unstyled
          autoFocus
          aria-label={t("subtasks.titleLabel")}
          placeholder={t("subtasks.titlePlaceholder")}
          maxLength={TASK_TITLE_MAX}
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </div>
      <TaskDescriptionEditor
        label={t("create.descriptionLabel")}
        placeholder={t("create.descriptionPlaceholder")}
        value={draft.description}
        onChange={(description) => update({ description })}
        className="min-h-8 text-sm"
        limit={TASK_DESCRIPTION_MAX}
        workspaceId={workspace.id}
        onAttachReady={(open) => setAttach(() => open)}
        onUploadingChange={(running) => setUploading(running > 0)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-control px-2 text-xs text-muted-foreground">
          <Layers aria-hidden="true" className="size-3.5" />
          {project.key}
        </span>
        <FieldChipMenu
          label={t("fields.priority")}
          icon={<TaskPriorityIcon priority={draft.priority} />}
          muted={draft.priority === "none"}
          value={
            draft.priority === "none"
              ? t("fields.priority")
              : t(`priority.${draft.priority}`)
          }
        >
          <PriorityItems
            value={draft.priority}
            onSelect={(priority) => update({ priority })}
          />
        </FieldChipMenu>
        <FieldChipMenu
          label={t("fields.assignee")}
          muted={!assignee}
          icon={
            assignee ? (
              <PersonAvatar person={assignee} className="size-4" />
            ) : (
              <UserRound aria-hidden="true" className="size-3.5" />
            )
          }
          value={assignee?.name ?? t("fields.assignee")}
        >
          <AssigneeItems
            people={people}
            meId={meId}
            canAssign={can.assign}
            value={draft.assigneeId}
            onSelect={(assigneeId) => update({ assigneeId })}
          />
        </FieldChipMenu>
        <DraftLabelField
          workspaceId={workspace.id}
          labelIds={draft.labelIds}
          onChange={(labelIds) => update({ labelIds })}
        />
        {draft.dueDate ? (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-control px-2 text-xs">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {formatTaskDateText(draft.dueDate, timeZone)}
          </span>
        ) : null}
        <Menu>
          <MenuTrigger
            aria-label={t("subtasks.moreFields")}
            className="inline-flex h-7 cursor-pointer items-center rounded-md border bg-control px-2 outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ellipsis aria-hidden="true" className="size-3.5" />
          </MenuTrigger>
          <MenuPopup align="start" className="min-w-48">
            <DueDateItems
              today={today}
              timeZone={timeZone}
              hasValue={draft.dueDate !== null}
              onSelect={(dueDate) => {
                setPickingDate(false);
                update({ dueDate });
              }}
              onPickDate={() => setPickingDate(true)}
            />
          </MenuPopup>
        </Menu>
        {pickingDate ? (
          <DraftDateInputs
            value={draft.dueDate}
            timeZone={timeZone}
            onChange={(dueDate) => update({ dueDate })}
          />
        ) : null}
        <div className="ms-auto flex items-center gap-1.5">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t("attachments.attach")}
            disabled={attach === null}
            onClick={() => attach?.()}
          >
            <Paperclip aria-hidden="true" />
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="submit" size="xs" disabled={!canSubmit}>
            {t("subtasks.create")}
          </Button>
        </div>
      </div>
    </form>
  );
}
