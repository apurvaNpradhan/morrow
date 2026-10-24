import type { ReactElement } from "react";
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
  const { optionsFor, labelFor, subjectLabel, typedCreate } =
    useFilterOptions();
  // Values typed earlier are not in the list; keep them there to uncheck.
  const listed = optionsFor(subject);
  const options = [
    ...listed,
    ...values
      .filter((value) => !listed.some((option) => option.value === value))
      .map((value) => ({ value, label: labelFor(subject, value) })),
  ];
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverPopup>
        <FilterOptionList
          options={options}
          selected={new Set(values)}
          label={subjectLabel(subject)}
          onPick={onToggle}
          create={typedCreate(subject, onToggle)}
        />
      </PopoverPopup>
    </Popover>
  );
}
