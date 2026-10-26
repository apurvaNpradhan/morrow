import { type AnyExtension, getSchema } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { documentExtensions } from "./extensions";

/** The ProseMirror schema of an extension list; of pages when given none. */
export function getDocumentSchema(
  extensions: AnyExtension[] = documentExtensions,
): Schema {
  return getSchema(extensions);
}

type SpecEntry = Record<string, unknown>;

const attributeDefaults = (
  attrs: Record<string, { default?: unknown }> | undefined,
) =>
  Object.fromEntries(
    Object.entries(attrs ?? {}).map(([name, attr]) => [
      name,
      attr.default ?? null,
    ]),
  );

/**
 * The part of a schema that decides what content can exist, as plain data:
 * names, content expressions, groups, flags and attribute defaults, in order.
 * Rendering functions are left out; they do not change what a page may hold.
 */
export function schemaSpec(schema: Schema) {
  const nodes: SpecEntry[] = [];
  schema.spec.nodes.forEach((name, spec) => {
    nodes.push({
      name,
      content: spec.content ?? null,
      marks: spec.marks ?? null,
      group: spec.group ?? null,
      inline: spec.inline ?? false,
      atom: spec.atom ?? false,
      selectable: spec.selectable ?? true,
      draggable: spec.draggable ?? false,
      code: spec.code ?? false,
      defining: spec.defining ?? false,
      isolating: spec.isolating ?? false,
      whitespace: spec.whitespace ?? null,
      attrs: attributeDefaults(spec.attrs),
    });
  });
  const marks: SpecEntry[] = [];
  schema.spec.marks.forEach((name, spec) => {
    marks.push({
      name,
      group: spec.group ?? null,
      excludes: spec.excludes ?? null,
      inclusive: spec.inclusive ?? true,
      spanning: spec.spanning ?? true,
      attrs: attributeDefaults(spec.attrs),
    });
  });
  return { nodes, marks };
}
