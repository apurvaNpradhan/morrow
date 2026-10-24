import {
  CircleArrowRight,
  CircleMinus,
  CircleSlash2,
  CornerDownRight,
  Flag,
  ListTree,
} from "lucide-react";
import type { RELATION_VALUES } from "../lib/filters";

const ICONS = {
  parentTask: ListTree,
  subtask: CornerDownRight,
  blocked: CircleMinus,
  blocking: CircleArrowRight,
  hasRelations: Flag,
  duplicate: CircleSlash2,
};

/** The glyph of a Relations filter choice. */
export function RelationIcon({
  value,
}: {
  value: (typeof RELATION_VALUES)[number];
}) {
  const Icon = ICONS[value];
  return <Icon aria-hidden="true" className="size-4 text-muted-foreground" />;
}
