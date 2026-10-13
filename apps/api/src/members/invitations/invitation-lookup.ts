import { and, eq, gt } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import {
  invitationTable,
  userTable,
  workspaceTable,
} from "#api/platform/database/schema";

type InvitationDetails = {
  id: string;
  email: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: Date;
  status: string;
  expired: boolean;
};

type InvitationDetailsResult = {
  valid: boolean;
  invitation?: InvitationDetails;
  error?: string;
};

export async function getInvitationDetails(
  invitationId: string,
): Promise<InvitationDetailsResult> {
  const now = new Date();

  const result = await db
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      workspaceName: workspaceTable.name,
      inviterName: userTable.name,
      expiresAt: invitationTable.expiresAt,
      status: invitationTable.status,
    })
    .from(invitationTable)
    .innerJoin(
      workspaceTable,
      eq(invitationTable.workspaceId, workspaceTable.id),
    )
    .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
    .where(eq(invitationTable.id, invitationId))
    .limit(1);

  const row = result[0];
  if (!row) {
    return {
      valid: false,
      error: "Invitation not found",
    };
  }

  const expired = row.expiresAt < now;
  const isAccepted = row.status === "accepted";
  const isCanceled = row.status === "canceled";

  const baseInvitation: InvitationDetails = {
    id: row.id,
    email: row.email,
    workspaceName: row.workspaceName,
    inviterName: row.inviterName,
    expiresAt: row.expiresAt,
    status: row.status,
    expired,
  };

  if (isAccepted) {
    return {
      valid: false,
      error: "This invitation has already been accepted",
    };
  }

  if (isCanceled) {
    return {
      valid: false,
      error: "This invitation has been canceled",
    };
  }

  if (expired) {
    return {
      valid: false,
      invitation: baseInvitation,
      error: "This invitation has expired",
    };
  }

  return {
    valid: true,
    invitation: baseInvitation,
  };
}

export async function getUserPendingInvitations(userEmail: string) {
  const now = new Date();

  const result = await db
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      workspaceId: invitationTable.workspaceId,
      workspaceName: workspaceTable.name,
      inviterName: userTable.name,
      expiresAt: invitationTable.expiresAt,
      createdAt: invitationTable.createdAt,
      status: invitationTable.status,
    })
    .from(invitationTable)
    .innerJoin(
      workspaceTable,
      eq(invitationTable.workspaceId, workspaceTable.id),
    )
    .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
    .where(
      and(
        eq(invitationTable.email, userEmail.toLowerCase()),
        eq(invitationTable.status, "pending"),
        gt(invitationTable.expiresAt, now),
      ),
    )
    .orderBy(invitationTable.createdAt);

  return result;
}
