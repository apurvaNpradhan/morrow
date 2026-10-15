import { HotkeysProvider } from "@tanstack/react-hotkeys";
import type { ReactNode } from "react";
import { appHotkeys } from "./hotkeys";

export function AppHotkeysProvider({ children }: { children: ReactNode }) {
  return <HotkeysProvider appHotkeys={appHotkeys}>{children}</HotkeysProvider>;
}
