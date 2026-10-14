import { type } from "@orpc/server";
import { z } from "zod";
import { authApi, type AuthResult } from "#api/platform/orpc/auth-api";
import { authed, base } from "#api/platform/orpc/base";
import { rateLimit } from "#api/platform/orpc/rate-limit";
import { getInvitationDetails } from "./invitation-lookup";
import { invitationDetailsSchema } from "./invitation-response";

const workspaceId = z.string().min(1);

const invite = authed
  .use(rateLimit({ windowMs: 60_000, max: 5 }))
  .input(
    z.object({
      workspaceId,
      email: z.string().email().max(320),
      role: z.string().min(1).max(64),
      resend: z.boolean().optional(),
    }),
  )
  .output(type<NonNullable<AuthResult<"createInvitation">>>())
  .handler(async ({ context, input }) => {
    const invitation = await (
      await authApi()
    ).createInvitation({
      headers: context.authHeaders,
      body: {
        email: input.email,
        role: input.role,
        organizationId: input.workspaceId,
        resend: input.resend,
      },
    });
    return invitation as NonNullable<typeof invitation>;
  });

const cancelInvitation = authed
  .input(z.object({ invitationId: z.string().min(1) }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).cancelInvitation({
      headers: context.authHeaders,
      body: { invitationId: input.invitationId },
    }),
  );

const acceptInvitation = authed
  .input(z.object({ invitationId: z.string().min(1) }))
  .output(type<NonNullable<AuthResult<"acceptInvitation">>>())
  .handler(async ({ context, input }) => {
    const accepted = await (
      await authApi()
    ).acceptInvitation({
      headers: context.authHeaders,
      body: { invitationId: input.invitationId },
    });
    return accepted as NonNullable<typeof accepted>;
  });

const rejectInvitation = authed
  .input(z.object({ invitationId: z.string().min(1) }))
  .output(type<unknown>())
  .handler(async ({ context, input }) =>
    (await authApi()).rejectInvitation({
      headers: context.authHeaders,
      body: { invitationId: input.invitationId },
    }),
  );

const invitationDetails = authed
  .input(z.object({ id: z.string() }))
  .output(invitationDetailsSchema)
  .handler(({ input }) => getInvitationDetails(input.id));

const publicInvitation = base
  .input(z.object({ id: z.string().min(1) }))
  .output(invitationDetailsSchema)
  .handler(({ input }) => getInvitationDetails(input.id));

export const invitationProcedures = {
  invite,
  cancelInvitation,
  acceptInvitation,
  rejectInvitation,
  invitationDetails,
  publicInvitation,
};
