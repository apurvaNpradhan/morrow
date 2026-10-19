import {
  COLUMN_CATEGORIES,
  colorHex,
  isProjectEmoji,
  PROJECT_ICONS,
  PROJECT_KEY_PATTERN,
} from "@morrow/sync-schemas";
import { z } from "zod";

/** The fields clients send. Every limit lives here, once. */

export const workspaceId = z.string().min(1);
export const projectId = z.string().min(1);
export const columnId = z.string().min(1);

/** 2–6 upper-case letters and digits, starting with a letter; typed in any case. */
export const projectKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PROJECT_KEY_PATTERN);

export const projectName = z.string().trim().min(1).max(100);
export const projectDescription = z.string().trim().max(2000);
/** A Lucide icon name from the list, or a single emoji. */
export const projectIcon = z.union([
  z.enum(PROJECT_ICONS),
  z.string().refine(isProjectEmoji),
]);
/** A project's colour: `#rrggbb`. */
export const projectColor = colorHex;

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);

export const columnName = z.string().trim().min(1).max(50);
export const columnCategory = z.enum(COLUMN_CATEGORIES);
export const columnColor = colorHex;
