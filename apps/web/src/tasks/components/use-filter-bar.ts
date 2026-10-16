import { useState } from "react";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import {
  isNegated,
  removeFilter,
  setFilterNegated,
  toggleFilterValue,
} from "../lib/filter-edit";
import type { TaskFilter } from "../lib/filters";
import type { FilterOperator } from "@/app/preferences/task-view-options";

type Open = { part: "value" | "operator"; subject: FilterSubject } | null;

/**
 * What the filter bar holds besides the filters: which chip segment has its
 * popover open.
 */
export function useFilterBar({
  filters,
  onChange,
}: {
  filters: readonly TaskFilter[];
  onChange: (filters: TaskFilter[]) => void;
}) {
  const [open, setOpen] = useState<Open>(null);

  function openPart(part: "value" | "operator", subject: FilterSubject) {
    setOpen({ part, subject });
  }

  function close() {
    setOpen(null);
  }

  return {
    chips: filters,
    isOpen: (part: "value" | "operator", subject: FilterSubject) =>
      open?.part === part && open.subject === subject,
    setPartOpen(
      part: "value" | "operator",
      subject: FilterSubject,
      next: boolean,
    ) {
      if (next) openPart(part, subject);
      else close();
    },
    toggleValue(subject: FilterSubject, value: string) {
      onChange(toggleFilterValue(filters, subject, value));
    },
    setOperator(subject: FilterSubject, operator: FilterOperator) {
      onChange(setFilterNegated(filters, subject, isNegated(operator)));
    },
    remove(subject: FilterSubject) {
      close();
      onChange(removeFilter(filters, subject));
    },
  };
}
