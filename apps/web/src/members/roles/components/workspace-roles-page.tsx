import { PlusIcon, ShieldIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsEmpty } from "@/app/settings/settings-empty";
import { SettingsIconTile } from "@/app/settings/settings-icon-tile";
import { SettingsPage } from "@/app/settings/settings-page";
import { SettingsSection } from "@/app/settings/settings-section";
import { SettingsRowsSkeleton } from "@/app/settings/settings-rows-skeleton";
import { PageTitle } from "@/design-system/page-title";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/design-system/ui/accordion";
import { Button } from "@/design-system/ui/button";
import { useWorkspacePermission } from "@/workspace";
import {
  useWorkspaceRoles,
  type WorkspaceRole,
} from "@/members/roles/queries/use-workspace-roles";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { DraftRoleEditor } from "./draft-role-editor";
import { RoleAccordionItem } from "./role-accordion-item";
import { RESERVED_ROLE_NAMES, sortRoles } from "@/members/roles/role-helpers";

const DRAFT = "__draft__";

export function WorkspaceRolesPage() {
  const { t } = useTranslation();
  const { workspace, canManageRoles, isCheckingPermissions } =
    useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const {
    data: roles = [],
    isLoading,
    isError,
    error,
  } = useWorkspaceRoles(workspaceId);
  const [draftActive, setDraftActive] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<WorkspaceRole | null>(null);
  const [open, setOpen] = useState<string[]>([]);
  const sortedRoles = useMemo(() => sortRoles(roles), [roles]);

  // Capability, not role name: custom roles can grant role management, and the
  // answer isn't known until the server has been asked.
  if (isCheckingPermissions || !canManageRoles()) {
    return (
      <>
        <PageTitle title={t("settings:workspaceRoles.pageTitle")} />
        <SettingsPage
          title={t("settings:workspaceRoles.title")}
          description={
            isCheckingPermissions
              ? undefined
              : t("settings:workspaceRoles.noAccess")
          }
        >
          {isCheckingPermissions ? (
            <SettingsCard>
              <SettingsRowsSkeleton rows={3} withDescription />
            </SettingsCard>
          ) : null}
        </SettingsPage>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("settings:workspaceRoles.pageTitle")} />
      <SettingsPage
        title={t("settings:workspaceRoles.title")}
        description={t("settings:workspaceRoles.subtitle", {
          workspaceName:
            workspace?.name ?? t("settings:workspaceRoles.thisWorkspace"),
        })}
      >
        <SettingsSection
          title={t("settings:workspaceRoles.sectionTitle")}
          description={t("settings:workspaceRoles.sectionSubtitle")}
          action={
            <Button
              size="sm"
              disabled={draftActive}
              onClick={() => {
                setDraftActive(true);
                setOpen((prev) =>
                  prev.includes(DRAFT) ? prev : [...prev, DRAFT],
                );
              }}
            >
              <PlusIcon aria-hidden="true" />
              {t("settings:workspaceRoles.newRole")}
            </Button>
          }
        >
          <SettingsCard>
            {isLoading && !draftActive ? (
              <SettingsRowsSkeleton rows={3} withDescription />
            ) : isError ? (
              <p className="px-4 py-6 text-xs text-destructive">
                {errorMessage(t, error, t("settings:workspaceRoles.loadError"))}
              </p>
            ) : sortedRoles.length === 0 && !draftActive ? (
              <SettingsEmpty
                icon={<ShieldIcon />}
                title={t("settings:workspaceRoles.emptyTitle")}
                description={t("settings:workspaceRoles.emptyDescription")}
              />
            ) : (
              <Accordion
                multiple
                value={open}
                onValueChange={(value) =>
                  setOpen(Array.isArray(value) ? value : [value])
                }
              >
                {draftActive ? (
                  <AccordionItem
                    value={DRAFT}
                    className="border-b border-border last:border-b-0"
                  >
                    <AccordionTrigger className="px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <SettingsIconTile>
                          <ShieldIcon />
                        </SettingsIconTile>
                        <p className="text-sm font-medium italic">
                          {t("settings:workspaceRoles.newRole")}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionPanel className="px-0 pt-0 pb-0">
                      <DraftRoleEditor
                        workspaceId={workspaceId}
                        existingNames={[
                          ...RESERVED_ROLE_NAMES,
                          ...roles.map((r) => r.role),
                        ]}
                        onCreated={(roleName) => {
                          setDraftActive(false);
                          setOpen((prev) => [
                            ...prev.filter((v) => v !== DRAFT),
                            roleName,
                          ]);
                        }}
                        onDiscard={() => {
                          setDraftActive(false);
                          setOpen((prev) => prev.filter((v) => v !== DRAFT));
                        }}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                ) : null}
                {sortedRoles.map((role) => (
                  <RoleAccordionItem
                    key={role.id}
                    workspaceId={workspaceId}
                    role={role}
                    onDelete={() => setRoleToDelete(role)}
                  />
                ))}
              </Accordion>
            )}
          </SettingsCard>
        </SettingsSection>
      </SettingsPage>

      <DeleteRoleDialog
        role={roleToDelete}
        workspaceId={workspaceId}
        onDeleted={() => {
          setOpen((prev) => prev.filter((v) => v !== roleToDelete?.role));
          setRoleToDelete(null);
        }}
        onCancel={() => setRoleToDelete(null)}
      />
    </>
  );
}
