import type { ProjectIcon as ProjectIconName } from "@morrow/sync-schemas";
import { cn } from "@/design-system/cn";
import { projectColorStyle } from "../lib/column-style";
import { emojiOfIcon } from "../lib/project-emojis";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";

type ProjectIconProps = {
  project: { icon: string | null; key: string; color?: string | null };
  className?: string;
};

/** A project's icon in its colour, or the first letter of its key when it has none. */
export function ProjectIcon({ project, className }: ProjectIconProps) {
  const Icon =
    project.icon && project.icon in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[project.icon as ProjectIconName]
      : null;
  const tint = projectColorStyle(project.color);
  const emoji = emojiOfIcon(project.icon);
  if (emoji)
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 place-items-center text-sm leading-none",
          className,
        )}
      >
        {emoji}
      </span>
    );
  if (Icon)
    return (
      <Icon
        aria-hidden="true"
        className={cn("size-4", className)}
        style={tint}
      />
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-4 place-items-center text-[11px] leading-none font-semibold",
        className,
      )}
      style={tint}
    >
      {project.key.charAt(0)}
    </span>
  );
}
