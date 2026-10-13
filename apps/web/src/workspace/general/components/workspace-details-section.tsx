import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsFormRow } from "@/app/settings/settings-form-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { WorkspaceSlugSettings } from "@/app/settings/workspace-slug-settings";
import { Form, FormField } from "@/design-system/ui/form";
import { Input } from "@/design-system/ui/input";
import { WorkspaceLogoSetting } from "@/workspace/logo/workspace-logo-setting";
import type { WorkspaceFormValues } from "@/workspace/general/workspace-form-values";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function WorkspaceDetailsSection({
  workspace,
  form,
  canEdit,
}: {
  workspace: Workspace | null | undefined;
  form: UseFormReturn<WorkspaceFormValues>;
  canEdit: boolean;
}) {
  const { t } = useTranslation();

  return (
    <SettingsSection
      title={t("settings:workspaceGeneral.workspaceInfoTitle")}
      description={t("settings:workspaceGeneral.workspaceInfoSubtitle")}
    >
      <SettingsCard>
        {workspace ? (
          <div className="px-4 py-3.5">
            <WorkspaceLogoSetting
              workspaceId={workspace.id}
              name={workspace.name}
              logo={workspace.logo}
              disabled={!canEdit}
            />
          </div>
        ) : null}
        <Form {...form}>
          <form onSubmit={(event) => event.preventDefault()}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:workspaceGeneral.nameLabel")}
                  description={t("settings:workspaceGeneral.nameHint")}
                >
                  <Input
                    className="w-full sm:w-64"
                    placeholder={t("settings:workspaceGeneral.namePlaceholder")}
                    disabled={!canEdit}
                    {...field}
                  />
                </SettingsFormRow>
              )}
            />
            <div className="border-t border-border">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <SettingsFormRow
                    label={t("settings:workspaceGeneral.descriptionLabel")}
                    description={t("settings:workspaceGeneral.descriptionHint")}
                  >
                    <Input
                      className="w-full sm:w-64"
                      placeholder={t(
                        "settings:workspaceGeneral.descriptionPlaceholder",
                      )}
                      disabled={!canEdit}
                      {...field}
                    />
                  </SettingsFormRow>
                )}
              />
            </div>
          </form>
        </Form>
        {workspace ? (
          <div className="px-4 py-3.5">
            <WorkspaceSlugSettings
              key={workspace.slug}
              workspaceId={workspace.id}
              slug={workspace.slug}
              canEdit={canEdit}
            />
          </div>
        ) : null}
      </SettingsCard>
      {canEdit ? <AutosaveNote /> : null}
    </SettingsSection>
  );
}
