import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { getDocumentSchema, schemaSpec } from "./schema";
import { DOCUMENT_SCHEMA_VERSION } from "./version";

/**
 * The fingerprint of the schema at each `DOCUMENT_SCHEMA_VERSION`. When the
 * test fails, the schema changed: bump the version and add the new version with
 * the fingerprint the failure prints. Older entries stay as history.
 */
const FINGERPRINTS: Record<number, string> = {
  1: "45f75415c2aabea9",
};

const fingerprint = () =>
  createHash("sha256")
    .update(JSON.stringify(schemaSpec(getDocumentSchema())))
    .digest("hex")
    .slice(0, 16);

describe("document schema fingerprint", () => {
  it("matches the one recorded for DOCUMENT_SCHEMA_VERSION", () => {
    expect(
      fingerprint(),
      `The schema is not the one recorded for version ${DOCUMENT_SCHEMA_VERSION}. If it changed on purpose, bump DOCUMENT_SCHEMA_VERSION and record the new fingerprint.`,
    ).toBe(FINGERPRINTS[DOCUMENT_SCHEMA_VERSION]);
  });
});
