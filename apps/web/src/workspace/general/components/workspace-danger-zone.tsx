import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { useDeleteWorkspace } from "@/workspace/queries/use-delete-workspace";

export function WorkspaceDangerZone({
  workspace,
}: {
  workspace: { id: string; name: string };
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync: deleteWorkspace, isPending } = useDeleteWorkspace();
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    try {
      await deleteWorkspace({ workspaceId: workspace.id });
      toast.success(t("settings:workspaceGeneral.toastDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({
        queryKey: ["active-organization"],
      });
      setConfirming(false);
      navigate({ to: "/" });
    } catch (error) {
      toast.error(
        errorMessage(t, error, t("settings:workspaceGeneral.toastDeleteError")),
      );
    }
  };

  return (
    <SettingsSection
      title={t("settings:workspaceGeneral.dangerZone")}
      description={t("settings:workspaceGeneral.dangerZoneSubtitle")}
    >
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("settings:workspaceGeneral.deleteWorkspace")}
          description={t(
            "settings:workspaceGeneral.deleteWorkspaceDescription",
          )}
        >
          <Button
            variant="destructive-outline"
            size="sm"
            type="button"
            onClick={() => setConfirming(true)}
          >
            {t("settings:workspaceGeneral.deleteWorkspace")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("settings:workspaceGeneral.deleteModalTitle")}
        description={t("settings:workspaceGeneral.deleteModalDescription", {
          name: workspace.name,
        })}
        confirmLabel={t("settings:workspaceGeneral.deleteModalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isPending}
        onConfirm={remove}
      />
    </SettingsSection>
  );
}
