import { useLiveQuery } from "@tanstack/react-db";
import {
  DEVICE_PREFERENCES_ID,
  type DevicePreferences,
  devicePreferencesCollection,
  devicePreferencesSchema,
} from "./device-preferences-collection";

const defaults = devicePreferencesSchema.parse({ id: DEVICE_PREFERENCES_ID });

/** The stored preferences with defaults for whatever is not stored yet. */
export function readDevicePreferences(): DevicePreferences {
  return {
    ...defaults,
    ...devicePreferencesCollection.get(DEVICE_PREFERENCES_ID),
  };
}

/** Saves a change, creating the row on first use. */
export function saveDevicePreferences(
  patch: Partial<Omit<DevicePreferences, "id">>,
) {
  if (devicePreferencesCollection.has(DEVICE_PREFERENCES_ID)) {
    devicePreferencesCollection.update(DEVICE_PREFERENCES_ID, (draft) => {
      Object.assign(draft, patch);
    });
  } else {
    devicePreferencesCollection.insert({ id: DEVICE_PREFERENCES_ID, ...patch });
  }
}

/** The device preferences, live: a change in another tab re-renders this one. */
export function useDevicePreferences(): DevicePreferences {
  const { data } = useLiveQuery({
    query: (q) => q.from({ preferences: devicePreferencesCollection }),
  });
  return { ...defaults, ...data[0] };
}
