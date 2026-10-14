import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import type { ProjectRow } from "@morrow/sync-schemas";
import { updateProject } from "../actions/project-actions";

export function ProjectArchiveSection({
  project,
  archived,
}: {
  project: ProjectRow;
  archived: boolean;
}) {
  const { t } = useTranslation("projects");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await updateProject(project.id, {
        archivedAt: archived ? null : new Date(),
      });
      toast.success(
        t(
          archived
            ? "general.archive.restoreSuccess"
            : "general.archive.success",
        ),
      );
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
    } finally {
      setBusy(false);
    }
  }

  const Icon = archived ? ArchiveRestore : Archive;
  return (
    <SettingsSection>
      <SettingsCard>
        <SettingsRow
          stack
          title={t(
            archived ? "general.archive.restoreTitle" : "general.archive.title",
          )}
          description={t(
            archived
              ? "general.archive.restoreDescription"
              : "general.archive.description",
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void toggle()}
          >
            <Icon aria-hidden="true" />
            {t(
              archived
                ? "general.archive.restoreButton"
                : "general.archive.button",
            )}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
