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
export { projectColumnTable, projectTable } from "#api/projects/tables";
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
