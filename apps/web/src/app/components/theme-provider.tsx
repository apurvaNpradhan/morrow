import { useLayoutEffect } from "react";
import { applyTheme } from "@/app/preferences/apply-theme";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";

/** Keeps the page's theme class in step with the device preference, in every tab. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useDevicePreferences();

  useLayoutEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return <>{children}</>;
}
