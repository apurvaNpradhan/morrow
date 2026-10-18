import type { z } from "zod";

/** A column's type as text: its kind, with the kinds it wraps and its enum values. */
function describeType(type: z.ZodType): string {
  const { def } = type._zod;
  const parts: string[] = [def.type];
  const inner = "innerType" in def ? def.innerType : undefined;
  if (inner) parts.push(describeType(inner as z.ZodType));
  const element = "element" in def ? def.element : undefined;
  if (element) parts.push(describeType(element as z.ZodType));
  if ("entries" in def)
    parts.push(Object.values(def.entries as object).join("|"));
  return parts.join(":");
}

/**
 * The version of a Shape's local copy: a stable hash of its name and its column
 * names and types, as a positive 32-bit integer. The browser's database keeps
 * rows in the Shape's column format, so a changed column must discard them.
 */
export function shapeSchemaVersion(shape: {
  name: string;
  schema: z.ZodObject;
}): number {
  const columns = Object.entries(shape.schema.shape)
    .map(([column, type]) => `${column}=${describeType(type as z.ZodType)}`)
    .sort();
  const text = `${shape.name}\n${columns.join("\n")}`;
  // FNV-1a, 32 bits.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // Shifted into 1..2^31-1: the library wants a positive integer.
  return ((hash >>> 0) % 0x7fffffff) + 1;
}
