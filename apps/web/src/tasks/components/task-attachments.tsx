import { isPreviewable } from "@morrow/sync-schemas";
import type { TaskAttachmentRow, TaskRow } from "@morrow/sync-schemas";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { removeAttachment } from "../actions/attachment-actions";
import { assetPath } from "../attachments/asset-markdown";
import { FilePreview } from "../attachments/file-preview";
import { FileTypeIcon } from "../attachments/file-type-icon";
import { formatBytes } from "../attachments/format-bytes";
import { useTaskAttachments } from "../queries/use-task-queries";
import { useTaskView } from "./task-view-context";

/**
 * Every file attached to a task, oldest first, under its description: name,
 * size and who added it. Anyone who can edit the task can delete a file, which
 * is the way to free its storage: taking the link out of the text keeps it.
 * Nothing shows for a task without files.
 */
export function TaskAttachments({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { can, frozen, personById } = useTaskView();
  const files = useTaskAttachments(task.id);
  const editable = can.edit && !frozen;
  const [deleting, setDeleting] = useState<TaskAttachmentRow | null>(null);
  const [pending, setPending] = useState(false);
  const [previewing, setPreviewing] = useState<TaskAttachmentRow | null>(null);

  if (files.length === 0) return null;

  const rowClass =
    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
  const rowContent = (file: TaskAttachmentRow) => (
    <>
      <FileTypeIcon mimeType={file.mimeType} />
      <span className="truncate">{file.filename}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatBytes(file.size)}
        {file.createdBy && personById.get(file.createdBy)
          ? ` · ${t("attachments.addedBy", { name: personById.get(file.createdBy)?.name })}`
          : ""}
      </span>
    </>
  );

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    try {
      await removeAttachment(deleting.id);
    } catch (error) {
      toast.error(errorMessage(t, error, t("attachments.deleteError")));
    } finally {
      setPending(false);
      setDeleting(null);
    }
  }

  return (
    <section aria-label={t("attachments.title")} className="space-y-1.5">
      <h2 className="text-xs font-medium text-muted-foreground">
        {t("attachments.title")}
      </h2>
      <ul className="space-y-0.5">
        {files.map((file) => (
          <li
            key={file.id}
            className="group flex items-center gap-1 rounded-md hover:bg-accent/40"
          >
            {isPreviewable(file.mimeType) ? (
              <button
                type="button"
                className={rowClass}
                onClick={() => setPreviewing(file)}
              >
                {rowContent(file)}
              </button>
            ) : (
              <a
                href={`${assetPath(file.id)}?download=1`}
                download={file.filename}
                className={rowClass}
              >
                {rowContent(file)}
              </a>
            )}
            {editable ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                aria-label={t("attachments.delete", { name: file.filename })}
                onClick={() => setDeleting(file)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <FilePreview file={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
        title={t("attachments.deleteTitle")}
        description={t("attachments.deleteWarning")}
        confirmLabel={t("attachments.deleteConfirm")}
        pending={pending}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
