import { applyTheme } from "./apply-theme";
import type { Theme } from "./device-preferences-collection";
import { saveDevicePreferences } from "./use-device-preferences";

/**
 * Changes the theme with a view transition that grows from where the user
 * clicked (`coordinates`, in percent of the viewport).
 */
export function setTheme(theme: Theme, coordinates?: { x: number; y: number }) {
  const root = document.documentElement;
  if (coordinates) {
    root.style.setProperty("--x", `${coordinates.x}%`);
    root.style.setProperty("--y", `${coordinates.y}%`);
  } else {
    root.style.removeProperty("--x");
    root.style.removeProperty("--y");
  }

  // The class goes on inside the transition so it captures the new look; the
  // stored value then keeps every other tab and the next load in step.
  const change = () => {
    applyTheme(theme);
    saveDevicePreferences({ theme });
  };
  if ("startViewTransition" in document) {
    document.startViewTransition(change);
  } else {
    change();
  }
}
