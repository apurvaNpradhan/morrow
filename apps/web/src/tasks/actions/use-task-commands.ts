import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Command } from "@/app/commands/use-commands";
import { useContributeCommands } from "@/app/commands/contributed-commands";
import { taskCollection } from "../collections/task-collection";
import { taskHotkeysAllowed } from "../lib/hotkey-scope";
import { getActiveTaskId, useActiveTaskId } from "../lib/active-task-store";
import { focusedTaskId, displayTicketId } from "../lib/task-links";
import { useTaskView } from "../components/task-view-context";
import { COPY_KINDS, useCopyTask } from "./use-copy-task";

/** The focused task, else the one last focused or open. */
function currentTask() {
  const id = focusedTaskId() ?? getActiveTaskId();
  return id ? taskCollection.get(id) : undefined;
}

/**
 * The commands for the current task (the palette lists them while a task is
 * focused or open) and the shortcut that copies its branch name. Mounted by
 * the project page and by the task page.
 */
export function useTaskCommands() {
  const { t } = useTranslation("tasks");
  const navigate = useNavigate();
  const hotkeys = useAppHotkeys();
  const { workspace, project } = useTaskView();
  const copyTask = useCopyTask();
  const activeId = useActiveTaskId();

  const commands = useMemo<Command[]>(() => {
    if (!activeId) return [];
    const run =
      (action: (task: NonNullable<ReturnType<typeof currentTask>>) => void) =>
      () => {
        const task = currentTask();
        if (task) action(task);
      };
    return [
      {
        id: "task.openFullPage",
        group: "task",
        label: t("menu.openFullPage"),
        run: run((task) => {
          if (task.number === 0) return;
          void navigate({
            to: "/$slug/tasks/$ticketId",
            params: {
              slug: workspace.slug,
              ticketId: displayTicketId(project.key, task.number),
            },
          });
        }),
      },
      ...COPY_KINDS.map((kind): Command => ({
        id: `task.copy.${kind}`,
        group: "task",
        label: t(`copy.${kind}`),
        hotkey: kind === "branch" ? "copyTaskBranch" : undefined,
        run: run((task) => void copyTask(kind, task)),
      })),
    ];
  }, [activeId, t, navigate, workspace.slug, project.key, copyTask]);
  useContributeCommands("tasks", commands);

  useHotkeys([
    {
      hotkey: hotkeys.copyTaskBranch,
      callback: () => {
        if (!taskHotkeysAllowed()) return;
        const task = currentTask();
        if (task) void copyTask("branch", task);
      },
    },
  ]);
}
