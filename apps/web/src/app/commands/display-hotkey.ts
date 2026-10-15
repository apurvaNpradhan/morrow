import { formatForDisplay, type Hotkey } from "@tanstack/react-hotkeys";

export type DisplayedKeys = { keys: string[]; separator: string };

/** Key labels in the user's platform notation, and the separator between them. */
export function displayKeys(hotkey: Hotkey): DisplayedKeys {
  if (typeof hotkey === "string") {
    return { keys: formatForDisplay(hotkey, { parts: true }), separator: "+" };
  }
  return {
    keys: hotkey.map((step) => formatForDisplay(step)),
    separator: "then",
  };
}
