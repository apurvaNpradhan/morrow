import { useTranslation } from "react-i18next";
import { ThemePicker } from "@/account";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsPage } from "@/app/settings/settings-page";
import { SettingsSection } from "@/app/settings/settings-section";
import { setTheme } from "@/app/preferences/set-theme";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";
import { LanguageRow } from "./language-row";
import { ProjectBackgroundsRow } from "./project-backgrounds-row";
import { SidebarDefaultRow } from "./sidebar-default-row";
import { TaskDetailsSection } from "./task-details-section";

export function PreferencesPage() {
  const { t } = useTranslation();
  const { theme } = useDevicePreferences();

  return (
    <SettingsPage
      title={t("settings:preferencesPage.title")}
      description={t("settings:preferencesPage.subtitle")}
    >
      <SettingsSection
        title={t("settings:preferencesPage.theme")}
        description={t("settings:preferencesPage.themeDescription")}
      >
        <ThemePicker value={theme} onChange={setTheme} />
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferencesPage.appearanceTitle")}
        description={t("settings:preferencesPage.appearanceSubtitle")}
      >
        <SettingsCard>
          <LanguageRow />
          <SidebarDefaultRow />
          <ProjectBackgroundsRow />
        </SettingsCard>
      </SettingsSection>

      <TaskDetailsSection />
    </SettingsPage>
  );
}
