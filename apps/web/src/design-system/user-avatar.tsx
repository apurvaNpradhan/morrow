import { workspaceUrl } from "@morrow/permissions/workspace-url";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/menu";
import { Separator } from "./ui/separator";
import { useSignOut } from "@/auth";
import { useActiveWorkspace } from "@/workspace";
import { getInitials } from "./get-initials";
import { toast } from "./toast";
import { errorMessage } from "@/app/lib/error-message";

export function UserAvatar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mutateAsync: signOut, isPending } = useSignOut();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(t("navigation:userMenu.signedOutSuccess"));
    } catch (error) {
      toast.error(
        errorMessage(t, error, t("navigation:userMenu.signOutFailed")),
      );
    }
  };

  const handleSettings = () => {
    if (!workspace) return;
    navigate({
      to: workspaceUrl(
        workspace.slug,
        "/settings/account/information",
      ) as never,
    });
  };

  const initials = getInitials(user.name || user.email, "UN");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full p-0 hover:bg-sidebar-accent/70"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
            <AvatarFallback className="text-xs font-medium border border-border/30">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 p-0" side="bottom" align="start">
        <div className="px-2.5 py-2">
          <div className="flex items-center gap-2 text-left text-sm">
            <Avatar className="h-7 w-7 rounded-full">
              <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
              <AvatarFallback className="rounded-full border border-border/30">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {user.name || t("navigation:userMenu.unnamedUser")}
              </span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="p-0.5">
          <DropdownMenuItem
            onClick={handleSettings}
            className="h-7 gap-2 px-2 text-sm font-normal"
          >
            <Settings className="size-3.5" />
            {t("navigation:userMenu.settings")}
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        <div className="p-0.5">
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={isPending}
            className="h-7 gap-2 px-2 text-sm font-normal"
          >
            <LogOut className="size-3.5" />
            {isPending
              ? t("navigation:userMenu.signingOut")
              : t("navigation:userMenu.logOut")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
