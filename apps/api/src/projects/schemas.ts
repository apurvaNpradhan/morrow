import {
  COLUMN_CATEGORIES,
  COLUMN_COLORS,
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
export const projectIcon = z.enum(PROJECT_ICONS);
/** A project's colour is one of the column colour tokens. */
export const projectColor = z.enum(COLUMN_COLORS);

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);

export const columnName = z.string().trim().min(1).max(50);
export const columnCategory = z.enum(COLUMN_CATEGORIES);
export const columnColor = z.enum(COLUMN_COLORS);
