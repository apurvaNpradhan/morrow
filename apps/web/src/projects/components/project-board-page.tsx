import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { useProjectByKey } from "../queries/use-projects";
import { ProjectNotFound } from "./project-not-found";
import { LoadedBoardPage } from "./loaded-board-page";

type ProjectBoardPageProps = {
  workspace: { id: string; slug: string };
  projectKey: string;
};

export function ProjectBoardPage({
  workspace,
  projectKey,
}: ProjectBoardPageProps) {
  const { t } = useTranslation("projects");
  const project = useProjectByKey(workspace.id, projectKey);

  if (!project) {
    return (
      <WorkspaceLayout title={t("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }

  return <LoadedBoardPage workspace={workspace} project={project} />;
}
