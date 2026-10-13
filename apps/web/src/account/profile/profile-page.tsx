import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/app/settings/settings-page";
import { SettingsSection } from "@/app/settings/settings-section";
import { PageTitle } from "@/design-system/page-title";
import { ExportData } from "@/account/components/export-data";
import { DeleteAccountSection } from "./delete-account-section";
import { ProfileDetailsSection } from "./profile-details-section";

export function ProfilePage() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:informationPage.pageTitle")} />
      <SettingsPage
        title={t("settings:informationPage.title")}
        description={t("settings:informationPage.subtitle")}
      >
        <ProfileDetailsSection />
        <SettingsSection
          title={t("settings:informationPage.exportData.sectionTitle")}
          description={t("settings:informationPage.exportData.sectionSubtitle")}
        >
          <ExportData />
        </SettingsSection>
        <DeleteAccountSection />
      </SettingsPage>
    </>
  );
}
