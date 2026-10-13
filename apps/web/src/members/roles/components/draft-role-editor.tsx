import { XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsRow } from "@/app/settings/settings-row";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { useCreateWorkspaceRole } from "@/members/roles/queries/use-create-workspace-role";
import { PermissionList } from "./permission-list";
import { usePermissionSelection } from "@/members/roles/use-permission-selection";

export function DraftRoleEditor({
  workspaceId,
  existingNames,
  onCreated,
  onDiscard,
}: {
  workspaceId: string;
  existingNames: string[];
  onCreated: (roleName: string) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const { selection, toggle, permission } = usePermissionSelection({});
  const { mutateAsync: createRole, isPending } = useCreateWorkspaceRole();

  const create = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
      toast.error(t("settings:workspaceRoles.validation.nameRequired"));
      return;
    }
    if (existingNames.map((n) => n.toLowerCase()).includes(trimmed)) {
      toast.error(t("settings:workspaceRoles.validation.nameExists"));
      return;
    }
    if (Object.keys(permission).length === 0) {
      toast.error(t("settings:workspaceRoles.validation.permissionRequired"));
      return;
    }
    try {
      await createRole({ workspaceId, role: trimmed, permission });
      toast.success(t("settings:workspaceRoles.toast.created"));
      onCreated(trimmed);
    } catch (error) {
      toast.error(
        errorMessage(t, error, t("settings:workspaceRoles.toast.createError")),
      );
    }
  };

  return (
    <div>
      <div className="border-t border-border">
        <SettingsRow
          stack
          title={
            <Label htmlFor="new-role-name">
              {t("settings:workspaceRoles.nameLabel")}
            </Label>
          }
          description={t("settings:workspaceRoles.nameHint")}
        >
          <Input
            id="new-role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings:workspaceRoles.namePlaceholder")}
            className="w-full sm:w-64"
            autoFocus
            disabled={isPending}
          />
        </SettingsRow>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          permissions={{}}
          selected={selection}
          onToggle={toggle}
          disabled={isPending}
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-border bg-sidebar px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={isPending}
        >
          <XIcon aria-hidden="true" />
          {t("settings:workspaceRoles.discard")}
        </Button>
        <Button size="sm" onClick={create} disabled={isPending}>
          {t("settings:workspaceRoles.createRole")}
        </Button>
      </div>
    </div>
  );
}
