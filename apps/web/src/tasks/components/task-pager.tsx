import type { TaskRow } from "@morrow/sync-schemas";
import { useHotkeys, useAppHotkeys } from "@tanstack/react-hotkeys";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TooltipLabel } from "@/design-system/tooltip-label";
import { Button } from "@/design-system/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import { taskHotkeysAllowed } from "../lib/hotkey-scope";
import { placeInOrder } from "../lib/view-order-store";
import { useTaskView } from "./task-view-context";

/** Whether the focus is in a field where arrow keys move a cursor. */
function isEditing(element: Element | null) {
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable ||
      element.matches("input, textarea, select, [role='textbox']"))
  );
}

/**
 * "4 / 5" with buttons to the next and previous task of the list or board the
 * page was opened from. `J` and `K` step as they do on the board; the arrow
 * keys do too, unless the cursor is in a text field. A page opened cold has no
 * list behind it and shows nothing.
 */
export function TaskPager({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { openTask } = useTaskView();
  const hotkeys = useAppHotkeys();
  const place = placeInOrder(task.id);

  const step = (delta: 1 | -1) => {
    const target = delta === 1 ? place?.next : place?.previous;
    if (target) openTask(target);
  };
  const guarded = (delta: 1 | -1) => () => {
    if (taskHotkeysAllowed()) step(delta);
  };
  useHotkeys([
    { hotkey: hotkeys.nextTask, callback: guarded(1) },
    { hotkey: hotkeys.previousTask, callback: guarded(-1) },
    {
      hotkey: "ArrowDown",
      callback: () => {
        if (!isEditing(document.activeElement)) guarded(1)();
      },
    },
    {
      hotkey: "ArrowUp",
      callback: () => {
        if (!isEditing(document.activeElement)) guarded(-1)();
      },
    },
  ]);

  if (!place || place.total < 2) return null;
  return (
    <div className="flex items-center gap-0.5">
      <span
        className="px-1.5 text-xs text-muted-foreground tabular-nums"
        aria-label={t("pager.position", {
          position: place.position,
          total: place.total,
        })}
      >
        {place.position} / {place.total}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("pager.next")}
              disabled={!place.next}
              onClick={() => step(1)}
            />
          }
        >
          <ChevronDown aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          <TooltipLabel label={t("pager.next")} hotkeyId="nextTask" />
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("pager.previous")}
              disabled={!place.previous}
              onClick={() => step(-1)}
            />
          }
        >
          <ChevronUp aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          <TooltipLabel label={t("pager.previous")} hotkeyId="previousTask" />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
