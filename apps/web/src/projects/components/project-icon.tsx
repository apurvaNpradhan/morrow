import type { ProjectIcon as ProjectIconName } from "@morrow/sync-schemas";
import { cn } from "@/design-system/cn";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";

type ProjectIconProps = {
  project: { icon: string | null; key: string };
  className?: string;
};

/** A project's icon, or the first letter of its key when it has none. */
export function ProjectIcon({ project, className }: ProjectIconProps) {
  const Icon =
    project.icon && project.icon in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[project.icon as ProjectIconName]
      : null;
  if (Icon)
    return <Icon aria-hidden="true" className={cn("size-4", className)} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-4 place-items-center text-[11px] leading-none font-semibold",
        className,
      )}
    >
      {project.key.charAt(0)}
    </span>
  );
}
