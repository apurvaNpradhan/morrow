/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/click-events-have-key-events -- A combobox over a listbox: focus stays in the search box, which handles the keys. */
import { Check, Minus, Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import type { FilterOption } from "./use-filter-options";

const CREATE_VALUE = "\u0000create";

/**
 * A search box over a list of options, driven from the keyboard: arrows move,
 * Enter picks. With `selected` the rows are checkboxes and the list stays
 * open for the next pick.
 */
export function FilterOptionList({
  options,
  selected,
  indeterminate,
  onPick,
  label,
  create,
  onSearch,
}: {
  options: FilterOption[];
  selected?: ReadonlySet<string>;
  /** Options some but not all of a batch have: shown with a dash, between checked and empty. */
  indeterminate?: ReadonlySet<string>;
  onPick: (value: string) => void;
  label: string;
  /** Adds a last row that makes a new option from what was typed, when nothing matches it exactly. */
  create?: {
    label: (name: string) => string;
    onCreate: (name: string) => void;
    /** Whether what was typed can be used at all; the row is hidden when not. */
    accepts?: (name: string) => boolean;
  };
  /** The options come from a search: typing is reported here and they are not narrowed again. */
  onSearch?: (query: string) => void;
}) {
  const { t } = useTranslation("tasks");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const typed = query.trim();
  const needle = typed.toLowerCase();
  const matching =
    needle && !onSearch
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  const offerCreate =
    create !== undefined &&
    needle !== "" &&
    (create.accepts?.(typed) ?? true) &&
    !options.some((option) => option.label.toLowerCase() === needle);
  const shown: Array<FilterOption & { creates?: boolean }> = offerCreate
    ? [
        ...matching,
        { value: CREATE_VALUE, label: create.label(typed), creates: true },
      ]
    : matching;
  const current = Math.min(active, Math.max(0, shown.length - 1));

  function pick(option: (typeof shown)[number]) {
    if (option.creates) {
      create?.onCreate(typed);
      setQuery("");
      setActive(0);
    } else {
      onPick(option.value);
    }
  }

  return (
    <div className="flex w-56 flex-col">
      <div className="flex items-center gap-2 border-b px-2.5">
        <Search
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            shown[current] ? `${listId}-${current}` : undefined
          }
          aria-label={label}
          value={query}
          placeholder={t("filter.search")}
          autoComplete="off"
          spellCheck={false}
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/72"
          onChange={(event) => {
            setQuery(event.target.value);
            onSearch?.(event.target.value.trim());
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive(
                Math.max(0, Math.min(current + step, shown.length - 1)),
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              const option = shown[current];
              if (option) pick(option);
            }
          }}
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        aria-multiselectable={selected ? true : undefined}
        className="max-h-60 overflow-y-auto p-1"
      >
        {shown.length === 0 ? (
          <li className="px-2 py-2 text-sm text-muted-foreground">
            {t("filter.noMatches")}
          </li>
        ) : null}
        {shown.map((option, index) => {
          const checked = selected?.has(option.value) ?? false;
          const partial = indeterminate?.has(option.value) ?? false;
          return (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={selected ? checked : index === current}
              aria-checked={selected && partial ? "mixed" : undefined}
              ref={(node) => {
                if (index === current)
                  node?.scrollIntoView({ block: "nearest" });
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                index === current && "bg-accent",
              )}
              onMouseEnter={() => setActive(index)}
              // Keep focus in the search box so typing and arrows keep working.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
            >
              {selected ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
                    (checked || partial) &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {checked ? <Check className="size-3" /> : null}
                  {partial ? <Minus className="size-3" /> : null}
                </span>
              ) : null}
              {option.glyph ? (
                <span className="flex shrink-0 items-center" aria-hidden="true">
                  {option.glyph}
                </span>
              ) : null}
              <span className="truncate">{option.label}</span>
              {option.count ? (
                <span className="ms-auto ps-3 text-xs tabular-nums text-muted-foreground">
                  {t("filter.taskCount", { count: option.count })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
