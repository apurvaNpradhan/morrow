import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/app/settings/settings-row";
import {
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import { Label } from "@/design-system/ui/label";
import { Switch } from "@/design-system/ui/switch";

export function ProjectBackgroundsRow() {
  const { t } = useTranslation();
  const { showProjectBackgrounds } = useDevicePreferences();

  return (
    <SettingsRow
      title={
        <Label htmlFor="show-project-backgrounds">
          {t("settings:preferencesPage.projectBackgrounds")}
        </Label>
      }
      description={t("settings:preferencesPage.projectBackgroundsDescription")}
    >
      <Switch
        id="show-project-backgrounds"
        checked={showProjectBackgrounds}
        onCheckedChange={(show) =>
          saveDevicePreferences({ showProjectBackgrounds: show })
        }
      />
    </SettingsRow>
  );
}
