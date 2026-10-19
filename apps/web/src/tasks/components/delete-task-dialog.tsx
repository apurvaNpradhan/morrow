import type { TaskRow } from "@morrow/sync-schemas";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { useBulkActions } from "../actions/use-bulk-actions";
import { useTaskActions } from "../actions/use-task-actions";
import { useTaskView } from "./task-view-context";

let pending: TaskRow[] | null = null;
const listeners = new Set<() => void>();

function set(next: TaskRow[] | null) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Asks whether to delete these tasks; the one dialog is mounted with the project page. */
export function requestDeleteTasks(tasks: TaskRow[]) {
  if (tasks.length > 0) set(tasks);
}

/** After a confirmed delete, `onDeleted` lets the page close a sheet that showed the task. */
export function DeleteTaskDialog({
  onDeleted,
}: {
  onDeleted: (tasks: TaskRow[]) => void;
}) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const tasks = useSyncExternalStore(subscribe, () => pending);
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (!tasks) return;
    setDeleting(true);
    const [only] = tasks;
    const done =
      tasks.length === 1 && only
        ? await actions.remove(only)
        : await bulk.remove(tasks);
    if (done) onDeleted(tasks);
    setDeleting(false);
    set(null);
  }

  const [first] = tasks ?? [];
  const names = (tasks ?? [])
    .slice(0, 3)
    .map((task) => `${project.key}-${task.number}`);
  const rest = (tasks?.length ?? 0) - names.length;
  const ids =
    rest > 0
      ? t("delete.bulkMore", { ids: names.join(", "), count: rest })
      : names.join(", ");

  return (
    <ConfirmDialog
      open={tasks !== null}
      onOpenChange={(open) => {
        if (!open && !deleting) set(null);
      }}
      title={
        tasks && tasks.length > 1
          ? t("delete.bulkTitle", { count: tasks.length })
          : t("delete.title", {
              id: first ? `${project.key}-${first.number}` : "",
            })
      }
      description={
        tasks && tasks.length > 1
          ? t("delete.bulkDescription", { ids })
          : t("delete.description", { title: first?.title ?? "" })
      }
      confirmLabel={
        tasks && tasks.length > 1
          ? t("delete.bulkConfirm", { count: tasks.length })
          : t("delete.confirm")
      }
      pendingLabel={t("common:actions.deleting")}
      pending={deleting}
      onConfirm={() => void confirm()}
    />
  );
}
