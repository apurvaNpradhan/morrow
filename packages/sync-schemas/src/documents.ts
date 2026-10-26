/**
 * What Documents (pages) are made of, shared by the API (which validates
 * writes) and the web app (which renders the tree).
 */

/** A Document's title: at most this many characters, once trimmed. */
export const DOCUMENT_TITLE_MAX = 200;

/** A cuid2 as the browser generates it when it creates a Document. */
export const DOCUMENT_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;

/** A Document's content is at most this large as ProseMirror JSON (1 MB). */
export const DOCUMENT_MAX_BYTES = 1024 * 1024;

/** A Document's stream starts at this generation and moves on only for a breaking schema change. */
export const DOCUMENT_FIRST_GENERATION = 1;
