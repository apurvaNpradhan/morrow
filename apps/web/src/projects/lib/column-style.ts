import {
  type ColumnCategory,
  type ColumnColor,
  colorHex,
} from "@morrow/sync-schemas";
import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

/** A colour as a dot: a filled circle in the colour itself. */
export function colorDotStyle(color: string): CSSProperties {
  return { backgroundColor: color };
}

/** A colour as foreground: an icon or text drawn in the colour itself. */
export function colorTextStyle(color: ColumnColor): CSSProperties {
  return { color };
}

/** A lane's faint tint: the colour at 5% opacity, layered over the card background. */
export function colorLaneStyle(color: ColumnColor): CSSProperties {
  return { backgroundImage: `linear-gradient(${color}0d, ${color}0d)` };
}

/** A project's colour as text; nothing for no colour or a value that is not a hex colour. */
export function projectColorStyle(
  color: string | null | undefined,
): CSSProperties | undefined {
  const parsed = colorHex.safeParse(color);
  return parsed.success ? { color: parsed.data } : undefined;
}

/** A column's icon follows its category, so its meaning shows without configuration. */
export const CATEGORY_ICONS = {
  backlog: CircleDashed,
  unstarted: Circle,
  started: CircleDot,
  done: CircleCheck,
  canceled: CircleX,
} as const satisfies Record<ColumnCategory, LucideIcon>;
