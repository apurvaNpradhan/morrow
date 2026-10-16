import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { FilterOptionList } from "./filter-option-list";
import { useFilterOptions } from "./use-filter-options";

/** A chip's segment, opening a searchable checkbox list of the subject's values. */
export function FilterValuePopover({
  subject,
  values,
  open,
  onOpenChange,
  onToggle,
  trigger,
}: {
  subject: FilterSubject;
  values: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (value: string) => void;
  trigger: ReactElement;
}) {
  const { t } = useTranslation("tasks");
  const { optionsFor } = useFilterOptions();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverPopup>
        <FilterOptionList
          options={optionsFor(subject)}
          selected={new Set(values)}
          label={t(`filter.subject.${subject}`)}
          onPick={onToggle}
        />
      </PopoverPopup>
    </Popover>
  );
}
