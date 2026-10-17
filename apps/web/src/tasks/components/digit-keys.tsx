import { useEffect, useRef } from "react";
import { Kbd } from "@/design-system/ui/kbd";

const MAX_DIGITS = 9;

/** The number key that picks an item, shown at the end of its row. */
export function DigitHint({ n }: { n: number }) {
  return n <= MAX_DIGITS ? (
    <Kbd aria-hidden="true" className="ms-auto h-4 min-w-4 text-[10px]">
      {n}
    </Kbd>
  ) : null;
}

/** The props that make an item answer to its number key (see `DigitKeys`). */
export function digitProps(n: number) {
  return n <= MAX_DIGITS ? { "data-digit": n } : {};
}

/**
 * Render once inside a menu's items: while the menu is open, pressing `1` to
 * `9` picks the item marked with that number, unless a text field has focus.
 */
export function DigitKeys() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!/^[1-9]$/.test(event.key)) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea"))
      ) {
        return;
      }
      const menu = anchor.current?.closest('[role="menu"]');
      const item = menu?.querySelector<HTMLElement>(
        `[data-digit="${event.key}"]`,
      );
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      item.click();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return <span ref={anchor} hidden aria-hidden="true" />;
}
