import { Loader2, Pencil, X } from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ACCEPTED_AVATAR_TYPES, avatarErrorKey } from "@/account";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/ui/menu";
import { toast } from "@/design-system/toast";
import { useRemoveWorkspaceLogo } from "./use-remove-workspace-logo";
import { useUploadWorkspaceLogo } from "./use-upload-workspace-logo";
import { WorkspaceLogo } from "./workspace-logo";

type WorkspaceLogoSettingProps = {
  workspaceId: string;
  name: string;
  logo: string | null | undefined;
  disabled?: boolean;
};

/** The logo row of workspace settings: click the logo to change or remove it. */
export function WorkspaceLogoSetting({
  workspaceId,
  name,
  logo,
  disabled,
}: WorkspaceLogoSettingProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: upload, isPending: isUploading } =
    useUploadWorkspaceLogo(workspaceId);
  const { mutateAsync: remove, isPending: isRemoving } =
    useRemoveWorkspaceLogo(workspaceId);
  const isBusy = isUploading || isRemoving;

  const handleSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        await upload(file);
        toast.success(t("settings:workspaceGeneral.logo.updateSuccess"));
      } catch (error) {
        toast.error(
          t(
            avatarErrorKey(error, "settings:workspaceGeneral.logo.updateError"),
          ),
        );
      }
    },
    [upload, t],
  );

  const handleRemoved = useCallback(async () => {
    try {
      await remove();
      toast.success(t("settings:workspaceGeneral.logo.removeSuccess"));
    } catch (error) {
      toast.error(
        t(avatarErrorKey(error, "settings:workspaceGeneral.logo.removeError")),
      );
    }
  }, [remove, t]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          {t("settings:workspaceGeneral.logo.label")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("settings:workspaceGeneral.logo.hint")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES}
        className="hidden"
        onChange={handleSelected}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("settings:workspaceGeneral.logo.edit")}
              disabled={disabled || isBusy}
              className="group relative rounded-md outline-none transition-transform duration-150 ease-out active:scale-97 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar disabled:cursor-not-allowed"
            />
          }
        >
          <WorkspaceLogo name={name} logo={logo} className="size-10 text-xs" />
          {disabled ? null : (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[popup-open]:opacity-100 group-disabled:opacity-100">
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-3.5" />
              )}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Pencil />
            {t("settings:workspaceGeneral.logo.change")}
          </DropdownMenuItem>
          {logo ? (
            <DropdownMenuItem onClick={handleRemoved}>
              <X />
              {t("settings:workspaceGeneral.logo.remove")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
