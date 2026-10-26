import { Link } from "@tanstack/react-router";
import { FileX } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { errorMessage } from "@/app/lib/error-message";
import { PageTitle } from "@/design-system/page-title";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/design-system/ui/empty";
import { Skeleton } from "@/design-system/ui/skeleton";
import { BlurSaveInput, useProjectsWithoutSuspense } from "@/projects";
import { useWorkspacePermission } from "@/workspace";
import { updateDocument } from "../actions/document-actions";
import { useDocuments } from "../queries/use-documents";

const PageEditor = lazy(() =>
  import("./page-editor").then((m) => ({ default: m.PageEditor })),
);

/**
 * A page on its own address: its title, and its text edited live with
 * everyone else on it. An unknown page, a page in another Workspace and an
 * archived-and-gone one all read "not found".
 */
export function DocumentPage({
  workspace,
  userId,
  documentId,
}: {
  workspace: { id: string; slug: string };
  userId: string;
  documentId: string;
}) {
  const { t } = useTranslation("documents");
  const { canEditDocuments } = useWorkspacePermission();
  const index = useDocuments(workspace.id);
  const projects = useProjectsWithoutSuspense(workspace.id);
  const document = index.byId.get(documentId);
  const project = projects.find(
    (candidate) => candidate.id === document?.projectId,
  );
  const archived =
    !!document && (index.hidden.has(document.id) || !!project?.archivedAt);
  const canEdit = canEditDocuments();
  if (!document) {
    return (
      <WorkspaceLayout title={t("notFound.title")}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileX aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("notFound.title")}</EmptyTitle>
            <EmptyDescription>{t("notFound.description")}</EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/$slug" params={{ slug: workspace.slug }} />}
          >
            {t("notFound.back")}
          </Button>
        </Empty>
      </WorkspaceLayout>
    );
  }

  const title = document.title || t("untitled");
  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout title={title}>
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {archived ? (
            <p className="mb-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t("archivedNotice")}
            </p>
          ) : null}
          {document.overLimit ? (
            <p className="mb-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t("overLimitNotice")}
            </p>
          ) : null}
          <BlurSaveInput
            aria-label={t("titleLabel")}
            placeholder={t("untitled")}
            value={document.title}
            readOnly={!canEdit || archived}
            isAcceptable={() => true}
            className="mb-4 border-0 px-0 text-3xl font-semibold shadow-none focus-visible:ring-0"
            onCommit={(next) =>
              updateDocument(document.id, { title: next }).catch(
                (error: unknown) =>
                  toast.error(errorMessage(t, error, t("tree.renameError"))),
              )
            }
          />
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PageEditor
              workspaceId={workspace.id}
              userId={userId}
              documentId={document.id}
              generation={document.generation}
              canEdit={canEdit && !archived}
              readOnly={!canEdit || archived}
            />
          </Suspense>
        </div>
      </WorkspaceLayout>
    </>
  );
}
