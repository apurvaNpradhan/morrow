import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/app/settings/status-badge";

export function UserStatus({ deactivated }: { deactivated: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusBadge tone={deactivated ? "destructive" : "success"}>
      {deactivated
        ? t("settings:adminUsers.status.deactivated")
        : t("settings:adminUsers.status.active")}
    </StatusBadge>
  );
}
