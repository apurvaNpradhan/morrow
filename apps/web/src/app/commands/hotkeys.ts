import { defineAppHotkeys } from "@tanstack/react-hotkeys";

/** Every keyboard shortcut in the web app. Labels are looked up by id in i18n (`navigation:commands.<id>`). */
export const appHotkeys = defineAppHotkeys({
  palette: { hotkey: "Mod+K", meta: { group: "general" } },
  help: { hotkey: "?", meta: { group: "general" } },
  toggleSidebar: {
    hotkey: "Mod+B",
    meta: { group: "view" },
    options: { ignoreInputs: true },
  },
  goHome: { hotkey: ["G", "H"], meta: { group: "navigate" } },
  goProjects: { hotkey: ["G", "P"], meta: { group: "navigate" } },
  goMembers: { hotkey: ["G", "M"], meta: { group: "navigate" } },
  goSettings: { hotkey: ["G", "S"], meta: { group: "navigate" } },
  goAccount: { hotkey: ["G", "A"], meta: { group: "navigate" } },
  switchWorkspace: { hotkey: ["W", "S"], meta: { group: "navigate" } },
  createProject: { hotkey: "C", meta: { group: "create" } },
  createWorkspace: { hotkey: ["W", "C"], meta: { group: "create" } },
});

export type HotkeyId = keyof typeof appHotkeys;

declare module "@tanstack/react-hotkeys" {
  interface Register {
    appHotkeys: typeof appHotkeys;
  }
}
