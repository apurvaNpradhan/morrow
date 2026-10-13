import { and, eq, gt } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { config } from "#api/platform/config";
import {
  invitationTable,
  userTable,
  workspaceTable,
} from "#api/platform/database/schema";
import { getUserPendingInvitations } from "#api/members/index";

type RegistrationCheckResult = {
  allowed: boolean;
  reason: string;
  invitation?: {
    id: string;
    email: string;
    workspaceId: string;
    workspaceName: string;
    inviterName: string;
    expiresAt: Date;
    status: string;
  };
};

export async function checkRegistrationAllowed(
  email?: string,
  invitationId?: string,
  options?: { allowInvitationByEmail?: boolean; emailVerified?: boolean },
): Promise<RegistrationCheckResult> {
  if (config.registrationOpen) {
    return {
      allowed: true,
      reason: "Registration is enabled",
    };
  }

  const canMatchByEmail = Boolean(
    options?.allowInvitationByEmail && options.emailVerified === true && email,
  );

  if (!invitationId && !canMatchByEmail) {
    return {
      allowed: false,
      reason:
        "Registration is currently disabled. Please use a valid invitation link to create an account.",
    };
  }

  const invitation = await findValidInvitation(email, invitationId);

  if (!invitation) {
    return {
      allowed: false,
      reason:
        "Registration is currently disabled. You need a valid invitation to create an account.",
    };
  }

  return {
    allowed: true,
    reason: "Valid invitation found",
    invitation,
  };
}

async function findValidInvitation(
  email?: string,
  invitationId?: string,
): Promise<RegistrationCheckResult["invitation"] | null> {
  const now = new Date();

  const conditions = [
    eq(invitationTable.status, "pending"),
    gt(invitationTable.expiresAt, now),
  ];

  if (invitationId) {
    conditions.push(eq(invitationTable.id, invitationId));
  }

  if (email) {
    conditions.push(eq(invitationTable.email, email.toLowerCase()));
  }

  if (!invitationId && !email) {
    return null;
  }

  const result = await db
    .select({
      id: invitationTable.id,
      email: invitationTable.email,
      workspaceId: invitationTable.workspaceId,
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
    .where(and(...conditions))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  return row;
}

export async function userExistsByEmail(email: string): Promise<boolean> {
  const [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email.toLowerCase()))
    .limit(1);
  return Boolean(user);
}

export async function canSendSignInEmail(email: string): Promise<boolean> {
  if (await userExistsByEmail(email)) {
    return true;
  }
  return (await getUserPendingInvitations(email)).length > 0;
}
