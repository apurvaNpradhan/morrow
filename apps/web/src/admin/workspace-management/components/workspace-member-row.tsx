import {
  CrownIcon,
  EllipsisIcon,
  ShieldIcon,
  UserMinusIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { TableCell, TableRow } from "@/design-system/ui/table";
import type { AdminWorkspaceMember } from "@/admin/lib/admin-types";
import { formatDateMedium } from "@/design-system/format";
import { getInitials } from "@/design-system/get-initials";
import { isWorkspaceOwnerRole } from "@/admin/workspace-management/lib/is-workspace-owner-role";
import { WorkspaceRoleSelect } from "./workspace-role-select";

type Props = {
  member: AdminWorkspaceMember;
  roleOptions: readonly string[];
  isOnlyOwner: boolean;
  isUpdatingRole: boolean;
  onRoleChange: (role: string) => void;
  onMakeOwner: () => void;
  onRemove: () => void;
};

export function WorkspaceMemberRow({
  member,
  roleOptions,
  isOnlyOwner,
  isUpdatingRole,
  onRoleChange,
  onMakeOwner,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const isOwner = isWorkspaceOwnerRole(member.role);
  const name = member.name || member.email;

  return (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 border bg-muted">
            {member.image ? (
              <AvatarImage src={member.image} alt={name} />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {getInitials(member.name, "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="block max-w-56 truncate text-sm font-medium">
              {name}
            </span>
            <span className="block max-w-56 truncate text-xs text-muted-foreground">
              {member.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        {isOwner ? (
          <Badge variant="outline" className="gap-1">
            <ShieldIcon aria-hidden="true" />
            {t("team:roles.owner")}
          </Badge>
        ) : (
          <WorkspaceRoleSelect
            size="sm"
            className="w-36"
            label={t("settings:adminWorkspaces.members.roleLabel", { name })}
            value={member.role}
            options={roleOptions}
            disabled={isUpdatingRole}
            onValueChange={(role) => {
              if (role !== member.role) onRoleChange(role);
            }}
          />
        )}
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
        {formatDateMedium(member.joinedAt)}
      </TableCell>
      <TableCell className="py-3 text-right">
        {isOnlyOwner ? null : (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("settings:adminWorkspaces.members.actions", {
                    name,
                  })}
                />
              }
            >
              <EllipsisIcon aria-hidden="true" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem closeOnClick onClick={onMakeOwner}>
                <CrownIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.members.makeOwner")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem closeOnClick variant="destructive" onClick={onRemove}>
                <UserMinusIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.members.remove")}
              </MenuItem>
            </MenuPopup>
          </Menu>
        )}
      </TableCell>
    </TableRow>
  );
}
