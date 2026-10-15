import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectRow } from "@morrow/sync-schemas";
import { errorMessage } from "@/app/lib/error-message";
import { copyToClipboard } from "@/design-system/copy-to-clipboard";
import { toast } from "@/design-system/toast";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { SidebarMenuAction } from "@/design-system/ui/sidebar";
import { useWorkspacePermission } from "@/workspace";
import { updateProject } from "../actions/project-actions";
import { DeleteProjectDialog } from "./delete-project-dialog";

/**
 * The ⋯ on a Project in the sidebar: view it, copy its link, open its settings,
 * archive or restore it, and, with permission, delete it.
 */
export function ProjectMenu({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { canManageProjects, canDeleteProjects } = useWorkspacePermission();
  const [deleting, setDeleting] = useState(false);
  const archived = project.archivedAt !== null;

  async function copyLink() {
    const link = `${window.location.origin}/${workspace.slug}/projects/${project.key}`;
    if (await copyToClipboard(link)) toast.success(t("menu.linkCopied"));
    else toast.error(t("menu.copyFailed"));
  }

  async function toggleArchived() {
    try {
      await updateProject(project.id, {
        archivedAt: archived ? null : new Date(),
      });
    } catch (error) {
      toast.error(
        errorMessage(
          t,
          error,
          t(
            archived ? "general.archive.restoreError" : "general.archive.error",
          ),
        ),
      );
    }
  }

  return (
    <>
      <Menu>
        <MenuTrigger
          render={<SidebarMenuAction showOnHover />}
          aria-label={t("menu.label", { name: project.name })}
        >
          <MoreHorizontal aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="start" side="right" className="min-w-44">
          <MenuItem
            render={
              <Link
                to="/$slug/projects/$key"
                params={{ slug: workspace.slug, key: project.key }}
              />
            }
          >
            <ExternalLink aria-hidden="true" />
            {t("menu.view")}
          </MenuItem>
          <MenuItem onClick={() => void copyLink()}>
            <Link2 aria-hidden="true" />
            {t("menu.copyLink")}
          </MenuItem>
          {canManageProjects() ? (
            <>
              <MenuItem
                render={
                  <Link
                    to="/$slug/settings/projects/$key/general"
                    params={{ slug: workspace.slug, key: project.key }}
                  />
                }
              >
                <Settings aria-hidden="true" />
                {t("menu.settings")}
              </MenuItem>
              <MenuItem onClick={() => void toggleArchived()}>
                {archived ? (
                  <ArchiveRestore aria-hidden="true" />
                ) : (
                  <Archive aria-hidden="true" />
                )}
                {t(archived ? "menu.unarchive" : "menu.archive")}
              </MenuItem>
            </>
          ) : null}
          {canDeleteProjects() ? (
            <>
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden="true" />
                {t("menu.delete")}
              </MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>
      <DeleteProjectDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => {
          // Leave the page of the Project that is gone.
          const path = window.location.pathname;
          if (
            path.includes(`/projects/${project.key}`) ||
            path.includes(`/tasks/${project.key}-`)
          ) {
            void navigate({
              to: "/$slug/projects",
              params: { slug: workspace.slug },
            });
          }
        }}
      />
    </>
  );
}
