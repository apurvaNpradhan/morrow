import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceLayout } from "@/app/components/workspace-layout";
import { PageTitle } from "@/design-system/page-title";
import { InviteTeamMemberModal, useWorkspaceMembers } from "@/members";
import { MembersTable } from "@/members";
import { Button } from "@/design-system/ui/button";
import { useGetFullWorkspace } from "@/workspace";
import { useWorkspacePermission } from "@/workspace";

export const Route = createFileRoute("/_layout/_authenticated/$slug/members")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace: resolved } = Route.useRouteContext();
  const workspaceId = resolved.id;
  const {
    data: workspace,
    isPending,
    isError,
    refetch,
  } = useGetFullWorkspace({ workspaceId });
  const members = useWorkspaceMembers(workspaceId);
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = Boolean(canInviteUsers());
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  return (
    <>
      <PageTitle title={t("team:members.pageTitle")} />
      <WorkspaceLayout
        title={t("team:members.pageTitle")}
        headerActions={
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
        {isPending ? (
          <p role="status" className="p-5 text-muted-foreground text-sm">
            {t("team:members.loading")}
          </p>
        ) : isError || !workspace ? (
          <div className="flex flex-col items-start gap-3 p-5">
            <p role="alert" className="text-muted-foreground text-sm">
              {t("team:members.loadError")}
            </p>
            <Button variant="outline" onClick={() => void refetch()}>
              {t("common:error.tryAgain")}
            </Button>
          </div>
        ) : (
          <MembersTable
            workspaceId={workspaceId}
            users={members}
            invitations={workspace.invitations}
          />
        )}

        <InviteTeamMemberModal
          open={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      </WorkspaceLayout>
    </>
  );
}
