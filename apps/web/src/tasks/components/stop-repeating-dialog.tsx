import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import {
  cancelStopRepeating,
  usePendingStopRepeating,
} from "../lib/stop-repeating-store";

/** "Clearing the due date stops this task repeating": asks before the write that does. */
export function StopRepeatingDialog() {
  const { t } = useTranslation("tasks");
  const proceed = usePendingStopRepeating();
  const [working, setWorking] = useState(false);

  async function confirm() {
    if (!proceed) return;
    setWorking(true);
    cancelStopRepeating();
    await proceed();
    setWorking(false);
  }

  return (
    <ConfirmDialog
      open={proceed !== null}
      onOpenChange={(open) => {
        if (!open && !working) cancelStopRepeating();
      }}
      title={t("repeat.stopTitle")}
      description={t("repeat.stopDescription")}
      confirmLabel={t("repeat.stopConfirm")}
      pendingLabel={t("repeat.stopConfirm")}
      pending={working}
      destructive={false}
      onConfirm={() => void confirm()}
    />
  );
}
