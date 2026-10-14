import type { ProjectColumnRow, ProjectRow } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspacePermission } from "@/workspace";
import { groupColumns } from "../lib/group-columns";
import { useProjectColumns } from "../queries/use-project-columns";
import { ColumnCategoryGroup } from "./column-category-group";
import { DeleteColumnDialog } from "./delete-column-dialog";

export function ProjectWorkflow({
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
