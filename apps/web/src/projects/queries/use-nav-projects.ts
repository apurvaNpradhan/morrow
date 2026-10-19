import type { ProjectIcon } from "@morrow/sync-schemas";
import { Folder } from "lucide-react";
import type { CSSProperties } from "react";
import type { NavIcon } from "@/app/settings/nav/types";
import { projectColorStyle } from "../lib/column-style";
import { emojiIcon } from "../lib/emoji-icon";
import { emojiOfIcon } from "../lib/project-emojis";
import { PROJECT_ICON_COMPONENTS } from "../lib/project-icons";
import { useProjectsWithoutSuspense } from "./use-projects";

function navIcon(icon: string | null): NavIcon {
  const emoji = emojiOfIcon(icon);
  if (emoji) return emojiIcon(emoji);
  return (
    (icon && icon in PROJECT_ICON_COMPONENTS
      ? PROJECT_ICON_COMPONENTS[icon as ProjectIcon]
      : undefined) ?? Folder
  );
}

/** The workspace's active projects as navigation entries: key, name, icon component and its colour. */
export function useNavProjects(workspaceId: string | undefined): Array<{
  key: string;
  name: string;
  icon: NavIcon;
  iconStyle?: CSSProperties;
}> {
  return useProjectsWithoutSuspense(workspaceId)
    .filter((project) => !project.archivedAt)
    .map((project) => ({
      key: project.key,
      name: project.name,
      icon: navIcon(project.icon),
      iconStyle: projectColorStyle(project.color),
    }));
}
