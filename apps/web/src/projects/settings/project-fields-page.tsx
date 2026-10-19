import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { useWorkspacePermission } from "@/workspace";
import { ProjectFields } from "./project-fields";
import { ProjectSettingsFrame } from "./project-settings-frame";

export function ProjectFieldsPage({
  workspace,
  projectKey,
}: {
  workspace: { id: string; slug: string };
  projectKey: string;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects } = useWorkspacePermission();

  return (
    <ProjectSettingsFrame
      workspace={workspace}
      projectKey={projectKey}
      tab="fields"
      title={t("fields.title")}
      actions={canManageProjects() ? <AutosaveNote /> : undefined}
    >
      {(project) => (
        <ProjectFields workspaceId={workspace.id} project={project} />
      )}
    </ProjectSettingsFrame>
  );
}
