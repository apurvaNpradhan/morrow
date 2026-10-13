import { ShieldCheckIcon, UserRoundCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/design-system/ui/badge";

export function UserRoleBadge({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge variant={isAdmin ? "outline" : "secondary"} className="gap-1">
      {isAdmin ? (
        <ShieldCheckIcon aria-hidden="true" />
      ) : (
        <UserRoundCheckIcon aria-hidden="true" />
      )}
      {isAdmin
        ? t("settings:adminUsers.roles.admin")
        : t("settings:adminUsers.roles.user")}
    </Badge>
  );
}
