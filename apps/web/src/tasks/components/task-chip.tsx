import type { ReactNode } from "react";
import { cn } from "@/design-system/cn";

/**
 * A small field on a card or row. With `onOpen` it is a button that opens that
 * field's picker; the card underneath does not see the click or the press.
 */
export function TaskChip({
  children,
  label,
  onOpen,
  tone = "default",
}: {
  children: ReactNode;
  label: string;
  onOpen?: (anchor: HTMLElement) => void;
  tone?: "default" | "danger";
}) {
  const className = cn(
    "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs tabular-nums",
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground",
  );
  if (!onOpen) {
    return (
      <span className={className} title={label}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        className,
        "cursor-pointer outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      {children}
    </button>
  );
}
