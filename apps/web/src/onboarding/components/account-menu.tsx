import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/design-system/ui/menu";
import { useSignOut } from "@/auth";

/** Who is signed in, with the way out: onboarding has no sidebar to host it. */
export function AccountMenu({ email }: { email: string }) {
  const { t } = useTranslation();
  const { mutate: signOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer rounded-md text-right text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("auth:onboarding.loggedInAs")}
        <span className="block text-sm text-foreground">{email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("auth:onboarding.accounts")}</DropdownMenuLabel>
          <DropdownMenuItem closeOnClick={false}>
            <span className="flex-1">{email}</span>
            <Check aria-hidden="true" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          {t("auth:onboarding.logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
