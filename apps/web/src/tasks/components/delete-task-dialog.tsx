import type { TaskRow } from "@morrow/sync-schemas";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { useTaskActions } from "../actions/use-task-actions";
import { useTaskView } from "./task-view-context";

let pending: TaskRow | null = null;
const listeners = new Set<() => void>();

function set(next: TaskRow | null) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks whether to delete a task; the one dialog is mounted with the project page. */
export function requestDeleteTask(task: TaskRow) {
  set(task);
}

/** After a confirmed delete, `onDeleted` lets the page close a sheet that showed the task. */
export function DeleteTaskDialog({
  onDeleted,
}: {
  onDeleted: (task: TaskRow) => void;
}) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const actions = useTaskActions();
  const task = useSyncExternalStore(subscribe, () => pending);
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (!task) return;
    setDeleting(true);
    if (await actions.remove(task)) onDeleted(task);
    setDeleting(false);
    set(null);
  }

  return (
    <ConfirmDialog
      open={task !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) set(null);
      }}
      title={t("delete.title", {
        id: task ? `${project.key}-${task.number}` : "",
      })}
      description={t("delete.description", { title: task?.title ?? "" })}
      confirmLabel={t("delete.confirm")}
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      onConfirm={() => void confirm()}
    />
  );
}
