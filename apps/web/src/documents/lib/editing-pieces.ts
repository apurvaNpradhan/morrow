import { loadEditingPieces } from "@/tasks";

/*
 * The Tiptap pieces the task editor and the page editor have in common. Only
 * the lazily loaded page editor imports this module, so waiting for them here
 * keeps Tiptap out of the first screen.
 */
export const {
  BubbleLinkEditor,
  SlashCommands,
  documentExtensionsWithViews,
  editingExtensions,
} = await loadEditingPieces();
