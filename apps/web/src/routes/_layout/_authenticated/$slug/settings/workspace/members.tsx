import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/app/settings/settings-page";
import { PageTitle } from "@/design-system/page-title";
import {
  InviteTeamMemberModal,
  useWorkspaceInvitations,
  useWorkspaceMembers,
} from "@/members";
import { MembersTable } from "@/members";
import { Button } from "@/design-system/ui/button";
import { useWorkspacePermission } from "@/workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/$slug/settings/workspace/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace: resolved } = Route.useRouteContext();
  const workspaceId = resolved.id;
  const members = useWorkspaceMembers(workspaceId);
  const invitations = useWorkspaceInvitations(workspaceId);
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = Boolean(canInviteUsers());
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  return (
    <>
      <PageTitle title={t("team:members.pageTitle")} />
      <SettingsPage
        className="max-w-5xl"
        title={t("team:members.pageTitle")}
        actions={
          canInvite ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsInviteOpen(true)}
              className="gap-1"
            >
              <UserPlus className="w-3 h-3" />
              {t("team:members.inviteMember")}
            </Button>
          ) : null
        }
      >
        <div className="overflow-hidden rounded-xl border">
          <MembersTable
            workspaceId={workspaceId}
            users={members}
            invitations={invitations}
          />
        </div>

        <InviteTeamMemberModal
          open={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      </SettingsPage>
    </>
  );
}
