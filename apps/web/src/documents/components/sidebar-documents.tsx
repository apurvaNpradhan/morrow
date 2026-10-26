import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProjectIcon, useProjectsWithoutSuspense } from "@/projects";
import { useDocuments } from "../queries/use-documents";
import { DocumentGroup } from "./document-group";

/**
 * The Workspace's pages in the sidebar: the pages that belong to no Project,
 * then one group for each Project that has pages.
 */
export function SidebarDocuments({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("documents");
  const { documentId } = useParams({ strict: false });
  const index = useDocuments(workspace.id);
  const projects = useProjectsWithoutSuspense(workspace.id).filter(
    (project) =>
      !project.archivedAt &&
      index.childrenOf(null, { projectId: project.id }).length > 0,
  );
  const activeId = documentId ?? null;

  return (
    <>
      <DocumentGroup
        workspace={workspace}
        scope={{ projectId: null }}
        title={t("sidebar.title")}
        activeId={activeId}
      />
      {projects.map((project) => (
        <DocumentGroup
          key={project.id}
          workspace={workspace}
          scope={{ projectId: project.id }}
          title={project.name}
          icon={<ProjectIcon project={project} />}
          activeId={activeId}
        />
      ))}
    </>
  );
}
