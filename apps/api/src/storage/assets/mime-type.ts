const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

/** The media type a client declared, lower-cased and without parameters; unusable ones become a plain binary type. */
export function normalizeMimeType(declared: string) {
  const type = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  return MIME_TYPE.test(type) && type.length <= 127
    ? type
    : "application/octet-stream";
}
