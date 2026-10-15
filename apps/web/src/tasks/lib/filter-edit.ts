import type {
  FilterOperator,
  FilterSubject,
} from "@/app/preferences/task-view-options";
import type { TaskFilter } from "./filters";

/** Whether an operator excludes what it matches. */
export function isNegated(operator: FilterOperator) {
  return operator === "isNot" || operator === "isNoneOf";
}

/** "is" and "is not" read for one value, "is any of" and "is none of" for several. */
export function operatorFor(
  negated: boolean,
  valueCount: number,
): FilterOperator {
  if (valueCount > 1) return negated ? "isNoneOf" : "isAnyOf";
  return negated ? "isNot" : "is";
}

/** Adds the value to its subject's filter, or removes it when it is already there. */
export function toggleFilterValue(
  filters: readonly TaskFilter[],
  subject: FilterSubject,
  value: string,
): TaskFilter[] {
  const current = filters.find((filter) => filter.subject === subject);
  if (!current) {
    return [...filters, { subject, operator: "is", values: [value] }];
  }
  const values = current.values.includes(value)
    ? current.values.filter((candidate) => candidate !== value)
    : [...current.values, value];
  if (values.length === 0) {
    return filters.filter((filter) => filter.subject !== subject);
  }
  const negated = isNegated(current.operator);
  return filters.map((filter) =>
    filter.subject === subject
      ? { subject, operator: operatorFor(negated, values.length), values }
      : filter,
  );
}

/** Switches a subject's filter between including and excluding its values. */
export function setFilterNegated(
  filters: readonly TaskFilter[],
  subject: FilterSubject,
  negated: boolean,
): TaskFilter[] {
  return filters.map((filter) =>
    filter.subject === subject
      ? { ...filter, operator: operatorFor(negated, filter.values.length) }
      : filter,
  );
}

export function removeFilter(
  filters: readonly TaskFilter[],
  subject: FilterSubject,
): TaskFilter[] {
  return filters.filter((filter) => filter.subject !== subject);
}
