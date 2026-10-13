import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { useAuth } from "@/auth";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { isDeleteConfirmationValid } from "./is-delete-confirmation-valid";
import {
  useDeleteAccount,
  SESSION_TOO_OLD,
} from "@/account/queries/use-delete-account";

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync: deleteAccount, isPending } = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = async () => {
    try {
      await deleteAccount();
      setOpen(false);
      queryClient.clear();
      toast.success(t("settings:informationPage.deleteAccount.success"));
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_TOO_OLD) {
        toast.error(t("settings:informationPage.deleteAccount.sessionTooOld"));
        return;
      }
      toast.error(
        errorMessage(
          t,
          error,
          t("settings:informationPage.deleteAccount.error"),
        ),
      );
    }
  };

  return (
    <SettingsSection
      title={t("settings:informationPage.deleteAccount.sectionTitle")}
      description={t("settings:informationPage.deleteAccount.sectionSubtitle")}
    >
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("settings:informationPage.deleteAccount.title")}
          description={t("settings:informationPage.deleteAccount.description")}
        >
          <Button
            variant="destructive-outline"
            size="sm"
            type="button"
            onClick={() => setOpen(true)}
          >
            {t("settings:informationPage.deleteAccount.title")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTyped("");
        }}
        title={t("settings:informationPage.deleteAccount.modalTitle")}
        description={t(
          "settings:informationPage.deleteAccount.modalDescription",
          {
            email: user?.email ?? "",
          },
        )}
        confirmLabel={t("settings:informationPage.deleteAccount.confirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isPending}
        confirmDisabled={!isDeleteConfirmationValid(typed, user?.email)}
        onConfirm={remove}
      >
        <div className="space-y-2">
          <Label htmlFor="delete-account-confirmation">
            {t("settings:informationPage.deleteAccount.confirmLabel", {
              email: user?.email ?? "",
            })}
          </Label>
          <Input
            id="delete-account-confirmation"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isPending}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={user?.email ?? ""}
          />
        </div>
      </ConfirmDialog>
    </SettingsSection>
  );
}
