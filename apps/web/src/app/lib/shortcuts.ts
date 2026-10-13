import { getModifierKeyText } from "@/app/hooks/use-keyboard-shortcuts";

export const shortcuts = {
  workspace: { prefix: "w", switch: "s", create: "c" },
  sidebar: { prefix: getModifierKeyText(), toggle: "b" },
  palette: { prefix: "Ctrl", open: "k" },
  help: { key: "?" },
} as const;
