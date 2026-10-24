import type { ProjectRow } from "@morrow/sync-schemas";
import type { ReactNode } from "react";
import { useTimeZone } from "@/app/hooks/use-time-zone";
import { useProjectColumns, useProjectFields } from "@/projects";
import { useLabels } from "@/labels";
import { useWorkspacePermission } from "@/workspace";
import { statusFractions } from "../lib/status-fraction";
import { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { useToday } from "../queries/use-today";
import { useWorkspacePeople } from "../queries/use-workspace-people";
import { TaskViewProvider, type TaskViewValue } from "./task-view-context";

/**
 * What a Project's board, list, sheet and full-page task all read through
 * `useTaskView`: its columns, labels, people, the user's permissions and the
 * device's display preferences.
 */
export function ProjectTaskViewProvider({
  workspace,
  project,
  openTask,
  switchLayout,
  children,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
  openTask: TaskViewValue["openTask"];
  switchLayout: TaskViewValue["switchLayout"];
  children: ReactNode;
}) {
  const permission = useWorkspacePermission();
  const columns = useProjectColumns(project.id);
  const fields = useProjectFields(project.id);
  const { people, byId, meId } = useWorkspacePeople(workspace.id);
  const { labels, labelById } = useLabels(workspace.id);
  const today = useToday();
  const timeZone = useTimeZone();
  const preferences = useTaskViewPreferences(project.id);

  return (
    <TaskViewProvider
      value={{
        workspace,
        project,
        columns,
        columnById: new Map(columns.map((column) => [column.id, column])),
        statusFractions: statusFractions(columns),
        fields,
        fieldById: new Map(fields.map((field) => [field.id, field])),
        showsField: preferences.showsField,
        labels,
        labelById,
        people,
        personById: byId,
        meId,
        today,
        timeZone,
        display: preferences.display,
        can: {
          create: permission.canCreateTasks(),
          edit: permission.canEditTasks(),
          delete: permission.canDeleteTasks(),
          assign: permission.canAssignTasks(),
          createLabel: permission.canCreateLabels(),
          comment: permission.canCreateComments(),
          moderateComments: permission.canDeleteComments(),
        },
        frozen: project.archivedAt !== null,
        openTask,
        switchLayout,
      }}
    >
      {children}
    </TaskViewProvider>
  );
}
