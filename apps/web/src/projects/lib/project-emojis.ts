import { isProjectEmoji } from "@morrow/sync-schemas";

export type EmojiEntry = { emoji: string; label: string; tags: string[] };

type CompactEmoji = {
  unicode: string;
  label: string;
  tags?: string[];
  group?: number;
};

/** emojibase group 2 holds skin-tone and hair modifiers, which are not emoji on their own. */
const COMPONENTS_GROUP = 2;

let loaded: Promise<readonly EmojiEntry[]> | undefined;

/** Every emoji with its name and keywords. The data is a separate chunk, fetched when the Emoji tab first opens. */
export function loadEmojis(): Promise<readonly EmojiEntry[]> {
  loaded ??= import("emojibase-data/en/compact.json").then(({ default: all }) =>
    (all as CompactEmoji[])
      .filter(
        (entry) =>
          entry.group !== undefined && entry.group !== COMPONENTS_GROUP,
      )
      .map((entry) => ({
        emoji: entry.unicode,
        label: entry.label,
        tags: entry.tags ?? [],
      })),
  );
  return loaded;
}

const normalise = (text: string) => text.toLowerCase().replace(/[\s_-]/g, "");

/** The emoji whose name or a keyword contains the query, ignoring case, spaces and dashes. */
export function filterEmojis(
  emojis: readonly EmojiEntry[],
  query: string,
): readonly EmojiEntry[] {
  const needle = normalise(query);
  if (!needle) return emojis;
  return emojis.filter(
    (entry) =>
      normalise(entry.label).includes(needle) ||
      entry.tags.some((tag) => normalise(tag).includes(needle)),
  );
}

/** A stored icon that is an emoji rather than a Lucide icon name. */
export function emojiOfIcon(icon: string | null): string | null {
  return icon && isProjectEmoji(icon) ? icon : null;
}
