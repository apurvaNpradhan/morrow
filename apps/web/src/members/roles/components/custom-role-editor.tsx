import { Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { useUpdateWorkspaceRole } from "@/members/roles/queries/use-update-workspace-role";
import type { WorkspaceRole } from "@/members/roles/queries/use-workspace-roles";
import { PermissionList } from "./permission-list";
import { permissionsEqual } from "@/members/roles/role-helpers";
import { usePermissionSelection } from "@/members/roles/use-permission-selection";

export function CustomRoleEditor({
  workspaceId,
  role,
  isDefault,
  onDelete,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  isDefault?: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { selection, toggle, permission } = usePermissionSelection(
    role.permission,
  );
  const { mutateAsync: updateRole, isPending } = useUpdateWorkspaceRole();
  const dirty = !permissionsEqual(permission, role.permission);

  const save = async () => {
    try {
      await updateRole({ workspaceId, roleName: role.role, permission });
      toast.success(t("settings:workspaceRoles.toast.updated"));
    } catch (error) {
      toast.error(
        errorMessage(t, error, t("settings:workspaceRoles.toast.updateError")),
      );
    }
  };

  // AccordionPanel sets `overflow-hidden`, which kills `position: sticky`
  // relative to the page. Instead, we cap the permission list height and
  // give it its own scroll, so the action bar below stays anchored at the
  // bottom of the accordion content while the user scrolls through
  // permissions.
  return (
    <div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          permissions={role.permission}
          selected={selection}
          onToggle={toggle}
          disabled={isPending}
        />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-sidebar px-4 py-3">
        {isDefault ? (
          <span className="text-xs text-muted-foreground">
            {t("settings:workspaceRoles.defaultRoleHelp")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            disabled={isPending}
          >
            <Trash2Icon aria-hidden="true" />
            {t("settings:workspaceRoles.deleteRole")}
          </Button>
        )}
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty
              ? t("settings:workspaceRoles.unsavedChanges")
              : t("settings:workspaceRoles.allChangesSaved")}
          </p>
          <Button size="sm" onClick={save} disabled={isPending || !dirty}>
            {t("settings:workspaceRoles.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}
