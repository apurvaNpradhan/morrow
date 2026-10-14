import type { ProjectColumnRow, ProjectRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";
import { CATEGORY_ICONS, COLUMN_COLOR_CLASSES } from "../lib/column-style";

type ProjectBoardProps = {
  project: ProjectRow;
  columns: ProjectColumnRow[];
};

/**
 * The project's columns as lanes, in workflow order. There are no items yet;
 * the lanes show how the workflow reads, and are where items will go.
 */
export function ProjectBoard({ project, columns }: ProjectBoardProps) {
  const { t } = useTranslation("projects");
  const { showProjectBackgrounds } = useDevicePreferences();
  const background = showProjectBackgrounds ? project.backgroundUrl : null;

  return (
    <div className="relative h-full min-h-96 overflow-x-auto">
      {background ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-background/70"
          />
        </>
      ) : null}
      <ul
        aria-label={t("board.lanesLabel", { name: project.name })}
        className="relative flex h-full gap-3 p-4"
      >
        {columns.map((column) => {
          const CategoryIcon = CATEGORY_ICONS[column.category];
          const color = COLUMN_COLOR_CLASSES[column.color];
          return (
            <li
              key={column.id}
              className={cn(
                "flex h-full w-72 shrink-0 flex-col rounded-xl border bg-card/80",
                color.lane,
              )}
            >
              <header className="flex items-center gap-2 border-b px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 rounded-full", color.dot)}
                />
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
                  {column.name}
                </h2>
                <CategoryIcon
                  aria-label={t(`categories.${column.category}.title`)}
                  role="img"
                  className="size-3.5 text-muted-foreground"
                />
              </header>
              <p className="p-3 text-xs text-muted-foreground">
                {t("board.emptyLane")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
