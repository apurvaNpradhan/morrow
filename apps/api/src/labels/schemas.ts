import { colorHex, LABEL_NAME_MAX } from "@morrow/sync-schemas";
import { z } from "zod";

/** The fields clients send. Every limit lives here, once. */

export const workspaceId = z.string().min(1);
export const labelId = z.string().min(1);

/** A client-chosen id; its format is checked by the operation (INVALID_ID). */
export const newLabelId = z.string().min(1).max(64);

export const labelName = z.string().trim().min(1).max(LABEL_NAME_MAX);
/** A label's colour: `#rrggbb`. */
export const labelColor = colorHex;

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);
