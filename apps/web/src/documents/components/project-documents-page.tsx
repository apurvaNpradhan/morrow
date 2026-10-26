import { Link, useNavigate } from "@tanstack/react-router";
import { FilePlus, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { errorMessage } from "@/app/lib/error-message";
import { PageTitle } from "@/design-system/page-title";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { ProjectNotFound, useProjectByKey } from "@/projects";
import { useWorkspacePermission } from "@/workspace";
import { createDocument } from "../actions/document-actions";
import { useDocuments } from "../queries/use-documents";
import { DocumentTree } from "./document-tree";

/** A Project's Documents tab: the same page tree as the sidebar's, filtered to the Project. */
export function ProjectDocumentsPage({
  workspace,
  projectKey,
}: {
  workspace: { id: string; slug: string };
  projectKey: string;
}) {
  const { t } = useTranslation("documents");
  const { t: tProjects } = useTranslation("projects");
  const navigate = useNavigate();
  const { canCreateDocuments } = useWorkspacePermission();
  const project = useProjectByKey(workspace.id, projectKey);
  const index = useDocuments(workspace.id);

  if (!project) {
    return (
      <WorkspaceLayout title={tProjects("board.notFoundTitle")}>
        <ProjectNotFound slug={workspace.slug} />
      </WorkspaceLayout>
    );
  }
  const scope = { projectId: project.id };
  const isEmpty = index.childrenOf(null, scope).length === 0;

  async function addPage() {
    try {
      const page = await createDocument({
        workspaceId: workspace.id,
        projectId: scope.projectId,
        parentId: null,
      });
      void navigate({
        to: "/$slug/pages/$documentId",
        params: { slug: workspace.slug, documentId: page.id },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("tree.createError")));
    }
  }

  return (
    <>
      <PageTitle title={t("project.title", { name: project.name })} />
      <WorkspaceLayout
        title={project.name}
        headerActions={
          <>
            <Button
              variant="ghost"
              size="xs"
              render={
                <Link
                  to="/$slug/projects/$key"
                  params={{ slug: workspace.slug, key: project.key }}
                />
              }
            >
              <ListChecks aria-hidden="true" />
              <span className="max-md:sr-only">{t("project.tasks")}</span>
            </Button>
            {canCreateDocuments() && !project.archivedAt ? (
              <Button size="xs" onClick={() => void addPage()}>
                <FilePlus aria-hidden="true" />
                <span className="max-md:sr-only">{t("project.newPage")}</span>
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mx-auto w-full max-w-2xl p-4">
          {isEmpty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("project.empty")}
            </p>
          ) : (
            <DocumentTree
              workspace={workspace}
              scope={scope}
              activeId={null}
              className="max-h-[70vh]"
            />
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
