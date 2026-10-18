import { COMMENT_BODY_MAX, type TaskRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { postComment } from "../actions/comment-actions";
import { TaskDescriptionEditor } from "./task-description-editor";
import { useTaskView } from "./task-view-context";

/** The box at the foot of the timeline: write markdown, Comment (or Mod+Enter) posts it. */
export function CommentComposer({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { meId } = useTaskView();
  const [body, setBody] = useState("");
  // Bumped after a post, so the editor starts empty again.
  const [generation, setGeneration] = useState(0);
  const [posting, setPosting] = useState(false);
  const empty = body.trim() === "";

  async function post() {
    if (empty || posting) return;
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
      />
      <div className="flex justify-end">
        <Button
          size="xs"
          disabled={empty || posting}
          onClick={() => void post()}
        >
          {t("comments.post")}
        </Button>
      </div>
    </div>
  );
}
