import { z } from "zod";

export const pendingInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  inviterName: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  status: z
    .string()
    .describe(
      "Always `pending` here; expired and accepted ones are filtered out.",
    ),
});

export const pendingInvitationListSchema = z.array(pendingInvitationSchema);

export const invitationDetailsSchema = z.object({
  valid: z
    .boolean()
    .describe("True only when the invitation can still be accepted."),
  invitation: z
    .object({
      id: z.string(),
      email: z.string(),
      workspaceName: z.string(),
      inviterName: z.string(),
      expiresAt: z.date(),
      status: z.string(),
      expired: z.boolean(),
    })
    .optional()
    .describe(
      "Omitted when the invitation does not exist, was already accepted, or was canceled -- the details are withheld rather than leaked.",
    ),
  error: z
    .string()
    .optional()
    .describe("Why the invitation is unusable, when valid is false."),
});
