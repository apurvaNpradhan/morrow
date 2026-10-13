import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { useWorkspaceSlugField } from "@/workspace";
import { WorkspaceSlugField } from "@/workspace";
import { useRenameWorkspaceSlug } from "@/workspace";
import { errorCode } from "@/app/lib/orpc-error";
import { toast } from "@/design-system/toast";
import { errorMessage } from "@/app/lib/error-message";

type WorkspaceSlugSettingsProps = {
  workspaceId: string;
  /** The workspace's current slug. Remount (key) when it changes. */
  slug: string;
  canEdit: boolean;
};

/** Rename the workspace URL. Old links keep redirecting, so this is safe to do. */
export function WorkspaceSlugSettings({
  workspaceId,
  slug,
  canEdit,
}: WorkspaceSlugSettingsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const field = useWorkspaceSlugField({ workspaceId, initialSlug: slug });
  const { mutateAsync: rename, isPending } = useRenameWorkspaceSlug();
  const [lostSlug, setLostSlug] = useState<string | null>(null);
  const status = lostSlug === field.slug ? "taken" : field.status;
  const canSave =
    canEdit && !field.isUnchanged && field.isUsable && lostSlug !== field.slug;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || isPending) return;
    try {
      const { slug: next } = await rename({ workspaceId, slug: field.slug });
      toast.success(t("settings:workspaceGeneral.slug.toastRenamed"));
      // The old URL gets no history entry, so Back never lands on it.
      await navigate({
        to: "/$slug/settings/workspace/general",
        params: { slug: next },
        replace: true,
      });
    } catch (error) {
      if (errorCode(error) === "CONFLICT") {
        setLostSlug(field.slug);
        return;
      }
      toast.error(
        errorMessage(t, error, t("settings:workspaceGeneral.slug.toastError")),
      );
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <WorkspaceSlugField
        value={field.slug}
        status={status}
        onChange={field.setSlug}
        disabled={!canEdit}
        hint={t("settings:workspaceGeneral.slug.oldLinksKeepWorking")}
      />
      {canEdit ? (
        <Button type="submit" size="sm" disabled={!canSave || isPending}>
          {t("settings:workspaceGeneral.slug.save")}
        </Button>
      ) : null}
    </form>
  );
}
