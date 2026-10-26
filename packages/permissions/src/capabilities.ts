/**
 * Named permission bundles the UI asks about. The API answers them all in one
 * `workspace.capabilities` call, against the member's real (possibly custom)
 * role.
 */
export const CAPABILITIES = {
  manageWorkspace: { workspace: ["update", "manage_settings"] },
  manageSettings: { workspace: ["manage_settings"] },
  deleteWorkspace: { workspace: ["delete"] },
  inviteUsers: { invitation: ["create"] },
  manageTeam: { member: ["update", "delete"] },
  updateMembers: { member: ["update"] },
  removeMembers: { member: ["delete"] },
  createProjects: { project: ["create"] },
  manageProjects: { project: ["update"] },
  deleteProjects: { project: ["delete"] },
  createTasks: { task: ["create"] },
  editTasks: { task: ["update"] },
  deleteTasks: { task: ["delete"] },
  assignTasks: { task: ["assign"] },
  createLabels: { label: ["create"] },
  editLabels: { label: ["update"] },
  deleteLabels: { label: ["delete"] },
  createComments: { comment: ["create"] },
  deleteComments: { comment: ["delete"] },
  createDocuments: { document: ["create"] },
  editDocuments: { document: ["update"] },
  deleteDocuments: { document: ["delete"] },
  // Better Auth guards role administration with its access-control resource.
  manageRoles: { ac: ["create", "update", "delete"] },
} as const satisfies Record<string, Record<string, string[]>>;

export type Capability = keyof typeof CAPABILITIES;

export type CapabilityMap = Record<Capability, boolean>;
