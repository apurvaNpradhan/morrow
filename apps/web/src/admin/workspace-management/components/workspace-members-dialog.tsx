import { RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Frame } from "@/design-system/ui/frame";
import { Skeleton } from "@/design-system/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/ui/table";
import type { AdminWorkspace } from "@/admin/lib/admin-types";
import { useRemoveAdminWorkspaceMember } from "@/admin/workspace-management/queries/use-remove-admin-workspace-member";
import { useTransferAdminWorkspaceOwnership } from "@/admin/workspace-management/queries/use-transfer-admin-workspace-ownership";
import { useUpdateAdminWorkspaceMemberRole } from "@/admin/workspace-management/queries/use-update-admin-workspace-member-role";
import { useAdminWorkspaceMembers } from "@/admin/workspace-management/queries/use-admin-workspace-members";
import { useAdminWorkspaceRoles } from "@/admin/workspace-management/queries/use-admin-workspace-roles";
import { AddWorkspaceMemberDialog } from "./add-workspace-member-dialog";
import { getAssignableRoleOptions } from "@/admin/workspace-management/lib/get-assignable-role-options";
import { isWorkspaceOwnerRole } from "@/admin/workspace-management/lib/is-workspace-owner-role";
import type { PendingMemberAction } from "@/admin/workspace-management/lib/pending-member-action";
import { sortWorkspaceMembers } from "@/admin/workspace-management/lib/sort-workspace-members";
import { WorkspaceMemberConfirmDialog } from "./workspace-member-confirm-dialog";
import { WorkspaceMemberRow } from "./workspace-member-row";

const COLUMN_COUNT = 4;

type Props = {
  workspace: AdminWorkspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WorkspaceMembersDialog({
  workspace,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  const workspaceId = workspace?.id ?? "";
  const workspaceName = workspace?.name ?? "";
  const [pendingAction, setPendingAction] =
    useState<PendingMemberAction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useAdminWorkspaceMembers(workspaceId, open);
  const { data: roles } = useAdminWorkspaceRoles(workspaceId, open);
  const updateRole = useUpdateAdminWorkspaceMemberRole();
  const removeMember = useRemoveAdminWorkspaceMember();
  const transferOwnership = useTransferAdminWorkspaceOwnership();

  const sortedMembers = sortWorkspaceMembers(members ?? []);
  const ownerCount = sortedMembers.filter((member) =>
    isWorkspaceOwnerRole(member.role),
  ).length;
  const memberIds = new Set(sortedMembers.map((member) => member.userId));
  const isConfirming = removeMember.isPending || transferOwnership.isPending;

  const handleConfirm = async () => {
    if (!pendingAction || !workspaceId) return;
    const target = { workspaceId, userId: pendingAction.member.userId };

    try {
      if (pendingAction.type === "transfer") {
        await transferOwnership.mutateAsync(target);
      } else {
        await removeMember.mutateAsync(target);
      }
      setPendingAction(null);
    } catch {
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t("settings:adminWorkspaces.members.title", {
              name: workspaceName,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settings:adminWorkspaces.members.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              {members ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings:adminWorkspaces.members.count", {
                    count: members.length,
                  })}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="ms-auto"
                disabled={!members}
                onClick={() => setIsAddOpen(true)}
              >
                <UserPlusIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.members.add")}
              </Button>
            </div>

            <Frame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("settings:adminWorkspaces.members.columns.member")}
                    </TableHead>
                    <TableHead>
                      {t("settings:adminWorkspaces.members.columns.role")}
                    </TableHead>
                    <TableHead>
                      {t("settings:adminWorkspaces.members.columns.joined")}
                    </TableHead>
                    <TableHead className="w-px">
                      <span className="sr-only">
                        {t("settings:adminWorkspaces.members.columns.actions")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? ["first", "second", "third"].map((skeleton) => (
                        <TableRow key={skeleton}>
                          <TableCell className="py-3" colSpan={COLUMN_COUNT}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : null}

                  {!isLoading && isError ? (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="h-40 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-sm text-muted-foreground">
                            {t("settings:adminWorkspaces.members.loadError")}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                          >
                            <RefreshCwIcon aria-hidden="true" />
                            {t("settings:adminWorkspaces.retry")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isLoading && !isError && sortedMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        className="h-40 text-center text-sm text-muted-foreground"
                      >
                        {t("settings:adminWorkspaces.members.empty")}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isLoading && !isError
                    ? sortedMembers.map((member) => {
                        const isOwner = isWorkspaceOwnerRole(member.role);
                        return (
                          <WorkspaceMemberRow
                            key={member.userId}
                            member={member}
                            roleOptions={getAssignableRoleOptions(
                              roles,
                              member.role,
                            )}
                            isOnlyOwner={isOwner && ownerCount === 1}
                            isUpdatingRole={
                              updateRole.isPending &&
                              updateRole.variables?.userId === member.userId
                            }
                            onRoleChange={(role) =>
                              updateRole.mutate({
                                workspaceId,
                                userId: member.userId,
                                role,
                              })
                            }
                            onMakeOwner={() =>
                              setPendingAction({ type: "transfer", member })
                            }
                            onRemove={() =>
                              setPendingAction({ type: "remove", member })
                            }
                          />
                        );
                      })
                    : null}
                </TableBody>
              </Table>
            </Frame>
          </div>
        </DialogPanel>

        <AddWorkspaceMemberDialog
          workspace={workspace}
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          memberIds={memberIds}
          roleOptions={getAssignableRoleOptions(roles)}
        />

        <WorkspaceMemberConfirmDialog
          action={pendingAction}
          workspaceName={workspaceName}
          isPending={isConfirming}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      </DialogPopup>
    </Dialog>
  );
}
