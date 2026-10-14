import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/app/settings/settings-row";
import { Label } from "@/design-system/ui/label";
import { Switch } from "@/design-system/ui/switch";
import { ASSEMBLED_STATEMENT } from "@/members/roles/role-helpers";
import {
  PERMISSION_LABELS,
  RESOURCE_LABELS,
} from "@/members/roles/role-permission-labels";

export function PermissionList({
  permissions,
  selected,
  onToggle,
  readOnly,
  disabled,
}: {
  permissions: Partial<Record<string, string[]>>;
  selected?: Record<string, Set<string>>;
  onToggle?: (resource: string, action: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const groups = useMemo(() => {
    const known = ASSEMBLED_STATEMENT;
    const resources = new Set([
      ...Object.keys(known),
      ...Object.keys(permissions),
      ...Object.keys(selected ?? {}),
    ]);
    return [...resources].map((resource) => ({
      resource,
      actions: [
        ...new Set([
          ...(Object.hasOwn(known, resource) ? (known[resource] ?? []) : []),
          ...(Object.hasOwn(permissions, resource)
            ? (permissions[resource] ?? [])
            : []),
          ...(selected && Object.hasOwn(selected, resource)
            ? (selected[resource] ?? [])
            : []),
        ]),
      ],
    }));
  }, [permissions, selected]);

  const isChecked = (resource: string, action: string) => {
    if (selected)
      return (
        Object.hasOwn(selected, resource) &&
        (selected[resource]?.has(action) ?? false)
      );
    return permissions[resource]?.includes(action) ?? false;
  };

  return (
    <div className="divide-y divide-border border-t border-border">
      {groups.map(({ resource, actions }) => (
        <div key={resource}>
          <p className="px-4 pt-4 text-sm font-medium capitalize">
            {t(`settings:workspaceRoles.resources.${resource}`, {
              defaultValue:
                RESOURCE_LABELS.get(resource) ??
                resource.charAt(0).toUpperCase() + resource.slice(1),
            })}
          </p>
          <div className="divide-y divide-border">
            {actions.map((action) => {
              const meta = PERMISSION_LABELS.get(`${resource}:${action}`) ?? {
                label: `${action} ${resource}`,
                description: "",
              };
              const canGrant =
                ASSEMBLED_STATEMENT[resource]?.includes(action) ?? false;
              // Members can always read their workspace; the server adds it to
              // every role, so the switch is on and cannot be changed.
              const alwaysOn = resource === "workspace" && action === "read";
              const checked = alwaysOn || isChecked(resource, action);
              const switchId = `${id}-${resource}-${action}`;
              return (
                <SettingsRow
                  key={`${resource}:${action}`}
                  title={
                    <Label htmlFor={switchId}>
                      {t(
                        `settings:workspaceRoles.permissions.${resource}.${action}.label`,
                        { defaultValue: meta.label },
                      )}
                    </Label>
                  }
                  description={
                    meta.description
                      ? t(
                          `settings:workspaceRoles.permissions.${resource}.${action}.description`,
                          { defaultValue: meta.description },
                        )
                      : undefined
                  }
                >
                  <Switch
                    id={switchId}
                    checked={checked}
                    onCheckedChange={
                      readOnly ||
                      alwaysOn ||
                      !onToggle ||
                      (!canGrant && !checked)
                        ? undefined
                        : () => onToggle(resource, action)
                    }
                    disabled={
                      readOnly ||
                      disabled ||
                      alwaysOn ||
                      (!canGrant && !checked)
                    }
                  />
                </SettingsRow>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
