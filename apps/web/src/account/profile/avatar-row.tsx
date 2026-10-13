import { Loader2Icon, PencilIcon, XIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/app/settings/settings-row";
import { useAuth } from "@/auth";
import { getInitials } from "@/design-system/get-initials";
import { toast } from "@/design-system/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/design-system/ui/menu";
import { avatarErrorKey } from "@/account/avatar-error-key";
import { ACCEPTED_AVATAR_TYPES } from "@/account/prepare-avatar-image";
import { useRemoveUserAvatar } from "@/account/queries/use-remove-user-avatar";
import { useUpdateUserAvatar } from "@/account/queries/use-update-user-avatar";

export function AvatarRow() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const { mutateAsync: updateAvatar, isPending: isUploading } =
    useUpdateUserAvatar();
  const { mutateAsync: removeAvatar, isPending: isRemoving } =
    useRemoveUserAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = isUploading || isRemoving;

  const onSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await updateAvatar(file);
      await refetchUser();
      toast.success(t("settings:informationPage.avatar.updateSuccess"));
    } catch (error) {
      toast.error(
        t(avatarErrorKey(error, "settings:informationPage.avatar.updateError")),
      );
    }
  };

  const onRemove = async () => {
    try {
      await removeAvatar();
      await refetchUser();
      toast.success(t("settings:informationPage.avatar.removeSuccess"));
    } catch (error) {
      toast.error(
        t(avatarErrorKey(error, "settings:informationPage.avatar.removeError")),
      );
    }
  };

  return (
    <SettingsRow
      stack
      title={t("settings:informationPage.profilePicture")}
      description={t("settings:informationPage.avatar.hint")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES}
        className="hidden"
        onChange={onSelected}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("settings:informationPage.avatar.edit")}
              disabled={busy}
              className="group relative rounded-full outline-none transition-transform duration-150 ease-out active:scale-97 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            />
          }
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
            <AvatarFallback className="border border-border/30 text-xs font-medium">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[popup-open]:opacity-100 group-disabled:opacity-100">
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PencilIcon className="size-3.5" />
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <PencilIcon />
            {t("settings:informationPage.avatar.change")}
          </DropdownMenuItem>
          {user?.image ? (
            <DropdownMenuItem onClick={onRemove}>
              <XIcon />
              {t("settings:informationPage.avatar.remove")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </SettingsRow>
  );
}
