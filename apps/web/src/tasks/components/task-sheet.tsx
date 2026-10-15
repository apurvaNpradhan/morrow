import { useTranslation } from "react-i18next";
import { Sheet, SheetDescription, SheetPopup } from "@/design-system/ui/sheet";
import { Skeleton } from "@/design-system/ui/skeleton";
import { useTicketTask } from "../queries/use-task-queries";
import { TaskSheetBody } from "./task-sheet-body";
import { useTaskView } from "./task-view-context";

/**
 * A task opened over the board or list. `number` is the ticket number in the
 * address; `null` keeps the sheet closed. Closing returns focus to the card or
 * row it was opened from. An unknown or deleted ticket says so.
 */
export function TaskSheet({
  number,
  onClose,
}: {
  number: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const { task, isReady } = useTicketTask(project.id, number);

  return (
    <Sheet
      open={number !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup className="max-w-4xl" aria-label={t("sheet.label")}>
        <SheetDescription className="sr-only">
          {t("sheet.description")}
        </SheetDescription>
        {task ? (
          // A different task starts with its own editor and title.
          <TaskSheetBody key={task.id} task={task} />
        ) : isReady ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t("sheet.notFound", { key: project.key, number })}
          </p>
        ) : (
          <div className="space-y-3 p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </SheetPopup>
    </Sheet>
  );
}
