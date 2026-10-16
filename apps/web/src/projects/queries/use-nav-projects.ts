import type { ProjectIcon } from "@morrow/sync-schemas";
import { Folder, type LucideIcon } from "lucide-react";
import { projectColorClass } from "../components/project-icon";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";
import { useProjectsWithoutSuspense } from "./use-projects";

/** The workspace's active projects as navigation entries: key, name, icon component and its colour class. */
export function useNavProjects(workspaceId: string | undefined): Array<{
  key: string;
  name: string;
  icon: LucideIcon;
  iconClassName?: string;
}> {
  return useProjectsWithoutSuspense(workspaceId)
    .filter((project) => !project.archivedAt)
    .map((project) => ({
      key: project.key,
      name: project.name,
      icon:
        (project.icon && project.icon in PROJECT_ICON_COMPONENTS
          ? PROJECT_ICON_COMPONENTS[project.icon as ProjectIcon]
          : undefined) ?? Folder,
      iconClassName: projectColorClass(project.color),
    }));
}
