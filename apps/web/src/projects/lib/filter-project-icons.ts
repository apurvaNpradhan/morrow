import { PROJECT_ICONS, type ProjectIcon } from "@morrow/sync-schemas";

const normalise = (text: string) => text.toLowerCase().replace(/[\s_-]/g, "");

/** The icons whose name contains the query, ignoring case, spaces and dashes. */
export function filterProjectIcons(query: string): readonly ProjectIcon[] {
  const needle = normalise(query);
  if (!needle) return PROJECT_ICONS;
  return PROJECT_ICONS.filter((name) => normalise(name).includes(needle));
}
