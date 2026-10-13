import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { Button } from "@/design-system/ui/button";
import { errorMessageKey } from "@/app/lib/orpc-error";
import { rpc } from "@/app/lib/orpc";
import { toast } from "@/design-system/toast";

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportData() {
  const { t } = useTranslation();
  const { mutate, isPending } = useMutation({
    mutationFn: () => rpc.account.export(),
    onSuccess: (data) => {
      downloadJson(data, "morrow-export.json");
      toast.success(t("settings:informationPage.exportData.success"));
    },
    onError: (error) => toast.error(t(errorMessageKey(error))),
  });

  return (
    <SettingsCard>
      <SettingsRow
        stack
        title={t("settings:informationPage.exportData.title")}
        description={
          <>
            {t("settings:informationPage.exportData.description")}{" "}
            <Link to="/privacy" className="underline">
              {t("settings:informationPage.exportData.privacyLink")}
            </Link>
          </>
        }
      >
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={isPending}
          onClick={() => mutate()}
        >
          {isPending
            ? t("settings:informationPage.exportData.exporting")
            : t("settings:informationPage.exportData.button")}
        </Button>
      </SettingsRow>
    </SettingsCard>
  );
}
