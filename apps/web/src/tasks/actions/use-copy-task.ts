import type { TaskRow } from "@morrow/sync-schemas";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/design-system/copy-to-clipboard";
import { toast } from "@/design-system/toast";
import { taskDescriptionCollection } from "../collections/task-description-collection";
import { displayTicketId, taskUrl } from "../lib/task-links";
import { taskAsMarkdown } from "../lib/task-markdown";
import { useTaskView } from "../components/task-view-context";

export const COPY_KINDS = ["id", "title", "link", "markdown"] as const;
export type CopyKind = (typeof COPY_KINDS)[number];

/** Copies one thing about a task and says what was copied. */
export function useCopyTask() {
  const { t } = useTranslation("tasks");
  const { workspace, project } = useTaskView();

  return useCallback(
    async (kind: CopyKind, task: TaskRow) => {
      const ticket = displayTicketId(project.key, task.number);
      const url = taskUrl(workspace.slug, project.key, task.number);
      const text = {
        id: () => ticket,
        title: () => task.title,
        link: () => url,
        markdown: () =>
          taskAsMarkdown({
            ticket,
            title: task.title,
            url,
            description:
              taskDescriptionCollection.get(task.id)?.description ?? "",
          }),
      }[kind]();
      if (await copyToClipboard(text)) toast.success(t(`copy.${kind}Done`));
      else toast.error(t("copy.failed"));
    },
    [t, workspace.slug, project.key],
  );
}
