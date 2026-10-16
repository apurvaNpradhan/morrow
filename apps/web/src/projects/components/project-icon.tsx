import type { ProjectIcon as ProjectIconName } from "@morrow/sync-schemas";
import { cn } from "@/design-system/cn";
import { COLUMN_COLOR_CLASSES } from "../lib/column-style";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";

type ProjectIconProps = {
  project: { icon: string | null; key: string; color?: string | null };
  className?: string;
};

/** The text colour of a project's colour token; nothing for none or an unknown one. */
export function projectColorClass(color: string | null | undefined) {
  return color && color in COLUMN_COLOR_CLASSES
    ? COLUMN_COLOR_CLASSES[color as keyof typeof COLUMN_COLOR_CLASSES].text
    : undefined;
}

/** A project's icon in its colour, or the first letter of its key when it has none. */
export function ProjectIcon({ project, className }: ProjectIconProps) {
  const Icon =
    project.icon && project.icon in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[project.icon as ProjectIconName]
      : null;
  const tint = projectColorClass(project.color);
  if (Icon)
    return (
      <Icon aria-hidden="true" className={cn("size-4", tint, className)} />
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-4 place-items-center text-[11px] leading-none font-semibold",
        tint,
        className,
      )}
    >
      {project.key.charAt(0)}
    </span>
  );
}
