import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type EmojiEntry,
  filterEmojis,
  loadEmojis,
} from "../lib/project-emojis";

const COLUMNS = 8;
const ROW_HEIGHT = 34;

type ProjectEmojiGridProps = {
  value: string | null;
  query: string;
  onPick: (emoji: string) => void;
};

/** Every emoji in rows of eight; only the rows in view are rendered. */
export function ProjectEmojiGrid({
  value,
  query,
  onPick,
}: ProjectEmojiGridProps) {
  const { t } = useTranslation("projects");
  const [all, setAll] = useState<readonly EmojiEntry[]>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadEmojis().then(setAll);
  }, []);

  const rows = useMemo(() => {
    const emojis = filterEmojis(all ?? [], query);
    return Array.from(
      { length: Math.ceil(emojis.length / COLUMNS) },
      (_, row) => emojis.slice(row * COLUMNS, (row + 1) * COLUMNS),
    );
  }, [all, query]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
  });

  if (all && rows.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("icon.emptyEmoji")}
      </p>
    );

  return (
    <div ref={scroller} className="h-60 overflow-y-auto">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            className="absolute inset-x-0 grid"
            style={{
              top: item.start,
              height: item.size,
              gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
            }}
          >
            {rows[item.index]?.map((entry) => (
              <button
                key={entry.emoji}
                type="button"
                aria-pressed={value === entry.emoji}
                aria-label={entry.label}
                title={entry.label}
                onClick={() => onPick(entry.emoji)}
                className="grid place-items-center rounded-md text-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent"
              >
                {entry.emoji}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
