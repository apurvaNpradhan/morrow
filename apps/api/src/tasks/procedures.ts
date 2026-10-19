import { MAX_TASK_LABELS } from "@morrow/sync-schemas";
import { z } from "zod";
import {
  authed,
  requireWorkspacePermission,
  userCan,
} from "#api/platform/orpc/base";
import { archiveColumn } from "./operations/archive-column";
import { bulkRemoveTasks } from "./operations/bulk-remove-tasks";
import { bulkUpdateTasks } from "./operations/bulk-update-tasks";
import { createTask } from "./operations/create-task";
import { deleteTask } from "./operations/delete-task";
import { duplicateTask } from "./operations/duplicate-task";
import { exportTasks } from "./operations/export-tasks";
import { getTask } from "./operations/get-task";
import { importTasks } from "./operations/import-tasks";
import { listTasks } from "./operations/list-tasks";
import { moveTask } from "./operations/move-task";
import { searchTasks, SEARCH_TASKS_MAX } from "./operations/search-tasks";
import { setFieldValue } from "./operations/set-field-value";
import { setTaskLabel } from "./operations/set-task-label";
import { setTaskArchived } from "./operations/set-task-archived";
import { updateTask } from "./operations/update-task";
import {
  archivedColumnResult,
  bulkResult,
  createdResult,
  exportDocument,
  importResult,
  taskDetail,
  taskSearchResult,
  taskListItem,
  txidResult,
} from "./response";
import {
  assigneeId,
  bulkChange,
  bulkTaskIds,
  columnId,
  description,
  dueDate,
  fieldId,
  fieldValue,
  fieldValues,
  labelId,
  newTaskId,
  position,
  priority,
  projectId,
  taskId,
  title,
  workspaceId,
} from "./schemas";

const canRead = requireWorkspacePermission({ workspace: ["read"] });
const canCreate = requireWorkspacePermission({ task: ["create"] });
const canUpdate = requireWorkspacePermission({ task: ["update"] });
const canDuplicate = requireWorkspacePermission({
  task: ["create", "update"],
});
const canDelete = requireWorkspacePermission({ task: ["delete"] });

const forProject = z.object({ workspaceId, projectId });
const forTask = forProject.extend({ taskId });

/** The caller, with whether their role may hand tasks to other people. */
async function actorOf(
  context: { user: { id: string; email: string; role?: string | null } },
  workspace: string,
) {
  return {
    userId: context.user.id,
    email: context.user.email,
    canAssign: await userCan(context.user, workspace, { task: ["assign"] }),
  };
}

const list = authed
  .input(forProject)
  .use(canRead)
  .output(z.array(taskListItem))
  .handler(({ input }) => listTasks(input.workspaceId, input.projectId));

const search = authed
  .input(
    z.object({
      workspaceId,
      projectId: projectId.optional(),
      assignee: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('"me" or a member\'s email.'),
      label: z.string().trim().min(1).optional(),
      column: z.string().trim().min(1).optional(),
      query: z.string().trim().min(1).max(200).optional(),
      includeArchived: z.boolean().default(false),
      limit: z
        .number()
        .int()
        .min(1)
        .max(SEARCH_TASKS_MAX)
        .default(SEARCH_TASKS_MAX),
    }),
  )
  .use(canRead)
  .output(taskSearchResult)
  .handler(({ input, context }) =>
    searchTasks(input.workspaceId, {
      projectId: input.projectId,
      ...(input.assignee === "me"
        ? { assigneeId: context.user.id }
        : { assigneeEmail: input.assignee }),
      label: input.label,
      column: input.column,
      query: input.query,
      includeArchived: input.includeArchived,
      limit: input.limit,
    }),
  );

const get = authed
  .input(forProject.extend({ ticketId: z.string().trim().min(1) }))
  .use(canRead)
  .output(taskDetail)
  .handler(({ input }) =>
    getTask(input.workspaceId, input.projectId, input.ticketId),
  );

const create = authed
  .input(
    forProject.extend({
      id: newTaskId,
      columnId,
      position,
      title,
      description: description.optional(),
      priority: priority.optional(),
      assigneeId: assigneeId.nullable().optional(),
      dueDate: dueDate.nullable().optional(),
      labelIds: z.array(labelId).max(MAX_TASK_LABELS).optional(),
      fieldValues: fieldValues.optional(),
    }),
  )
  .use(canCreate)
  .output(createdResult)
  .handler(async ({ input, context }) => {
    const { workspaceId: workspace, projectId: project, ...task } = input;
    return createTask(
      workspace,
      project,
      await actorOf(context, workspace),
      task,
    );
  });

