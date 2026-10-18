import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { shapeSchemaVersion } from "./shape-schema-version.js";
import * as shapes from "./index.js";

const base = {
  name: "things",
  schema: z.object({ id: z.string(), n: z.number() }),
};

describe("shapeSchemaVersion", () => {
  it("is the same for the same columns, in any order", () => {
    const reordered = {
      name: "things",
      schema: z.object({ n: z.number(), id: z.string() }),
    };
    expect(shapeSchemaVersion(base)).toBe(shapeSchemaVersion(reordered));
  });

  it("changes when a column is added, removed or retyped", () => {
    const version = shapeSchemaVersion(base);
    const added = { ...base, schema: base.schema.extend({ x: z.string() }) };
    const removed = { ...base, schema: base.schema.omit({ n: true }) };
    const retyped = { ...base, schema: base.schema.extend({ n: z.string() }) };
    const nullable = {
      ...base,
      schema: base.schema.extend({ n: z.number().nullable() }),
    };
    const versions = [added, removed, retyped, nullable].map(
      shapeSchemaVersion,
    );
    expect(new Set([version, ...versions]).size).toBe(5);
  });

  it("changes with the shape's name", () => {
    expect(shapeSchemaVersion({ ...base, name: "others" })).not.toBe(
      shapeSchemaVersion(base),
    );
  });

  it("is a positive 32-bit integer for every shape", () => {
    for (const value of Object.values(shapes)) {
      if (
        typeof value !== "object" ||
        !("schema" in value) ||
        !("name" in value)
      )
        continue;
      const version = shapeSchemaVersion(
        value as Parameters<typeof shapeSchemaVersion>[0],
      );
      expect(Number.isInteger(version)).toBe(true);
      expect(version).toBeGreaterThan(0);
      expect(version).toBeLessThanOrEqual(2 ** 31 - 1);
    }
  });
});
