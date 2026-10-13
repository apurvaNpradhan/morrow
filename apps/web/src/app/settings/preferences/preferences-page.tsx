import { useTranslation } from "react-i18next";
import { ThemePicker } from "@/account";
import { AdvancedSettingsSwitch } from "@/app/settings/advanced-settings-switch";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsPage } from "@/app/settings/settings-page";
import { SettingsSection } from "@/app/settings/settings-section";
import { useUserPreferencesStore } from "@/app/store/user-preferences";
import { LanguageRow } from "./language-row";
import { SidebarDefaultRow } from "./sidebar-default-row";
import { WeekStartRow } from "./week-start-row";

export function PreferencesPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useUserPreferencesStore();

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
          <WeekStartRow />
          <SidebarDefaultRow />
        </SettingsCard>
      </SettingsSection>

      <AdvancedSettingsSwitch />
    </SettingsPage>
  );
}
