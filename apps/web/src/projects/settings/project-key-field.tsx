import { PROJECT_KEY_PATTERN } from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { ConfirmDialog } from "@/app/settings/confirm-dialog";
import { toast } from "@/design-system/toast";
import { Input } from "@/design-system/ui/input";
import { updateProject } from "../actions/project-actions";

type ProjectKeyFieldProps = {
  project: { id: string; key: string };
  slug: string;
  disabled: boolean;
};

/**
 * The key field. A changed, valid key is saved when the field loses focus,
 * after a confirmation: old links and ticket ids stop working.
 */
export function ProjectKeyField({
  project,
  slug,
  disabled,
}: ProjectKeyFieldProps) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = draft ?? project.key;
  const invalid = draft !== null && !PROJECT_KEY_PATTERN.test(draft);

  function onBlur() {
    if (draft === null) return;
    if (draft === project.key) return setDraft(null);
    if (!PROJECT_KEY_PATTERN.test(draft)) return;
    setPending(draft);
  }

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await updateProject(project.id, { key: pending });
      toast.success(t("general.keyChange.success"));
      const key = pending;
      setPending(null);
      setDraft(null);
      await navigate({
        to: "/$slug/settings/projects/$key/general",
        params: { slug, key },
        replace: true,
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("settings.saveError")));
      setPending(null);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Input
        size="sm"
        className="font-mono uppercase sm:w-40"
        value={text}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={t("general.keyLabel")}
        onChange={(event) =>
          setDraft(event.target.value.toUpperCase().slice(0, 6))
        }
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
      />
      {invalid ? (
        <p role="alert" className="text-xs text-destructive">
          {t("general.keyInvalid")}
        </p>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPending(null);
            setDraft(null);
          }
        }}
        title={t("general.keyChange.title")}
        description={t("general.keyChange.description", {
          previous: project.key,
          next: pending ?? "",
        })}
        confirmLabel={t("general.keyChange.confirm")}
        pending={saving}
        destructive={false}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
