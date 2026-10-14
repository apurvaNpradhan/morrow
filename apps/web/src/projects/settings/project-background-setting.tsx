import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ORPCError } from "@orpc/client";
import { errorMessageKey } from "@/app/lib/orpc-error";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/ui/menu";
import {
  removeProjectBackground,
  uploadProjectBackground,
} from "../actions/background-actions";
import {
  BackgroundImageError,
  prepareBackgroundImage,
} from "../lib/prepare-background-image";

const IMAGE_ERROR_KEYS = {
  "not-image": "settings:informationPage.avatar.notImage",
  "source-too-large": "settings:informationPage.avatar.sourceTooLarge",
  unreadable: "settings:informationPage.avatar.unreadable",
} as const;

/** The i18n key for a failed background change; the error's own text is never shown. */
function failureKey(error: unknown, fallbackKey: string) {
  if (error instanceof BackgroundImageError) {
    return IMAGE_ERROR_KEYS[error.reason];
  }
  return error instanceof ORPCError ? errorMessageKey(error) : fallbackKey;
}

type ProjectBackgroundSettingProps = {
  project: { id: string; workspaceId: string; backgroundUrl: string | null };
  disabled: boolean;
};

/** The background row: a preview that opens a menu to upload or remove the image. */
export function ProjectBackgroundSetting({
  project,
  disabled,
}: ProjectBackgroundSettingProps) {
  const { t } = useTranslation("projects");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const target = { workspaceId: project.workspaceId, projectId: project.id };

  async function run(
    action: () => Promise<void>,
    success: string,
    fallbackKey: string,
  ) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(t(failureKey(error, fallbackKey)));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run(
      async () =>
        uploadProjectBackground({
          ...target,
          file: await prepareBackgroundImage(file),
        }),
      t("general.background.updateSuccess"),
      "projects:general.background.updateError",
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("general.background.label")}</p>
        <p className="text-xs text-muted-foreground">
          {t("general.background.hint")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled || busy}
              aria-label={t("general.background.edit")}
              className="h-12 w-28 shrink-0 overflow-hidden p-0"
            />
          }
        >
          {project.backgroundUrl ? (
            <img
              src={project.backgroundUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : busy ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <ImagePlus aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden="true" />
            {t("general.background.change")}
          </DropdownMenuItem>
          {project.backgroundUrl ? (
            <DropdownMenuItem
              onClick={() =>
                void run(
                  () => removeProjectBackground(target),
                  t("general.background.removeSuccess"),
                  "projects:general.background.removeError",
                )
              }
            >
              <X aria-hidden="true" />
              {t("general.background.remove")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
