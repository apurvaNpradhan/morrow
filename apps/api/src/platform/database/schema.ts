// The schema index: every vertical's tables.
export {
  accountTable,
  jwksTable,
  sessionTable,
  userTable,
  verificationTable,
} from "#api/auth/tables";
export {
  workspaceRoleTable,
  workspaceSlugAliasTable,
  workspaceTable,
} from "#api/workspace/tables";
export {
  invitationTable,
  teamMemberTable,
  teamTable,
  workspaceUserTable,
} from "#api/members/tables";
export { activityTable } from "#api/activity/tables";
export {
  documentBodyTable,
  documentClientTable,
  documentTable,
} from "#api/documents/tables";
export { labelTable } from "#api/labels/tables";
export {
  projectColumnTable,
  projectFieldTable,
  projectTable,
} from "#api/projects/tables";
export {
  taskCommentTable,
  taskDescriptionTable,
  taskEventTable,
  taskLinkTable,
  taskRelationTable,
  taskTable,
  taskTicketAliasTable,
} from "#api/tasks/tables";
export { assetTable } from "#api/storage/tables";
export {
  oauthAccessTokenTable,
  oauthClientAssertionTable,
  oauthClientResourceTable,
  oauthClientTable,
  oauthConsentTable,
  oauthRefreshTokenTable,
  oauthResourceTable,
} from "#api/mcp/tables";
