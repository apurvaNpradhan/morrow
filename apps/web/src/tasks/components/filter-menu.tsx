import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FILTER_SUBJECTS,
  type FilterSubject,
} from "@/app/preferences/task-view-options";
import { Button } from "@/design-system/ui/button";
import {
  Menu,
  MenuPopup,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/design-system/ui/menu";
import type { TaskFilter } from "../lib/filters";
import { FilterEditorItems } from "./filter-editor-items";

/** The Filter button: a menu of subjects, each opening its own choices. */
export function FilterMenu({
  filters,
  onChange,
  open,
  onOpenChange,
  includeColumn,
}: {
  filters: readonly TaskFilter[];
  onChange: (filters: TaskFilter[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Column filter exists only where Columns are separate, in the list. */
  includeColumn: boolean;
}) {
  const { t } = useTranslation("tasks");
  const subjects: FilterSubject[] = FILTER_SUBJECTS.filter(
    (subject) => includeColumn || subject !== "column",
  );
  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <MenuTrigger
        render={<Button variant="outline" size="xs" />}
        aria-label={t("toolbar.filter")}
      >
        <ListFilter aria-hidden="true" />
        {t("toolbar.filter")}
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-44">
        {subjects.map((subject) => (
          <MenuSub key={subject}>
            <MenuSubTrigger>{t(`filter.subject.${subject}`)}</MenuSubTrigger>
            <MenuSubPopup>
              <FilterEditorItems
                subject={subject}
                filters={filters}
                onChange={onChange}
              />
            </MenuSubPopup>
          </MenuSub>
        ))}
      </MenuPopup>
    </Menu>
  );
}
