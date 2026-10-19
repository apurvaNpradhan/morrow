import {
  type ColumnColor,
  PROJECT_KEY_PATTERN,
  type ProjectIcon,
} from "@morrow/sync-schemas";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { createProject } from "../actions/project-actions";
import { suggestProjectKey } from "../lib/suggest-project-key";
import { useProjectsWithoutSuspense } from "../queries/use-projects";
import { ProjectIconPicker } from "./project-icon-picker";

const DEFAULT_ICON: ProjectIcon = "Folder";

type CreateProjectDialogProps = {
  workspace: { id: string; slug: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({
  workspace,
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const takenKeys = new Set(
    useProjectsWithoutSuspense(workspace.id).map((project) => project.key),
  );
  const [name, setName] = useState("");
  const [typedKey, setTypedKey] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(DEFAULT_ICON);
  const [color, setColor] = useState<ColumnColor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The key follows the name until the user types their own.
  const key = typedKey ?? suggestProjectKey(name, takenKeys);
  const keyValid = PROJECT_KEY_PATTERN.test(key);
  const keyTaken = takenKeys.has(key);
  const canSubmit = name.trim().length > 0 && keyValid && !keyTaken;

  function reset() {
    setName("");
    setTypedKey(null);
    setIcon(DEFAULT_ICON);
    setColor(null);
    setSubmitting(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await createProject({
        workspaceId: workspace.id,
        name: name.trim(),
        key,
        icon: icon ?? undefined,
        color: color ?? undefined,
      });
      toast.success(t("create.success"));
      onOpenChange(false);
      await navigate({
        to: "/$slug/projects/$key",
        params: { slug: workspace.slug, key },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("create.error")));
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) reset();
      }}
    >
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {t("create.description")}
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <DialogPanel className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">{t("create.nameLabel")}</Label>
              <div className="flex items-center gap-2">
                <ProjectIconPicker
                  value={icon}
                  onChange={setIcon}
                  color={color}
                  onColorChange={setColor}
                  fallbackLetter={key.charAt(0)}
                />
                <Input
                  id="project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("create.namePlaceholder")}
                  maxLength={100}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-key">{t("create.keyLabel")}</Label>
              <Input
                id="project-key"
                className="font-mono uppercase"
                value={key}
                onChange={(event) =>
                  setTypedKey(event.target.value.toUpperCase().slice(0, 6))
                }
                aria-invalid={key !== "" && (!keyValid || keyTaken)}
                aria-describedby="project-key-hint"
              />
              <p
                id="project-key-hint"
                className={
                  key !== "" && (!keyValid || keyTaken)
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {key !== "" && !keyValid
                  ? t("create.keyInvalid")
                  : keyTaken
                    ? t("create.keyTaken")
                    : t("create.keyHint", { key: key || "KEY" })}
              </p>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" size="sm" />}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" size="sm" disabled={!canSubmit || submitting}>
              {submitting ? t("create.creating") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
