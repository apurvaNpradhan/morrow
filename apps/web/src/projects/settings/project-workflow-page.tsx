import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/app/settings/autosave-note";
import { useWorkspacePermission } from "@/workspace";
import { groupColumns } from "../lib/group-columns";
import { useProjectColumns } from "../queries/use-project-columns";
import { ColumnCategoryGroup } from "./column-category-group";
import { DeleteColumnDialog } from "./delete-column-dialog";
import { ProjectSettingsFrame } from "./project-settings-frame";
import type { ProjectRow } from "@morrow/sync-schemas";

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
      {(project) => <Workflow workspaceId={workspace.id} project={project} />}
    </ProjectSettingsFrame>
  );
}

function Workflow({
  workspaceId,
  project,
}: {
  workspaceId: string;
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects } = useWorkspacePermission();
  const columns = useProjectColumns(project.id);
  const [deleting, setDeleting] = useState<ProjectColumnRow | null>(null);
  const disabled = project.archivedAt !== null || !canManageProjects();

  return (
    <>
      <p className="-mt-6 text-sm text-muted-foreground">
        {t("workflow.subtitle", { name: project.name })}
      </p>
      <div className="space-y-8">
        {groupColumns(columns).map((group) => (
          <ColumnCategoryGroup
            key={group.category}
            workspaceId={workspaceId}
            projectId={project.id}
            category={group.category}
            columns={group.columns}
            allColumns={columns}
            disabled={disabled}
            onDelete={setDeleting}
          />
        ))}
      </div>
      <DeleteColumnDialog
        column={deleting}
        columns={columns}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
