import { ShieldIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsIconTile } from "@/app/settings/settings-icon-tile";
import { StatusBadge } from "@/app/settings/status-badge";
import {
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/design-system/ui/accordion";
import type { WorkspaceRole } from "@/members/roles/queries/use-workspace-roles";
import { CustomRoleEditor } from "./custom-role-editor";
import {
  DEFAULT_ROLE_DESCRIPTIONS,
  isDefaultRole,
  permissionCount,
} from "@/members/roles/role-helpers";

export function RoleAccordionItem({
  workspaceId,
  role,
  onDelete,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isDefault = isDefaultRole(role.role);
  const label = isDefault
    ? t(`team:roles.${role.role}`, { defaultValue: role.role })
    : role.role;
  const description = isDefault
    ? t(`settings:workspaceRoles.defaultRoleDescriptions.${role.role}`, {
        defaultValue: DEFAULT_ROLE_DESCRIPTIONS.get(role.role) ?? "",
      })
    : undefined;

  return (
    <AccordionItem
      value={role.role}
      className="border-b border-border last:border-b-0"
    >
      <AccordionTrigger className="px-4">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <SettingsIconTile>
              <ShieldIcon />
            </SettingsIconTile>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`truncate text-sm font-medium ${isDefault ? "" : "capitalize"}`}
                >
                  {label}
                </p>
                {isDefault ? (
                  <StatusBadge tone="neutral">
                    {t("settings:workspaceRoles.defaultBadge")}
                  </StatusBadge>
                ) : null}
              </div>
              {description ? (
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <p className="shrink-0 text-xs font-normal text-muted-foreground">
            {t("settings:workspaceRoles.permissionCount", {
              count: permissionCount(role.permission),
            })}
          </p>
        </div>
      </AccordionTrigger>
      <AccordionPanel className="px-0 pt-0 pb-0">
        <CustomRoleEditor
          key={role.id}
          workspaceId={workspaceId}
          role={role}
          isDefault={isDefault}
          onDelete={onDelete}
        />
      </AccordionPanel>
    </AccordionItem>
  );
}
