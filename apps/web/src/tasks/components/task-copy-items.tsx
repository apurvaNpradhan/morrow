import type { TaskRow } from "@morrow/sync-schemas";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MenuItem } from "@/design-system/ui/menu";
import { COPY_KINDS, useCopyTask } from "../actions/use-copy-task";

/** The four copy actions of a task as menu items; one group wherever it is shown. */
export function TaskCopyItems({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const copyTask = useCopyTask();
  return (
    <>
      {COPY_KINDS.map((kind) => (
        <MenuItem key={kind} onClick={() => void copyTask(kind, task)}>
          <Copy aria-hidden="true" />
          {t(`copy.${kind}`)}
        </MenuItem>
      ))}
    </>
  );
}
