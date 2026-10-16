import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  FilterOperator,
  FilterSubject,
} from "@/app/preferences/task-view-options";
import { cn } from "@/design-system/cn";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { operatorChoices } from "../lib/filter-edit";
import type { TaskFilter } from "../lib/filters";
import { FilterValuePopover } from "./filter-value-popover";
import { useFilterOptions } from "./use-filter-options";

const SEGMENT =
  "flex h-full cursor-pointer items-center gap-1 px-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-popup-open:bg-accent";

/**
 * One filter as a chip of three parts: the field, the operator and the
 * values, the last two opening their own popover, and a cross to remove it.
 */
export function FilterToken({
  filter,
  valueOpen,
  operatorOpen,
  onValueOpenChange,
  onOperatorOpenChange,
  onToggleValue,
  onOperatorChange,
  onRemove,
  tabStop,
  onItemFocus,
}: {
  filter: TaskFilter;
  valueOpen: boolean;
  operatorOpen: boolean;
  onValueOpenChange: (open: boolean) => void;
  onOperatorOpenChange: (open: boolean) => void;
  onToggleValue: (value: string) => void;
  onOperatorChange: (operator: FilterOperator) => void;
  onRemove: () => void;
  /** Which of this chip's items is the toolbar's tab stop, if any. */
  tabStop: string | null;
  onItemFocus: (item: string) => void;
}) {
  const { t } = useTranslation("tasks");
  const { labelFor, optionsFor } = useFilterOptions();
  const reduceMotion = useReducedMotion();
  const subject: FilterSubject = filter.subject;
  const subjectLabel = t(`filter.subject.${subject}`);
  const valueText = filter.values
    .map((value) => labelFor(subject, value))
    .join(", ");
  const item = (part: string) => ({
    "data-filter-item": `${subject}:${part}`,
    "data-filter-subject": subject,
    tabIndex: tabStop === `${subject}:${part}` ? 0 : -1,
    onFocus: () => onItemFocus(`${subject}:${part}`),
  });
  // A change in the values flashes the chip, but not as it first appears.
  const shown = useRef(false);
  const flash = shown.current && !reduceMotion;
  shown.current = true;

  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 560, damping: 34, mass: 0.7 }}
      className="inline-flex h-6 items-stretch overflow-hidden rounded-md border bg-muted/40 text-xs"
    >
      <span
        className="flex items-center px-2 font-medium"
        data-filter-label={subject}
      >
        {subjectLabel}
      </span>
      <Menu open={operatorOpen} onOpenChange={onOperatorOpenChange}>
        <MenuTrigger
          className={cn(SEGMENT, "border-s text-muted-foreground")}
          aria-label={t("filter.editOperator", { subject: subjectLabel })}
          {...item("operator")}
        >
          {t(`filter.operator.${filter.operator}`)}
        </MenuTrigger>
        <MenuPopup align="start" className="min-w-36">
          <MenuRadioGroup
            value={filter.operator}
            onValueChange={(next) => onOperatorChange(next as FilterOperator)}
          >
            {operatorChoices(filter.values.length).map((operator) => (
              <MenuRadioItem key={operator} value={operator}>
                {t(`filter.operator.${operator}`)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <FilterValuePopover
        subject={subject}
        values={filter.values}
        open={valueOpen}
        onOpenChange={onValueOpenChange}
        onToggle={onToggleValue}
        trigger={
          <button
            type="button"
            className={cn(SEGMENT, "border-s font-medium")}
            aria-label={t("filter.editValue", { subject: subjectLabel })}
            {...item("value")}
          >
            <motion.span
              key={filter.values.join(",")}
              initial={
                flash
                  ? {
                      backgroundColor:
                        "color-mix(in oklab, var(--color-primary) 20%, transparent)",
                    }
                  : false
              }
              animate={{ backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex items-center gap-1 rounded-sm"
            >
              {filter.values.length === 1
                ? optionsFor(subject).find(
                    (option) => option.value === filter.values[0],
                  )?.glyph
                : null}
              <span className="max-w-48 truncate">{valueText}</span>
            </motion.span>
          </button>
        }
      />
      <button
        type="button"
        aria-label={t("filter.remove", { subject: subjectLabel })}
        className="flex cursor-pointer items-center border-s px-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onRemove}
        {...item("remove")}
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </motion.span>
  );
}
