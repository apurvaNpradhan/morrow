import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { cn } from "@/design-system/cn";
import { PageTitle } from "@/design-system/page-title";
import { Button } from "@/design-system/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/design-system/ui/empty";
import { useWorkspacePermission } from "@/workspace";
import { useProjects } from "../queries/use-projects";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectsList } from "./projects-list";

type Tab = "active" | "archived";

export function ProjectsPage({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("projects");
  const { canCreateProjects, canManageProjects } = useWorkspacePermission();
  const projects = useProjects(workspace.id);
  const [tab, setTab] = useState<Tab>("active");
  const [creating, setCreating] = useState(false);

  const active = projects.filter((project) => !project.archivedAt);
  const archived = projects.filter((project) => project.archivedAt);
  const shown = tab === "active" ? active : archived;
  const canCreate = canCreateProjects();

  return (
    <>
      <PageTitle title={t("pageTitle")} />
      <WorkspaceLayout
        title={t("list.title")}
        headerActions={
          canCreate ? (
            <Button size="xs" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t("list.create")}
            </Button>
          ) : null
        }
      >
        <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {t("list.title")}
            </h1>
            <div
              role="tablist"
              aria-label={t("list.tabsLabel")}
              className="inline-flex rounded-lg border bg-muted/40 p-0.5"
            >
              {(["active", "archived"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    tab === value && "bg-background text-foreground shadow-xs",
                  )}
                >
                  {t(`list.${value}`)}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    {value === "active" ? active.length : archived.length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {shown.length > 0 ? (
            <ProjectsList
              slug={workspace.slug}
              projects={shown}
              allProjects={projects}
              // Archived projects keep their place; only active ones reorder.
              canReorder={canManageProjects() && tab === "active"}
              canOpenSettings={canManageProjects()}
            />
          ) : (
            <Empty className="rounded-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                  {tab === "active"
                    ? t("list.emptyTitle")
                    : t("list.emptyArchivedTitle")}
                </EmptyTitle>
                <EmptyDescription>
                  {tab === "archived"
                    ? t("list.emptyArchivedDescription")
                    : canCreate
                      ? t("list.emptyDescription")
                      : t("list.emptyReadOnly")}
                </EmptyDescription>
              </EmptyHeader>
              {tab === "active" && canCreate ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" />
                  {t("list.create")}
                </Button>
              ) : null}
            </Empty>
          )}
        </main>
      </WorkspaceLayout>
      <CreateProjectDialog
        workspace={workspace}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}
