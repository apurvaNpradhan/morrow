import { COMMENT_BODY_MAX, type TaskCommentRow } from "@morrow/sync-schemas";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { errorMessage } from "@/app/lib/error-message";
import { formatDateTime, formatRelativeTime } from "@/design-system/format";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { deleteComment, editComment } from "../actions/comment-actions";
import { PersonAvatar } from "./person-avatar";
import { TaskDescriptionEditor } from "./task-description-editor";
import { useTaskView } from "./task-view-context";

/**
 * One comment: who wrote it and when, "edited" when it was, its markdown, and a
 * menu to edit (the author) or delete (the author, or a moderator).
 */
export function TaskComment({
  comment,
  highlighted = false,
}: {
  comment: TaskCommentRow;
  /** Briefly marked, for a comment a search result opened. */
  highlighted?: boolean;
}) {
  const { t } = useTranslation("tasks");
  const { personById, meId, can, frozen, workspace } = useTaskView();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [uploading, setUploading] = useState(false);
  const author = comment.authorId
    ? personById.get(comment.authorId)
    : undefined;
  const mine = comment.authorId !== null && comment.authorId === meId;
  const canEdit = mine && !frozen;
  const canDelete = (mine || can.moderateComments) && !frozen;

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(t, error, t("comments.error")));
    }
  }

  async function save() {
    const next = draft.trim();
    if (next === "") return;
    setEditing(false);
    if (next !== comment.body) await run(() => editComment(comment.id, next));
  }

  return (
    <li
      className={cn(
        "-m-1.5 flex gap-2.5 rounded-xl p-1.5 transition-colors duration-700",
        highlighted && "bg-primary/10",
      )}
      data-comment-id={comment.id}
    >
      <PersonAvatar
        person={author ?? { name: t("comments.deletedUser"), image: null }}
        className="mt-0.5 size-6"
      />
      <div className="min-w-0 flex-1 rounded-lg border bg-card">
        <div className="flex items-center gap-1.5 px-3 pt-2 text-xs">
          <span className="font-medium">
            {author?.name ?? t("comments.deletedUser")}
          </span>
          <time
            dateTime={comment.createdAt.toISOString()}
            title={formatDateTime(comment.createdAt)}
            className="text-muted-foreground"
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
          {comment.editedAt ? (
            <>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span
                className="text-muted-foreground"
                title={formatDateTime(comment.editedAt)}
              >
                {t("comments.edited")}
              </span>
            </>
          ) : null}
          {canEdit || canDelete ? (
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ms-auto -me-1.5"
                  />
                }
                aria-label={t("comments.menu")}
              >
                <Ellipsis aria-hidden="true" />
              </MenuTrigger>
              <MenuPopup align="end">
                {canEdit ? (
                  <MenuItem
                    onClick={() => {
                      setDraft(comment.body);
                      setEditing(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    {t("comments.edit")}
                  </MenuItem>
                ) : null}
                {canDelete ? (
                  <MenuItem
                    variant="destructive"
                    onClick={() => void run(() => deleteComment(comment.id))}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("comments.delete")}
                  </MenuItem>
                ) : null}
              </MenuPopup>
            </Menu>
          ) : null}
        </div>
        {editing ? (
          <div className="space-y-2 px-3 pb-2 pt-1">
            <TaskDescriptionEditor
              label={t("comments.editLabel")}
              value={draft}
              onChange={setDraft}
              autoFocus
              onSubmit={() => void save()}
              className="min-h-10"
              limit={COMMENT_BODY_MAX}
              workspaceId={workspace.id}
              onUploadingChange={(running) => setUploading(running > 0)}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                {t("comments.cancel")}
              </Button>
              <Button
                size="xs"
                disabled={draft.trim() === "" || uploading}
                onClick={() => void save()}
              >
                {t("comments.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-3 pb-2.5 pt-1">
            <TaskDescriptionEditor
              label={t("comments.bodyLabel")}
              value={comment.body}
              onChange={() => {}}
              editable={false}
            />
          </div>
        )}
      </div>
    </li>
  );
}
