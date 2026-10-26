/**
 * The version of the page schema. An additive change to the schema bumps it; a
 * tab on an older version meets content it cannot show and is asked to reload.
 * `schema-fingerprint.test.ts` fails when the schema changes without a bump.
 */
export const DOCUMENT_SCHEMA_VERSION = 1;
