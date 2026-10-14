import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { useWorkspaceMembers } from "@/members";
import { useTransferWorkspaceOwnership } from "@/workspace/general/use-transfer-workspace-ownership";

/** Owner-only: hand the workspace to another member, after a confirmation. */
export function OwnershipSection({
  workspace,
  currentUserId,
}: {
  workspace: { id: string; name: string };
  currentUserId: string | undefined;
}) {
  const members = useWorkspaceMembers(workspace.id);
  const { t } = useTranslation();
  const { mutateAsync: transferOwnership, isPending } =
    useTransferWorkspaceOwnership();
  const [selectedId, setSelectedId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const currentOwner = members.find((m) => m.role === "owner");
  const candidates = members.filter(
    (m) => m.role !== "owner" && m.userId !== currentUserId,
  );
  const selected = candidates.find((m) => m.id === selectedId);

  const transfer = async () => {
    if (!currentOwner || !selected) return;
    try {
      await transferOwnership({
        workspaceId: workspace.id,
        newOwnerMemberId: selected.id,
        currentOwnerMemberId: currentOwner.id,
      });
      toast.success(
        t("settings:workspaceGeneral.transferOwnership.toastSuccess"),
      );
      setConfirming(false);
      setSelectedId("");
    } catch (error) {
      toast.error(
        errorMessage(
          t,
          error,
          t("settings:workspaceGeneral.transferOwnership.toastError"),
        ),
      );
    }
  };

  return (
    <SettingsSection
      title={t("settings:workspaceGeneral.transferOwnership.title")}
      description={t("settings:workspaceGeneral.transferOwnership.subtitle")}
    >
      <SettingsCard>
        <SettingsRow
          stack
          title={t("settings:workspaceGeneral.transferOwnership.pickerLabel")}
          description={
            candidates.length === 0
              ? t(
                  "settings:workspaceGeneral.transferOwnership.noEligibleMembers",
                )
              : t("settings:workspaceGeneral.transferOwnership.pickerHint")
          }
        >
          <Select
            value={selectedId}
            onValueChange={(value) => {
              if (typeof value === "string") setSelectedId(value);
            }}
            disabled={candidates.length === 0}
          >
            <SelectTrigger size="sm" className="w-full sm:w-56">
              <SelectValue
                placeholder={t(
                  "settings:workspaceGeneral.transferOwnership.pickerPlaceholder",
                )}
              >
                {selected ? selected.user.name || selected.user.email : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.user.name} ({m.user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={!selectedId || isPending}
            onClick={() => setConfirming(true)}
          >
            {t("settings:workspaceGeneral.transferOwnership.button")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive={false}
        title={t("settings:workspaceGeneral.transferOwnership.dialogTitle")}
        description={t(
          "settings:workspaceGeneral.transferOwnership.dialogDescription",
          {
            name: selected?.user.name || selected?.user.email || "",
            workspace: workspace.name,
          },
        )}
        confirmLabel={t("settings:workspaceGeneral.transferOwnership.confirm")}
        pendingLabel={t(
          "settings:workspaceGeneral.transferOwnership.transferring",
        )}
        pending={isPending}
        onConfirm={transfer}
      />
    </SettingsSection>
  );
}
