import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";

/** What a shape's filter may depend on: the session, never the request. */
export type ShapeContext = { userId: string; userEmail: string };

/** A shape's row filter: SQL over the table with `$1…` placeholders. */
export type ShapeFilter = { sql: string; params: string[] };

type ShapeDefinitionInput<Schema extends z.ZodObject, Table extends PgTable> = {
  /**
   * The shape's name (`GET /api/shapes/:name`) and the columns that may be
   * sent, in camelCase; the schema's keys are the allowlist. Shared with the
   * web app through `@morrow/sync-schemas`.
   */
  shape: { name: string; schema: Schema };
  table: Table;
  /** Which rows this user may read. Everything comes from the session, never the request. */
  where: (context: ShapeContext) => ShapeFilter;
};

export type ShapeDefinition = {
  name: string;
  /** The Postgres table name. */
  table: string;
  /** The allowed Postgres column names. */
  columns: string[];
  where: (context: ShapeContext) => ShapeFilter;
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
  const columns = Object.keys(input.shape.schema.shape).map((key) => {
    const column = (tableColumns as Record<string, { name: string }>)[key];
    if (!column) {
      throw new Error(
        `Shape "${input.shape.name}" lists "${key}", which is not a column of ${getTableName(input.table)}`,
      );
    }
    return column.name;
  });
  if (columns.length === 0) {
    throw new Error(
      `Shape "${input.shape.name}" must list at least one column`,
    );
  }
  return {
    name: input.shape.name,
    table: getTableName(input.table),
    columns,
    where: input.where,
  };
}
