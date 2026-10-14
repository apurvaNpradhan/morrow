import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { useWorkspacePermission } from "@/workspace";
import type { ProjectRow } from "@morrow/sync-schemas";
import { updateProject } from "../actions/project-actions";
import { BlurSaveInput } from "../components/blur-save-input";
import { ProjectIconPicker } from "../components/project-icon-picker";
import { ProjectArchiveSection } from "./project-archive-section";
import { ProjectBackgroundSetting } from "./project-background-setting";
import { ProjectDangerZone } from "./project-danger-zone";
import { ProjectDescriptionField } from "./project-description-field";
import { ProjectKeyField } from "./project-key-field";

export function ProjectGeneralSections({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects, canDeleteProjects } = useWorkspacePermission();
  const archived = project.archivedAt !== null;
  const locked = archived || !canManageProjects();

  async function save(patch: Parameters<typeof updateProject>[1]) {
    try {
      await updateProject(project.id, patch);
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.saveError")));
    }
  }

  return (
    <>
      <SettingsSection title={t("general.detailsTitle")}>
        <SettingsCard>
          <div className="px-4 py-3.5">
            <ProjectBackgroundSetting project={project} disabled={locked} />
          </div>
          <SettingsRow stack title={t("general.nameLabel")}>
            <BlurSaveInput
              size="sm"
              className="sm:w-64"
              aria-label={t("general.nameLabel")}
              placeholder={t("general.namePlaceholder")}
              maxLength={100}
              disabled={locked}
              value={project.name}
              onCommit={(name) => save({ name })}
            />
          </SettingsRow>
          <SettingsRow
            stack
            title={t("general.keyLabel")}
            description={t("general.keyHint", { key: project.key })}
          >
            <ProjectKeyField
              project={project}
              slug={workspace.slug}
              disabled={locked}
            />
          </SettingsRow>
          <SettingsRow stack title={t("general.descriptionLabel")}>
            <ProjectDescriptionField
              value={project.description ?? ""}
              disabled={locked}
              onCommit={(description) => save({ description })}
            />
          </SettingsRow>
          <SettingsRow
            stack
            title={t("general.iconLabel")}
            description={t("general.iconHint")}
          >
            <ProjectIconPicker
              value={project.icon}
              disabled={locked}
              fallbackLetter={project.key.charAt(0)}
              onChange={(icon) => void save({ icon })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {canManageProjects() ? (
        <ProjectArchiveSection project={project} archived={archived} />
      ) : null}

      {archived && canDeleteProjects() ? (
        <ProjectDangerZone workspace={workspace} project={project} />
      ) : null}
    </>
  );
}
