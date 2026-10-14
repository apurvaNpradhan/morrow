import {
  createCollection,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import { z } from "zod";

/**
 * Settings that belong to this browser, not to the signed-in user: they stay
 * after sign-out and sync between open tabs through the storage event. One row.
 */
export const DEVICE_PREFERENCES_ID = "device";

export const devicePreferencesSchema = z.object({
  id: z.literal(DEVICE_PREFERENCES_ID),
  theme: z.enum(["light", "dark", "system"]).default("dark"),
  compactMode: z.boolean().default(false),
  sidebarDefaultOpen: z.boolean().default(true),
});

export type DevicePreferences = z.infer<typeof devicePreferencesSchema>;
export type Theme = DevicePreferences["theme"];

export const devicePreferencesCollection = createCollection(
  localStorageCollectionOptions({
    id: "device-preferences",
    storageKey: "device-preferences",
    getKey: (row) => row.id,
    schema: devicePreferencesSchema,
    startSync: true,
  }),
);

// The previous store kept preferences under this key; they do not carry over.
try {
  localStorage.removeItem("user-preferences");
} catch {
  // Storage can be blocked; there is nothing to clean up then.
}
