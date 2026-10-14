import { useTranslation } from "react-i18next";
import { ProjectGeneralSections } from "./project-general-sections";
import { ProjectSettingsFrame } from "./project-settings-frame";

export function ProjectGeneralPage({
  workspace,
  projectKey,
}: {
  workspace: { id: string; slug: string };
  projectKey: string;
}) {
  const { t } = useTranslation("projects");

  return (
    <ProjectSettingsFrame
      workspace={workspace}
      projectKey={projectKey}
      tab="general"
      title={t("general.title")}
    >
      {(project) => (
        <ProjectGeneralSections workspace={workspace} project={project} />
      )}
    </ProjectSettingsFrame>
  );
}
