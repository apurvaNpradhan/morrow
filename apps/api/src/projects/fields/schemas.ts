import {
  colorHex,
  FIELD_NAME_MAX,
  fieldConfigSchema,
} from "@morrow/sync-schemas";
import { z } from "zod";

/** The fields clients send for custom Fields. Every limit lives here, once. */

export const fieldId = z.string().min(1);
/** A Field's or an option's name: 1–50 characters. */
export const fieldName = z.string().trim().min(1).max(FIELD_NAME_MAX);
export const optionId = z.string().min(1);
export const optionColor = colorHex;
export const fieldConfig = fieldConfigSchema;
