import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isSortField, SORT_FIELDS } from "@/app/preferences/task-view-options";
import {
  SUB_TASK_PROPERTIES,
  type SubTaskProperty,
} from "@/app/preferences/device-preferences-collection";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { Switch } from "@/design-system/ui/switch";
import { defaultDirection } from "../lib/sort";
import { useSubTaskView } from "../lib/use-sub-task-view";

/**
 * The button on the sub-tasks header: how they are ordered, whether closed ones
 * and nested ones show, and which properties a row carries. Kept for this
 * device and shared by every task.
 */
export function SubTaskDisplayMenu() {
  const { t } = useTranslation("tasks");
  const { view, setSort, setCompleted, setNested, setShown } = useSubTaskView();
  const sortFields = SORT_FIELDS.filter((field) => field !== "manual");

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-xs" />}
        aria-label={t("subtasks.display")}
      >
        <SlidersHorizontal aria-hidden="true" />
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-72 p-0">
        <div className="flex flex-col divide-y text-sm">
          <div className="flex items-center justify-between gap-2 p-3">
            {t("display.sortBy")}
            <Select
              value={view.sort.field}
              onValueChange={(next) => {
                if (next && isSortField(next)) {
                  setSort({ field: next, direction: defaultDirection(next) });
                }
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue>
                  {t(`display.sortField.${view.sort.field}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {sortFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {t(`display.sortField.${field}`)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2 p-3">
            {t("subtasks.completed")}
            <Select
              value={view.completed}
              onValueChange={(next) => {
                if (next === "all" || next === "none") setCompleted(next);
              }}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue>
                  {t(`subtasks.completedOption.${view.completed}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {(["all", "none"] as const).map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`subtasks.completedOption.${option}`)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-2 p-3">
            {t("subtasks.nested")}
            <Switch checked={view.nested} onCheckedChange={setNested} />
          </label>
          <div className="flex flex-col gap-2 p-3">
            <span className="text-xs text-muted-foreground">
              {t("subtasks.properties")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUB_TASK_PROPERTIES.map((property: SubTaskProperty) => (
                <button
                  key={property}
                  type="button"
                  aria-pressed={view.show[property]}
                  className={cn(
                    "h-6 cursor-pointer rounded-full border px-2.5 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    view.show[property] && "bg-accent text-foreground",
                  )}
                  onClick={() => setShown(property, !view.show[property])}
                >
                  {t(`subtasks.property.${property}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
