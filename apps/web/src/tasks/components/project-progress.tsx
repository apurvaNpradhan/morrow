import { useTranslation } from "react-i18next";
import { colorTextStyle } from "@/projects";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import { completion } from "../lib/completion";
import { useColumnCounts } from "../queries/use-column-counts";
import { useTaskView } from "./task-view-context";

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A donut of the Project's tasks by Column, in the Columns' colours, with the
 * completion percentage. Hover for the count of each Column.
 */
export function ProjectProgress() {
  const { t } = useTranslation("tasks");
  const { workspace, project, columns } = useTaskView();
  const counts = useColumnCounts(workspace.id, project.id);
  if (!counts) return null;
  const { segments, total, percent } = completion(columns, counts);
  if (total === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground" />
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 -rotate-90"
        >
          <circle
            cx="12"
            cy="12"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-muted"
          />
          {segments.map(({ column, count, before }) => {
            const share = (count / total) * CIRCUMFERENCE;
            // A hairline gap keeps neighbouring Columns apart.
            const length =
              segments.length > 1 ? Math.max(share - 1, 0.5) : share;
            return (
              <circle
                key={column.id}
                cx="12"
                cy="12"
                r={RADIUS}
                fill="none"
                strokeWidth="4"
                stroke="currentColor"
                style={colorTextStyle(column.color)}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-(before / total) * CIRCUMFERENCE}
              />
            );
          })}
        </svg>
        {t("progress.percent", { percent })}
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {segments.map(({ column, count }) => (
            <li key={column.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-current"
                style={colorTextStyle(column.color)}
              />
              <span className="me-auto">{column.name}</span>
              <span className="tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
