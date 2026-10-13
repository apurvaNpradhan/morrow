import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/app/settings/settings-row";
import { useUserPreferencesStore } from "@/app/store/user-preferences";
import { Label } from "@/design-system/ui/label";
import { Switch } from "@/design-system/ui/switch";

export function SidebarDefaultRow() {
  const { t } = useTranslation();
  const { sidebarDefaultOpen, setSidebarDefaultOpen } =
    useUserPreferencesStore();

  return (
    <SettingsRow
      title={
        <Label htmlFor="sidebar-default-open">
          {t("settings:preferencesPage.sidebarDefault")}
        </Label>
      }
      description={t("settings:preferencesPage.sidebarDefaultDescription")}
    >
      <Switch
        id="sidebar-default-open"
        checked={sidebarDefaultOpen}
        onCheckedChange={setSidebarDefaultOpen}
      />
    </SettingsRow>
  );
}
