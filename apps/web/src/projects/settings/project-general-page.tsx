import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Textarea } from "@/design-system/ui/textarea";
import { useWorkspacePermission } from "@/workspace";
import {
  deleteProject,
  setProjectArchived,
  updateProject,
} from "../actions/project-actions";
import { BlurSaveInput } from "../components/blur-save-input";
import { ProjectIconPicker } from "../components/project-icon-picker";
import { ProjectBackgroundSetting } from "./project-background-setting";
import { ProjectKeyField } from "./project-key-field";
import { ProjectSettingsFrame } from "./project-settings-frame";
import type { ProjectRow } from "@morrow/sync-schemas";

export function ProjectGeneralPage({
  workspace,
  projectKey,
}: {
  workspace: { id: string; slug: string };
  projectKey: string;
}) {
  const { t } = useTranslation("projects");

  return (
    <ProjectSettingsFrame
      workspace={workspace}
      projectKey={projectKey}
      tab="general"
      title={t("general.title")}
    >
      {(project) => <GeneralSections workspace={workspace} project={project} />}
    </ProjectSettingsFrame>
  );
}

function GeneralSections({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const { canManageProjects, canDeleteProjects } = useWorkspacePermission();
  const archived = project.archivedAt !== null;
  const locked = archived || !canManageProjects();

  async function save(patch: Parameters<typeof updateProject>[1]) {
    try {
      await updateProject(project.id, patch);
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.saveError")));
    }
  }

  return (
    <>
      <SettingsSection title={t("general.detailsTitle")}>
        <SettingsCard>
          <div className="px-4 py-3.5">
            <ProjectBackgroundSetting project={project} disabled={locked} />
          </div>
          <SettingsRow stack title={t("general.nameLabel")}>
            <BlurSaveInput
              size="sm"
              className="sm:w-64"
              aria-label={t("general.nameLabel")}
              placeholder={t("general.namePlaceholder")}
              maxLength={100}
              disabled={locked}
              value={project.name}
              onCommit={(name) => save({ name })}
            />
          </SettingsRow>
          <SettingsRow
            stack
            title={t("general.keyLabel")}
            description={t("general.keyHint", { key: project.key })}
          >
            <ProjectKeyField
              project={project}
              slug={workspace.slug}
              disabled={locked}
            />
          </SettingsRow>
          <SettingsRow stack title={t("general.descriptionLabel")}>
            <DescriptionField
              value={project.description ?? ""}
              disabled={locked}
              onCommit={(description) => save({ description })}
            />
          </SettingsRow>
          <SettingsRow
            stack
            title={t("general.iconLabel")}
            description={t("general.iconHint")}
          >
            <ProjectIconPicker
              value={project.icon}
              disabled={locked}
              fallbackLetter={project.key.charAt(0)}
              onChange={(icon) => void save({ icon })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {canManageProjects() ? (
        <ArchiveSection project={project} archived={archived} />
      ) : null}

      {archived && canDeleteProjects() ? (
        <DangerZone workspace={workspace} project={project} />
      ) : null}
    </>
  );
}

/** A multi-line description that saves when it loses focus. */
function DescriptionField({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const { t } = useTranslation("projects");
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Textarea
      className="sm:w-80"
      rows={3}
      maxLength={2000}
      disabled={disabled}
      aria-label={t("general.descriptionLabel")}
      placeholder={t("general.descriptionPlaceholder")}
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = (draft ?? value).trim();
        setDraft(null);
        if (next !== value) onCommit(next);
      }}
    />
  );
}

function ArchiveSection({
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
      await setProjectArchived(project.id, !archived);
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

function DangerZone({
  workspace,
  project,
}: {
  workspace: { id: string; slug: string };
  project: ProjectRow;
}) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      toast.success(t("general.danger.success"));
      setConfirming(false);
      await navigate({
        to: "/$slug/projects",
        params: { slug: workspace.slug },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("general.danger.error")));
      setDeleting(false);
    }
  }

  return (
    <SettingsSection
      title={t("general.danger.title")}
      description={t("general.danger.subtitle")}
    >
      <SettingsCard tone="danger">
        <SettingsRow
          stack
          title={t("general.danger.deleteTitle")}
          description={t("general.danger.deleteDescription", {
            name: project.name,
          })}
        >
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            {t("general.danger.deleteButton")}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("general.danger.modalTitle")}
        description={t("general.danger.modalDescription", {
          name: project.name,
        })}
        confirmLabel={t("general.danger.modalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void remove()}
      />
    </SettingsSection>
  );
}
