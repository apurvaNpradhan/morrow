// Every permission that can be saved must also be visible and removable.
// Include provider-owned resources and persisted unknown entries in the editor.
export const RESOURCE_LABELS = new Map(
  Object.entries({
    organization: "Workspace administration",
    member: "Members",
    invitation: "Invitations",
    team: "Teams",
    ac: "Roles and permissions",
    workspace: "Workspace",
    project: "Projects",
  } satisfies Record<string, string>),
);

export const PERMISSION_LABELS = new Map(
  Object.entries({
    "organization:update": {
      label: "Edit workspace administration",
      description: "Change workspace settings through the account service.",
    },
    "organization:delete": {
      label: "Delete workspace",
      description:
        "Permanently delete the workspace through the account service.",
    },
    "member:create": {
      label: "Add members",
      description: "Add users to this workspace.",
    },
    "member:update": {
      label: "Change member roles",
      description: "Change the roles assigned to workspace members.",
    },
    "member:delete": {
      label: "Remove members",
      description: "Remove users from this workspace.",
    },
    "invitation:create": {
      label: "Invite members",
      description: "Send workspace invitations.",
    },
    "invitation:cancel": {
      label: "Cancel invitations",
      description: "Revoke pending workspace invitations.",
    },
    "team:create": {
      label: "Create teams",
      description: "Create teams in this workspace.",
    },
    "team:update": {
      label: "Edit teams",
      description: "Change teams and team membership.",
    },
    "team:delete": {
      label: "Delete teams",
      description: "Delete teams in this workspace.",
    },
    "ac:create": {
      label: "Create roles",
      description: "Create workspace roles and assign their permissions.",
    },
    "ac:read": {
      label: "View roles",
      description: "Read the workspace roles and their permissions.",
    },
    "ac:update": {
      label: "Change role permissions",
      description: "Change role permissions, including administrative access.",
    },
    "ac:delete": {
      label: "Delete roles",
      description: "Delete custom workspace roles.",
    },
    "workspace:read": {
      label: "Access workspace",
      description: "Read workspace metadata and members. Every role has this.",
    },
    "workspace:update": {
      label: "Edit workspace",
      description: "Edit workspace name and description.",
    },
    "workspace:delete": {
      label: "Delete workspace",
      description: "Permanently delete this workspace.",
    },
    "workspace:manage_settings": {
      label: "Manage settings",
      description: "Configure workspace settings and preferences.",
    },
    "project:create": {
      label: "Create projects",
      description: "Add projects to this workspace.",
    },
    "project:update": {
      label: "Edit projects",
      description:
        "Rename, reorder, archive and configure projects and their columns.",
    },
    "project:delete": {
      label: "Delete projects",
      description: "Permanently delete archived projects.",
    },
  } satisfies Record<string, { label: string; description: string }>),
);
