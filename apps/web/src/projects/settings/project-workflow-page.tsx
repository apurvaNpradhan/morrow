import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { useWorkspacePermission } from "@/workspace";
import { ProjectSettingsFrame } from "./project-settings-frame";
import { ProjectWorkflow } from "./project-workflow";

export function ProjectWorkflowPage({
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
      tab="workflow"
      title={t("workflow.title")}
      actions={canManageProjects() ? <AutosaveNote /> : undefined}
    >
      {(project) => (
        <ProjectWorkflow workspaceId={workspace.id} project={project} />
      )}
    </ProjectSettingsFrame>
  );
}
