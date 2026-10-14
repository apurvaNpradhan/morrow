import {
  myInvitationsShape,
  workspaceInvitationsShape,
  workspaceMembersShape,
  workspaceMemberUsersShape,
} from "@morrow/sync-schemas";
import { defineShape } from "#api/platform/sync/define-shape";
import {
  invitationTable,
  userTable,
  workspaceUserTable,
} from "#api/platform/database/schema";

/**
 * Both shapes are scoped to the user, not to one Workspace: they cover every
 * Workspace the user belongs to, so a join or removal reaches the browser
 * without a new request and switching Workspaces needs no new sync.
 */

/** Members of every Workspace the user belongs to. */
const workspaceMembers = defineShape({
  shape: workspaceMembersShape,
  table: workspaceUserTable,
  where: ({ userId }) => ({
    sql: "workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

/**
 * The people behind those members, and the people who invited the user:
 * name, email and avatar, never tokens.
 */
const workspaceMemberUsers = defineShape({
  shape: workspaceMemberUsersShape,
  table: userTable,
  where: ({ userId, verifiedEmail }) => ({
    sql: "id IN (SELECT user_id FROM workspace_member WHERE workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)) OR id IN (SELECT inviter_id FROM invitation WHERE status = 'pending' AND lower(email) = lower($2))",
    params: [userId, verifiedEmail],
  }),
});

/**
 * Pending invitations of those Workspaces. Every Member sees them, as the
 * members page always has; only pending rows sync, so an accepted or cancelled
 * invitation leaves the browser as a delete.
 */
const workspaceInvitations = defineShape({
  shape: workspaceInvitationsShape,
  table: invitationTable,
  where: ({ userId }) => ({
    sql: "status = 'pending' AND workspace_id IN (SELECT workspace_id FROM workspace_member WHERE user_id = $1)",
    params: [userId],
  }),
});

/** Pending invitations addressed to the signed-in user's own email. */
const myInvitations = defineShape({
  shape: myInvitationsShape,
  table: invitationTable,
  where: ({ verifiedEmail }) => ({
    sql: "status = 'pending' AND lower(email) = lower($1)",
    params: [verifiedEmail],
  }),
});

export const membersShapes = [
  workspaceMembers,
  workspaceMemberUsers,
  workspaceInvitations,
  myInvitations,
];
