import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { type UserInvitation } from "@/members";

type InvitationCardListProps = {
  invitations: Pick<UserInvitation, "id" | "workspaceName" | "inviterName">[];
  joiningId: string | null;
  onJoin: (invitationId: string) => void;
};

/** Pending invitations as cards with a Join action. */
export function InvitationCardList({
  invitations,
  joiningId,
  onJoin,
}: InvitationCardListProps) {
  const { t } = useTranslation();

  return (
    <ul className="space-y-2">
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {invitation.workspaceName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("auth:onboarding.workspace.invitedBy", {
                name: invitation.inviterName,
              })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            loading={joiningId === invitation.id}
            disabled={joiningId !== null}
            onClick={() => onJoin(invitation.id)}
          >
            {t("auth:onboarding.workspace.join")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
