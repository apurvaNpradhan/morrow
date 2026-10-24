import type { FieldType } from "@morrow/sync-schemas";
import {
  CalendarDays,
  CircleDot,
  Hash,
  ListChecks,
  SquareCheck,
  Type,
} from "lucide-react";

const ICONS = {
  single_choice: CircleDot,
  multi_choice: ListChecks,
  text: Type,
  number: Hash,
  date: CalendarDays,
  checkbox: SquareCheck,
} as const satisfies Record<FieldType, unknown>;

/** The glyph that stands for a kind of custom Field. */
export function FieldTypeIcon({
  type,
  className = "size-3.5",
}: {
  type: FieldType;
  className?: string;
}) {
  const Icon = ICONS[type];
  return <Icon aria-hidden="true" className={className} />;
}
