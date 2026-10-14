import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/design-system/ui/textarea";

/** A multi-line description that saves when it loses focus. */
export function ProjectDescriptionField({
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
