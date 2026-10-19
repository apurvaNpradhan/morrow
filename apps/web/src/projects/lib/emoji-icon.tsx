import type { ComponentType, CSSProperties } from "react";
import { cn } from "@/design-system/cn";

type IconProps = { className?: string; style?: CSSProperties };

const cache = new Map<string, ComponentType<IconProps>>();

/** A component that draws an emoji where a Lucide icon goes, one per emoji so React keeps its identity between renders. */
export function emojiIcon(emoji: string): ComponentType<IconProps> {
  let component = cache.get(emoji);
  if (!component) {
    component = ({ className, style }) => (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center text-sm leading-none",
          className,
        )}
        style={style}
      >
        {emoji}
      </span>
    );
    cache.set(emoji, component);
  }
  return component;
}
