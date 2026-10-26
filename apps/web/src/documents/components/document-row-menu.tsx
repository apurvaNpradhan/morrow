import type { DocumentRow } from "@morrow/sync-schemas";
import {
  Archive,
  FilePlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { copyToClipboard } from "@/design-system/copy-to-clipboard";
import { toast } from "@/design-system/toast";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { useWorkspacePermission } from "@/workspace";
import {
  archiveDocument,
  deleteDocument,
  restoreDocument,
} from "../actions/document-actions";

/**
 * The ⋯ on a page in the tree: add a subpage, rename, copy its link, archive
 * and, for those who may, delete. Archiving offers to undo it, because an
 * archived page leaves the tree.
 */
export function DocumentRowMenu({
  workspaceSlug,
  document,
  onAddSubpage,
  onRename,
}: {
  workspaceSlug: string;
  document: DocumentRow;
  onAddSubpage: () => void;
  onRename: () => void;
}) {
  const { t } = useTranslation("documents");
  const { canCreateDocuments, canEditDocuments, canDeleteDocuments } =
    useWorkspacePermission();
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);

  async function copyLink() {
    const link = `${window.location.origin}/${workspaceSlug}/pages/${document.id}`;
    if (await copyToClipboard(link)) toast.success(t("menu.linkCopied"));
    else toast.error(t("menu.copyFailed"));
  }

  async function archive() {
    try {
      await archiveDocument(document.id);
      toast.success(t("menu.archived"), {
        action: {
          label: t("menu.undo"),
          onClick: () =>
            void restoreDocument(document.id).catch((error: unknown) =>
              toast.error(errorMessage(t, error, t("menu.restoreError"))),
            ),
        },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("menu.archiveError")));
    }
  }

  async function remove() {
    setPending(true);
    try {
      await deleteDocument(document.id);
      setDeleting(false);
    } catch (error) {
      toast.error(errorMessage(t, error, t("menu.deleteError")));
    } finally {
      setPending(false);
    }
  }

  const name = document.title || t("untitled");
  return (
    <>
      <Menu>
        <MenuTrigger
          className="ml-auto grid size-5 shrink-0 place-items-center rounded-sm opacity-0 hover:bg-sidebar-accent focus-visible:opacity-100 group-hover/row:opacity-100 data-[popup-open]:opacity-100"
          aria-label={t("menu.label", { name })}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal aria-hidden="true" className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="start" side="right" className="min-w-44">
          {canCreateDocuments() ? (
            <MenuItem onClick={onAddSubpage}>
              <FilePlus aria-hidden="true" />
              {t("menu.addSubpage")}
            </MenuItem>
          ) : null}
          {canEditDocuments() ? (
            <MenuItem onClick={onRename}>
              <Pencil aria-hidden="true" />
              {t("menu.rename")}
            </MenuItem>
          ) : null}
          <MenuItem onClick={() => void copyLink()}>
            <Link2 aria-hidden="true" />
            {t("menu.copyLink")}
          </MenuItem>
          {canEditDocuments() ? (
            <MenuItem onClick={() => void archive()}>
              <Archive aria-hidden="true" />
              {t("menu.archive")}
            </MenuItem>
          ) : null}
          {canDeleteDocuments() ? (
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
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => !pending && setDeleting(open)}
        title={t("delete.title", { name })}
        description={t("delete.description")}
        confirmLabel={t("delete.confirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </>
  );
}
