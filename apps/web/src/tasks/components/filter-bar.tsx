import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FilterSubject } from "@/app/preferences/task-view-options";
import { Button } from "@/design-system/ui/button";
import type { TaskFilter } from "../lib/filters";
import { FilterToken } from "./filter-token";
import { useFilterBar } from "./use-filter-bar";

const ITEM = "[data-filter-item]";

/**
 * The chips of the active filters, so a hidden filter is never forgotten.
 * It is a toolbar: arrows move between the parts of the chips, and Backspace
 * or Delete on one removes its filter.
 */
export function FilterBar({
  onChange,
  bar,
}: {
  onChange: (filters: TaskFilter[]) => void;
  bar: ReturnType<typeof useFilterBar>;
}) {
  const { t } = useTranslation("tasks");
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState<string | null>(null);
  const firstItem = `${bar.chips[0]?.subject}:operator`;
  const tabStop = focused ?? firstItem;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys typed inside a popover bubble here through the React tree.
    const target = event.target as HTMLElement;
    if (!target.matches(ITEM)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEM)];
    const index = items.indexOf(target);
    const move = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowRight") move(index + 1);
    else if (event.key === "ArrowLeft") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(items.length - 1);
    else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const subject = target.dataset.filterSubject as FilterSubject | undefined;
      if (!subject) return;
      const next = items[index - 1] ?? items[index + 1];
      bar.remove(subject);
      requestAnimationFrame(() => next?.isConnected && next.focus());
    }
  }

  return (
    <AnimatePresence initial={false}>
      {bar.chips.length > 0 ? (
        // The row eases open once, so the board does not jump when the first filter lands.
        <motion.div
          key="filters"
          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="overflow-hidden"
        >
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- The tab stop is one of its buttons (roving), not the container. */}
          <div
            role="toolbar"
            aria-label={t("filter.active")}
            className="flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5"
            onKeyDown={onKeyDown}
          >
            <AnimatePresence initial={false}>
              {bar.chips.map((filter) => (
                <FilterToken
                  key={filter.subject}
                  filter={filter}
                  valueOpen={bar.isOpen("value", filter.subject)}
                  operatorOpen={bar.isOpen("operator", filter.subject)}
                  onValueOpenChange={(next) =>
                    bar.setPartOpen("value", filter.subject, next)
                  }
                  onOperatorOpenChange={(next) =>
                    bar.setPartOpen("operator", filter.subject, next)
                  }
                  onToggleValue={(value) =>
                    bar.toggleValue(filter.subject, value)
                  }
                  onOperatorChange={(operator) =>
                    bar.setOperator(filter.subject, operator)
                  }
                  onRemove={() => bar.remove(filter.subject)}
                  tabStop={tabStop}
                  onItemFocus={setFocused}
                />
              ))}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="xs"
              data-filter-item="clear"
              tabIndex={tabStop === "clear" ? 0 : -1}
              onFocus={() => setFocused("clear")}
              onClick={() => onChange([])}
            >
              {t("filter.clearAll")}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
