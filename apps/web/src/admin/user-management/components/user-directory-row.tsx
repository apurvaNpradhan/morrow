import {
  BanIcon,
  CheckCircle2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { hasInstanceAdminRole } from "@/admin/lib/instance-admin";
import type { AdminUser } from "@/admin/use-admin-users";
import {
  RowActionsMenu,
  type RowAction,
} from "@/app/settings/row-actions-menu";
import { formatDateMedium } from "@/design-system/format";
import { getInitials } from "@/design-system/get-initials";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import { TableCell, TableRow } from "@/design-system/ui/table";
import type { PendingUserAction } from "@/admin/user-management/pending-user-action";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatus } from "./user-status";

export function UserDirectoryRow({
  user,
  isSelf,
  onEdit,
  onAction,
}: {
  user: AdminUser;
  isSelf: boolean;
  onEdit: (user: AdminUser) => void;
  onAction: (action: PendingUserAction) => void;
}) {
  const { t } = useTranslation();
  const deactivated = user.banned === true;

  const actions: RowAction[] = [
    {
      id: "edit",
      label: t("settings:adminUsers.actions.edit"),
      icon: PencilIcon,
      onSelect: () => onEdit(user),
    },
  ];
  if (!isSelf) {
    actions.push(
      deactivated
        ? {
            id: "reactivate",
            label: t("settings:adminUsers.actions.reactivate"),
            icon: CheckCircle2Icon,
            onSelect: () => onAction({ type: "reactivate", user }),
          }
        : {
            id: "deactivate",
            label: t("settings:adminUsers.actions.deactivate"),
            icon: BanIcon,
            onSelect: () => onAction({ type: "deactivate", user }),
          },
      {
        id: "delete",
        label: t("common:actions.delete"),
        icon: Trash2Icon,
        destructive: true,
        onSelect: () => onAction({ type: "delete", user }),
      },
    );
  }

  return (
    <TableRow>
      <TableCell className="ps-6 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border bg-muted">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name} />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(user.name, "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{user.name}</span>
              {isSelf ? (
                <span className="text-xs text-muted-foreground">
                  {t("settings:adminUsers.you")}
                </span>
              ) : null}
            </div>
            <span className="block max-w-72 truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <UserRoleBadge isAdmin={hasInstanceAdminRole(user.role)} />
      </TableCell>
      <TableCell className="py-3">
        <UserStatus deactivated={deactivated} />
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {formatDateMedium(user.createdAt)}
      </TableCell>
      <TableCell className="pe-6 py-3 text-right">
        <RowActionsMenu
          label={t("settings:adminUsers.actions.open", { name: user.name })}
          actions={actions}
        />
      </TableCell>
    </TableRow>
  );
}
