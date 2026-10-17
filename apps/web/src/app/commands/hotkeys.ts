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
  createTask: { hotkey: "C", meta: { group: "create" } },
  createProject: { hotkey: ["P", "C"], meta: { group: "create" } },
  createWorkspace: { hotkey: ["W", "C"], meta: { group: "create" } },
  // Tasks: bound by the project page, not offered as commands.
  filterTasks: { hotkey: "F", meta: { group: "tasks" } },
  displayOptions: { hotkey: "Shift+V", meta: { group: "tasks" } },
  searchTasks: { hotkey: "Mod+F", meta: { group: "tasks" } },
  nextTask: { hotkey: "J", meta: { group: "tasks" } },
  previousTask: { hotkey: "K", meta: { group: "tasks" } },
  // These act on the focused task, or the open one in the sheet.
  setTaskColumn: { hotkey: "S", meta: { group: "tasks" } },
  setTaskPriority: { hotkey: "P", meta: { group: "tasks" } },
  assignTask: { hotkey: "A", meta: { group: "tasks" } },
  assignTaskToMe: { hotkey: "I", meta: { group: "tasks" } },
  setTaskDueDate: { hotkey: "Shift+D", meta: { group: "tasks" } },
  setTaskLabels: { hotkey: "L", meta: { group: "tasks" } },
  copyTaskBranch: { hotkey: "Mod+Shift+.", meta: { group: "tasks" } },
  // Ctrl+Backspace also deletes a word, so never while typing.
  deleteTask: {
    hotkey: "Mod+Backspace",
    meta: { group: "tasks" },
    options: { ignoreInputs: true },
  },
});

export type HotkeyId = keyof typeof appHotkeys;

declare module "@tanstack/react-hotkeys" {
  interface Register {
    appHotkeys: typeof appHotkeys;
  }
}
