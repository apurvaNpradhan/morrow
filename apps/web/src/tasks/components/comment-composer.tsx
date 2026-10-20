import { COMMENT_BODY_MAX, type TaskRow } from "@morrow/sync-schemas";
import { Paperclip } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { postComment } from "../actions/comment-actions";
import { TaskDescriptionEditor } from "./task-description-editor";
import { useTaskView } from "./task-view-context";

/**
 * The box at the foot of the timeline: write markdown, attach files with the
 * paperclip (or paste or drop them), Comment (or Mod+Enter) posts it. It waits
 * for running uploads, so a file is never left out of the comment it was
 * added to.
 */
export function CommentComposer({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { meId, workspace } = useTaskView();
  const [body, setBody] = useState("");
  // Bumped after a post, so the editor starts empty again.
  const [generation, setGeneration] = useState(0);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attach, setAttach] = useState<(() => void) | null>(null);
  const empty = body.trim() === "";

  async function post() {
    if (empty || posting || uploading) return;
    setPosting(true);
    const text = body.trim();
    setBody("");
    setGeneration((value) => value + 1);
    try {
      await postComment(task, meId, text);
    } catch (error) {
      // Put the text back so nothing typed is lost.
      setBody(text);
      setGeneration((value) => value + 1);
      toast.error(errorMessage(t, error, t("comments.error")));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card px-3 py-2">
      <TaskDescriptionEditor
        key={generation}
        label={t("comments.composerLabel")}
        placeholder={t("comments.placeholder")}
        value={body}
        onChange={setBody}
        onSubmit={() => void post()}
        className="min-h-10"
        limit={COMMENT_BODY_MAX}
        workspaceId={workspace.id}
        onAttachReady={(open) => setAttach(() => open)}
        onUploadingChange={(running) => setUploading(running > 0)}
      />
      <div className="flex items-center justify-between">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("attachments.attach")}
          disabled={attach === null}
          onClick={() => attach?.()}
        >
          <Paperclip aria-hidden="true" />
        </Button>
        <Button
          size="xs"
          disabled={empty || posting || uploading}
          onClick={() => void post()}
        >
          {t("comments.post")}
        </Button>
      </div>
    </div>
  );
}
