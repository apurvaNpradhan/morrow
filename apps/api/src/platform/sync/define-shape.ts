import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";

/** A shape's row filter: SQL over the table with `$1…` placeholders. */
export type ShapeFilter = { sql: string; params: string[] };

type ShapeDefinitionInput<Schema extends z.ZodObject, Table extends PgTable> = {
  /** The name the browser asks for: `GET /api/shapes/:name`. */
  name: string;
  table: Table;
  /** The columns that may be sent, in camelCase. Their keys are the allowlist. */
  schema: Schema;
  /** Which rows this user may read. Everything comes from the session, never the request. */
  where: (context: { userId: string }) => ShapeFilter;
};

export type ShapeDefinition = {
  name: string;
  /** The Postgres table name. */
  table: string;
  /** The allowed Postgres column names. */
  columns: string[];
  where: (context: { userId: string }) => ShapeFilter;
};

/**
 * Declares one shape. The column allowlist is the schema's keys mapped to the
 * table's column names; a key that is not a column of the table throws when the
 * module loads, so a typo never becomes "send everything".
 */
export function defineShape<Schema extends z.ZodObject, Table extends PgTable>(
  input: ShapeDefinitionInput<Schema, Table>,
): ShapeDefinition {
  const tableColumns = getTableColumns(input.table);
  const columns = Object.keys(input.schema.shape).map((key) => {
    const column = (tableColumns as Record<string, { name: string }>)[key];
    if (!column) {
      throw new Error(
        `Shape "${input.name}" lists "${key}", which is not a column of ${getTableName(input.table)}`,
      );
    }
    return column.name;
  });
  if (columns.length === 0) {
    throw new Error(`Shape "${input.name}" must list at least one column`);
  }
  return {
    name: input.name,
    table: getTableName(input.table),
    columns,
    where: input.where,
  };
}
