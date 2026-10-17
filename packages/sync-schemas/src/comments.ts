/**
 * What Comments are made of, shared by the API (which validates writes) and
 * the web app (which renders them).
 */

export const COMMENT_BODY_MAX = 10_000;

/** A cuid2 as the browser generates it when it posts a Comment. */
export const COMMENT_ID_PATTERN = /^[a-z][a-z0-9]{23}$/;
