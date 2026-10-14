import { useEffect } from "react";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";

export function useUserPreferencesEffects() {
  const { compactMode } = useDevicePreferences();

  useEffect(() => {
    const root = document.documentElement;

    if (compactMode) {
      root.classList.add("compact-mode");
    } else {
      root.classList.remove("compact-mode");
    }

    return () => {
      root.classList.remove("compact-mode");
    };
  }, [compactMode]);

  return {
    compactMode,
  };
}
