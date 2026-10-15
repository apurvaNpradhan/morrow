import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { Dialog, DialogPopup } from "@/design-system/ui/dialog";
import { closeCreateTask, useCreateTaskState } from "../lib/create-task-store";
import { EMPTY_DRAFT, isDirty, type TaskDraft } from "./create-task-draft";
import { CreateTaskForm } from "./create-task-form";

/**
 * "New task", opened by `C`, a "+" in a Column header or the command palette.
 * Closing with something typed asks first. Mounted once, with the palette.
 */
export function CreateTaskDialog({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("tasks");
  const { open, preset } = useCreateTaskState();
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT);
  const [discarding, setDiscarding] = useState(false);

  function close() {
    if (isDirty(draft)) setDiscarding(true);
    else closeCreateTask();
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) setDraft(EMPTY_DRAFT);
        }}
      >
        <DialogPopup className="w-full max-w-2xl">
          <Suspense fallback={null}>
            {open ? (
              <CreateTaskForm
                workspace={workspace}
                preset={preset}
                draft={draft}
                onDraftChange={setDraft}
                onClose={close}
              />
            ) : null}
          </Suspense>
        </DialogPopup>
      </Dialog>
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("create.discardTitle")}
        description={t("create.discardDescription")}
        confirmLabel={t("create.discard")}
        onConfirm={() => {
          setDiscarding(false);
          setDraft(EMPTY_DRAFT);
          closeCreateTask();
        }}
      />
    </>
  );
}
