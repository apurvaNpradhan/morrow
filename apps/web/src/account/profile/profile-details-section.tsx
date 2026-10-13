import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsFormRow } from "@/app/settings/settings-form-row";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { useAuth } from "@/auth";
import { Form, FormField } from "@/design-system/ui/form";
import { Input } from "@/design-system/ui/input";
import { AvatarRow } from "./avatar-row";
import { useProfileNameAutosave } from "./use-profile-name-autosave";

export function ProfileDetailsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const form = useProfileNameAutosave();

  return (
    <SettingsSection
      title={t("settings:informationPage.sectionTitle")}
      description={t("settings:informationPage.sectionSubtitle")}
    >
      <SettingsCard>
        <AvatarRow />
        <Form {...form}>
          <form onSubmit={(event) => event.preventDefault()}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow label={t("settings:informationPage.fullName")}>
                  <Input
                    className="w-full sm:w-64"
                    placeholder={t(
                      "settings:informationPage.fullNamePlaceholder",
                    )}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
          </form>
        </Form>
        <SettingsRow stack title={t("settings:informationPage.email")}>
          <Input
            className="w-full sm:w-64"
            aria-label={t("settings:informationPage.email")}
            disabled
            readOnly
            value={user?.email ?? ""}
          />
        </SettingsRow>
      </SettingsCard>
      <AutosaveNote />
    </SettingsSection>
  );
}
