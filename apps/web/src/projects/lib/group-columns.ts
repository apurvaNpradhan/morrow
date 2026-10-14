import {
  COLUMN_CATEGORIES,
  type ColumnCategory,
  type ProjectColumnRow,
  compareColumns,
} from "@morrow/sync-schemas";

export type ColumnGroup = {
  category: ColumnCategory;
  columns: ProjectColumnRow[];
};

/** Every category in workflow order, each with its columns in position order (empty ones included). */
export function groupColumns(
  columns: readonly ProjectColumnRow[],
): ColumnGroup[] {
  const sorted = [...columns].sort(compareColumns);
  return COLUMN_CATEGORIES.map((category) => ({
    category,
    columns: sorted.filter((column) => column.category === category),
  }));
}
