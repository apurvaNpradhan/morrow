import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { isClosedCategory } from "@morrow/sync-schemas";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { Button } from "@/design-system/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import { useTaskActions } from "../actions/use-task-actions";
import { TooltipLabel } from "@/design-system/tooltip-label";
import { openCreateTask } from "../lib/create-task-store";
import { ColumnMarker } from "./column-marker";
import { useTaskView } from "./task-view-context";

/**
 * A Column's header on the board and in the list: its marker, name and the
 * count of tasks shown, a "+" that creates a task in it and, for done and
 * canceled Columns with tasks, a button that archives them all.
 */
export function LaneHeader({
  column,
  count,
}: {
  column: ProjectColumnRow;
  /** Tasks shown, or null for a collapsed group whose tasks are not loaded. */
  count: number | null;
}) {
  const { t } = useTranslation("tasks");
  const { project, can, frozen } = useTaskView();
  const actions = useTaskActions();
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function archiveAll() {
    setArchiving(true);
    await actions.archiveCompleted(column.id);
    setArchiving(false);
    setConfirming(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <ColumnMarker column={column} className="size-4" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {column.name}
        </h2>
        {count !== null ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
        {can.edit &&
        !frozen &&
        isClosedCategory(column.category) &&
        count !== null &&
        count > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("archiveCompleted.button", {
                    name: column.name,
                  })}
                  onClick={() => setConfirming(true)}
                />
              }
            >
              <Archive aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{t("archiveCompleted.tooltip")}</TooltipContent>
          </Tooltip>
        ) : null}
        {can.create && !frozen ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("lane.create", { name: column.name })}
                  onClick={() =>
                    openCreateTask({
                      projectId: project.id,
                      columnId: column.id,
                    })
                  }
                />
              }
            >
              <Plus aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              <TooltipLabel
                label={t("lane.createTooltip")}
                hotkeyId="createTask"
              />
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("archiveCompleted.title", { count: count ?? 0 })}
        description={t("archiveCompleted.description", { name: column.name })}
        confirmLabel={t("archiveCompleted.confirm")}
        destructive={false}
        pending={archiving}
        onConfirm={() => void archiveAll()}
      />
    </>
  );
}
