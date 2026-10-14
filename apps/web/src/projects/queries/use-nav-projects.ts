import type { ProjectIcon } from "@morrow/sync-schemas";
import { Folder, type LucideIcon } from "lucide-react";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";
import { useProjectsOutsidePages } from "./use-projects";

/** The workspace's active projects as navigation entries: key, name and icon component. */
export function useNavProjects(
  workspaceId: string | undefined,
): Array<{ key: string; name: string; icon: LucideIcon }> {
  return useProjectsOutsidePages(workspaceId)
    .filter((project) => !project.archivedAt)
    .map((project) => ({
      key: project.key,
      name: project.name,
      icon:
        (project.icon && project.icon in PROJECT_ICON_COMPONENTS
          ? PROJECT_ICON_COMPONENTS[project.icon as ProjectIcon]
          : undefined) ?? Folder,
    }));
}
