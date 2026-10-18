import { type CSSProperties, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { cn } from "@/design-system/cn";
import type { SlashCommand, SlashGroup } from "./slash-commands";

const GROUP_TITLES: Record<SlashGroup, string> = {
  text: "Text",
  lists: "Lists",
  insert: "Insert",
};

export type SlashMenuProps = {
  items: SlashCommand[];
  selected: number;
  style: CSSProperties;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
};

/**
 * The block list over the editor. The selected row is owned by the caller,
 * which moves it with the arrow keys; here the mouse only hovers and picks.
 */
export function SlashMenu({
  items,
  selected,
  style,
  onHover,
  onSelect,
}: SlashMenuProps) {
  useEffect(() => {
    // Optional call: jsdom does not implement scrollIntoView.
    document
      .getElementById(`slash-option-${selected}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  return (
    <div className="morrow-tiptap-slash-menu" style={style}>
      {items.length === 0 ? (
        <div className="morrow-tiptap-slash-empty">No matching blocks</div>
      ) : (
        <div role="listbox" aria-label="Blocks">
          {items.map((item, index) => (
            <div key={item.id}>
              {index === 0 || items[index - 1].group !== item.group ? (
                <div
                  role="presentation"
                  className="morrow-tiptap-slash-group-title"
                >
                  {GROUP_TITLES[item.group]}
                </div>
              ) : null}
              <div
                id={`slash-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === selected}
                className={cn(
                  "morrow-tiptap-slash-item",
                  index === selected && "is-selected",
                )}
                onMouseEnter={() => onHover(index)}
                // Picks on press; preventDefault keeps the editor focused.
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(index);
                }}
              >
                <span className="morrow-tiptap-slash-label">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Mounts the menu on the body, outside the editor, so no ancestor's overflow
 * or stacking clips it. Returns the handle the suggestion renderer drives.
 */
export function mountSlashMenu() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return {
    render: (props: SlashMenuProps) => root.render(<SlashMenu {...props} />),
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