const updateTitle = authed
  .input(forTask.extend({ title }))
  .use(canUpdate)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    updateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { title: input.title },
    ),
  );

const updateDescription = authed
  .input(forTask.extend({ description }))
  .use(canUpdate)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    updateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { description: input.description },
    ),
  );

const updatePriority = authed
  .input(forTask.extend({ priority }))
  .use(canUpdate)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    updateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { priority: input.priority },
    ),
  );

const updateDueDate = authed
  .input(forTask.extend({ dueDate: dueDate.nullable() }))
  .use(canUpdate)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    updateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { dueDate: input.dueDate },
    ),
  );

const updateAssignee = authed
  .input(forTask.extend({ assigneeId: assigneeId.nullable() }))
  .use(canUpdate)
  .output(txidResult)
  .handler(async ({ input, context }) =>
    updateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { assigneeId: input.assigneeId },
    ),
  );

const addLabel = authed
  .input(forTask.extend({ labelId }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setTaskLabel(
      input.workspaceId,
      input.projectId,
      input.taskId,
      input.labelId,
      true,
    ),
  );

const removeLabel = authed
  .input(forTask.extend({ labelId }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setTaskLabel(
      input.workspaceId,
      input.projectId,
      input.taskId,
      input.labelId,
      false,
    ),
  );

const updateFieldValue = authed
  .input(forTask.extend({ fieldId, value: fieldValue }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setFieldValue(
      input.workspaceId,
      input.projectId,
      input.taskId,
      input.fieldId,
      input.value,
    ),
  );

const move = authed
  .input(forTask.extend({ columnId, position }))
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    moveTask(input.workspaceId, input.projectId, input.taskId, {
      columnId: input.columnId,
      position: input.position,
    }),
  );

const archive = authed
  .input(forTask)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setTaskArchived(input.workspaceId, input.projectId, input.taskId, true),
  );

const unarchive = authed
  .input(forTask)
  .use(canUpdate)
  .output(txidResult)
  .handler(({ input }) =>
    setTaskArchived(input.workspaceId, input.projectId, input.taskId, false),
  );

const archiveCompleted = authed
  .input(forProject.extend({ columnId }))
  .use(canUpdate)
  .output(archivedColumnResult)
  .handler(({ input }) =>
    archiveColumn(input.workspaceId, input.projectId, input.columnId),
  );

const duplicate = authed
  .input(forTask.extend({ id: newTaskId, position }))
  .use(canDuplicate)
  .output(createdResult)
  .handler(async ({ input, context }) =>
    duplicateTask(
      input.workspaceId,
      input.projectId,
      input.taskId,
      await actorOf(context, input.workspaceId),
      { id: input.id, position: input.position },
    ),
  );

const remove = authed
  .input(forTask)
  .use(canDelete)
  .output(txidResult)
  .handler(({ input }) =>
    deleteTask(input.workspaceId, input.projectId, input.taskId),
  );

const bulkUpdate = authed
  .input(forProject.extend({ taskIds: bulkTaskIds, change: bulkChange }))
  .use(canUpdate)
  .output(bulkResult)
  .handler(async ({ input, context }) =>
    bulkUpdateTasks(
      input.workspaceId,
      input.projectId,
      await actorOf(context, input.workspaceId),
      input.taskIds,
      input.change,
    ),
  );

const bulkRemove = authed
  .input(forProject.extend({ taskIds: bulkTaskIds }))
  .use(canDelete)
  .output(bulkResult)
  .handler(({ input }) =>
    bulkRemoveTasks(input.workspaceId, input.projectId, input.taskIds),
  );

const exportProject = authed
  .input(forProject)
  .use(canRead)
  .output(exportDocument)
  .handler(({ input }) => exportTasks(input.workspaceId, input.projectId));

const importProject = authed
  .input(forProject.extend({ document: z.unknown() }))
  .use(canCreate)
  .output(importResult)
  .handler(async ({ input, context }) =>
    importTasks(
      input.workspaceId,
      input.projectId,
      {
        ...(await actorOf(context, input.workspaceId)),
        canCreateLabels: await userCan(context.user, input.workspaceId, {
          label: ["create"],
        }),
        canDefineFields: await userCan(context.user, input.workspaceId, {
          project: ["update"],
        }),
      },
      input.document,
    ),
  );

export const tasksRouter = {
  list,
  search,
  get,
  create,
  updateTitle,
  updateDescription,
  updatePriority,
  updateDueDate,
  updateAssignee,
  addLabel,
  removeLabel,
  setFieldValue: updateFieldValue,
  move,
  archive,
  unarchive,
  archiveCompleted,
  duplicate,
  remove,
  bulkUpdate,
  bulkRemove,
  export: exportProject,
  import: importProject,
};
