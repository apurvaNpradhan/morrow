import { getUserLocale } from "#api/account/index";
import { memberHooks, sendInvitationEmail } from "#api/members/index";
import { workspaceHooks } from "#api/workspace/index";
import { getEmailRequestContext } from "./email/email-request-context";
import { interpolate, OTP_EXPIRY_SECONDS, sendOtpEmail } from "@morrow/email";
import enUS from "@morrow/i18n/en-US.json" with { type: "json" };
import { ac, owner } from "@morrow/permissions";
import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin as adminPlugin,
  bearer,
  emailOTP,
  jwt,
  lastLoginMethod,
  organization,
} from "better-auth/plugins";
import type { AccessControl } from "better-auth/plugins/access";
import { config } from "#api/platform/config";
import { eq } from "drizzle-orm";
import { db, schema } from "#api/platform/database/index";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// Direct imports: the account index pulls in oRPC, which imports this module.
import { clearEmailVerificationOnAdminChange } from "#api/account/index";
import { deleteAccountData } from "#api/account/index";
import { prepareAdminUserRemoval } from "#api/account/index";
import { resolveAuthSecret } from "./lib/auth-secret";
import {
  canSendSignInEmail,
  userExistsByEmail,
} from "./registration/check-registration-allowed";

import { syncAdminRole } from "./access/admin-allowlist";
import { isDisposableEmail } from "./registration/is-disposable-email";
import { assertUserRegistrationAllowed } from "./registration/registration-policy";
import { queueSignInEmail } from "./email/sign-in-email-tasks";
import {
  authCaptchaPaths,
  verifyTurnstile,
} from "./registration/verify-turnstile";
import { log } from "#api/platform/logger";

const apiUrl = config.apiUrl;
const clientUrl = config.clientUrl;

const trustedOrigins = [clientUrl];
try {
  const apiOrigin = new URL(apiUrl);
  const apiOriginString = `${apiOrigin.protocol}//${apiOrigin.host}`;
  if (!trustedOrigins.includes(apiOriginString)) {
    trustedOrigins.push(apiOriginString);
  }
} catch {
  // An invalid API URL contributes no additional trusted origin.
}

const baseURLWithoutPath = (() => {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/"); // Get protocol://host
  }
})();

/** Issuer of MCP access tokens: the Better Auth base URL. */
export const OAUTH_ISSUER = `${baseURLWithoutPath}/api/auth`;

/** The identifier MCP access tokens are issued for (their `aud`). */
export const MCP_RESOURCE = `${baseURLWithoutPath}/api/mcp`;

const authSecret = (() => {
  try {
    return resolveAuthSecret();
  } catch (error) {
    log.error({
      action: "auth.secret",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
})();

// Closed registration only mails existing accounts and invited addresses, so
// the sign-in form cannot be used to create accounts or probe for them.
async function shouldDeliverSignInEmail(email: string) {
  return config.registrationOpen || canSendSignInEmail(email);
}

function getAuthEmailCopy(_locale?: string | null) {
  return enUS.emails.otp;
}

export const auth = betterAuth({
  baseURL: baseURLWithoutPath,
  trustedOrigins,
  secret: authSecret,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
      workspace: schema.workspaceTable,
      workspace_member: schema.workspaceUserTable,
      invitation: schema.invitationTable,
      workspace_role: schema.workspaceRoleTable,
      team: schema.teamTable,
      teamMember: schema.teamMemberTable,
      jwks: schema.jwksTable,
      oauthClient: schema.oauthClientTable,
      oauthResource: schema.oauthResourceTable,
      oauthClientResource: schema.oauthClientResourceTable,
      oauthAccessToken: schema.oauthAccessTokenTable,
      oauthRefreshToken: schema.oauthRefreshTokenTable,
      oauthConsent: schema.oauthConsentTable,
      oauthClientAssertion: schema.oauthClientAssertionTable,
    },
  }),
  user: {
    additionalFields: {
      locale: {
        type: "string",
        input: true,
        required: false,
      },
      timeZone: {
        type: "string",
        input: true,
        required: false,
      },
      // Set only by POST /api/onboarding/complete, never by update-user.
      onboardingCompletedAt: {
        type: "date",
        input: false,
        required: false,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteAccountData(user.id);
      },
    },
  },
  account: {
    accountLinking: {
      // Require the provider's verified-email claim for implicit linking;
      // configuration alone must not make an unverified identity trusted.
      enabled: true,
      // A signed-in user may link a provider account whose email differs from
      // their own; the verified-email rule above still guards implicit linking.
      allowDifferentEmails: true,
      // Only link to an existing local account after its email has been
      // verified, so a pre-registered unverified account cannot be taken over
      // through a trusted provider.
      requireLocalEmailVerified: true,
    },
  },
  socialProviders: {
    github: {
      ...config.github,
      scope: ["user:email"],
    },
    google: {
      ...config.google,
    },
  },
  plugins: [
    lastLoginMethod(),
    emailOTP({
      expiresIn: OTP_EXPIRY_SECONDS,
      async sendVerificationOTP({ email, otp, type }, ctx) {
        if (type === "sign-in") {
          const requestContext = getEmailRequestContext(
            ctx?.request?.headers ?? ctx?.headers,
          );
          queueSignInEmail(async () => {
            if (!(await shouldDeliverSignInEmail(email))) {
              return;
            }
            const locale = await getUserLocale(email);
            const copy = getAuthEmailCopy(locale);
            await sendOtpEmail(email, interpolate(copy.subject, { otp }), {
              otp,
              copy,
              requestCopy: enUS.emails.requestDetails,
              instanceUrl: clientUrl,
              email,
              ...requestContext,
            });
          });
        }
      },
    }),
    organization({
      // SAFETY: the runtime access control uses the same statement as these
      // roles. Only Better Auth's broader newRole signature needs widening.
      // oxlint-disable-next-line anti-slop/no-chained-type-assertions
      ac: ac as unknown as AccessControl,
      // Only `owner` stays static so its permissions can never be edited away
      // from the workspace creator. `viewer`, `member`, and `admin` are
      // seeded into `workspace_role` per workspace and resolved via
      // dynamic access control, so admins can fully override (replace) their
      // permissions per workspace. See `seedDefaultWorkspaceRoles` + the
      // afterCreateOrganization hook.
      roles: { owner },
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 25,
      },
      teams: {
        enabled: true,
        maximumTeams: 10,
        allowRemovingAllTeams: false,
      },
      schema: {
        organization: {
          modelName: "workspace",
          additionalFields: {
            // in metadata
            description: {
              type: "string",
              input: true,
              required: false,
            },
          },
        },
        member: {
          modelName: "workspace_member",
          fields: {
            organizationId: "workspaceId",
            createdAt: "joinedAt",
          },
        },
        invitation: {
          modelName: "invitation",
          fields: {
            organizationId: "workspaceId",
          },
        },
        organizationRole: {
          modelName: "workspace_role",
          fields: {
            organizationId: "workspaceId",
          },
        },
        team: {
          modelName: "team",
          fields: {
            organizationId: "workspaceId",
          },
        },
      },
      // When `DISABLE_WORKSPACE_CREATION` is set, only instance admins
      // (role list includes "admin") may create workspaces — mirrors the
      // implicit-exemption shape of `DISABLE_REGISTRATION` above. This
      // check runs before any workspace membership exists, so only the
      // instance-wide role is meaningful here; per-workspace roles
      // (owner/admin/member/viewer) don't apply until after a workspace
      // is joined.
      //
      // Read the current instance role rather than a session's user snapshot,
      // which can predate first-user promotion or an administrator's changes.
      // The disabled setting and the per-user limit are both enforced in
      // `beforeCreateOrganization`, from one policy.
      allowUserToCreateOrganization: true,
      requireEmailVerificationOnInvitation: true,
      organizationHooks: { ...workspaceHooks, ...memberHooks },
      sendInvitationEmail,
    }),
    bearer(),
    adminPlugin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    // Signs the MCP access tokens; keys live in the database so every instance
    // shares them. No token is set on ordinary session reads.
    jwt({ disableSettingJwtHeader: true }),
    // The MCP endpoint's OAuth server: dynamic client registration for public
    // clients, PKCE, consent on the web app and JWT access tokens bound to the
    // MCP resource. The web app owns the login and consent pages.
    oauthProvider({
      loginPage: `${clientUrl}/mcp/login`,
      consentPage: `${clientUrl}/mcp/authorize`,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      resources: [MCP_RESOURCE],
      clientRegistrationDefaultResources: [MCP_RESOURCE],
    }),
  ],
  session: {
    cookieCache: {
      // Consult the session store on every request so revoked sessions are
      // rejected immediately.
      enabled: false,
    },
  },
  rateLimit: {
    // Always on, including in development and tests (Better Auth's default is
    // production-only). Counters live in process memory: no Redis dependency,
    // limits are per instance and reset on restart. Global limits stay
    // conservative; sensitive endpoints are tightened via customRules.
    enabled: true,
    storage: "memory",
    window: 10,
    max: 100,
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/organization/invite-member": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      update: {
        before: async (user, ctx) => {
          // Only the avatar procedures write user.image, so a client cannot
          // point it at an arbitrary URL through Better Auth's update-user.
          const cleared = await clearEmailVerificationOnAdminChange(user, ctx);
          return { data: { ...(cleared?.data ?? user), image: undefined } };
        },
      },
      create: {
        before: async (user, ctx) => {
          await assertUserRegistrationAllowed(user as { email: string }, {
            path: ctx?.path,
            invitationId:
              ctx?.body?.invitationId ||
              ctx?.query?.invitationId ||
              ctx?.headers?.get("x-invitation-id"),
          });
          // user.image is only ever our own storage URL or null: drop the
          // provider's photo.
          return { data: { ...user, image: null } };
        },
        after: async (user) => {
          await syncAdminRole(user);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [user] = await db
            .select()
            .from(schema.userTable)
            .where(eq(schema.userTable.id, session.userId))
            .limit(1);
          if (user) await syncAdminRole(user);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/admin/remove-user") {
        await prepareAdminUserRemoval(ctx);
      }

      // Admins come from ADMIN_EMAILS; roles are not editable and accounts are
      // created by signing up.
      const changesRole =
        ctx.path === "/admin/set-role" ||
        ctx.path === "/admin/create-user" ||
        (ctx.path === "/admin/update-user" &&
          Object.hasOwn(ctx.body?.data ?? {}, "role"));
      if (changesRole) {
        throw new APIError("FORBIDDEN", {
          code: "ADMIN_ROLE_MANAGED",
          message: "Administrators are set with ADMIN_EMAILS.",
        });
      }

      if (ctx.path === "/organization/invite-member") {
        // Better Auth swallows email failures in runInBackgroundOrAwait.
        // Invitation callers need the delivery result, including on resend.
        ctx.context.runInBackgroundOrAwait = async (promise) => {
          try {
            await promise;
          } catch {
            throw new APIError("BAD_GATEWAY", {
              code: "INVITATION_EMAIL_FAILED",
              message:
                "Invitation saved, but email delivery failed. Check email settings and resend the invitation.",
            });
          }
        };
      }

      // MCP clients register without an application type, which OIDC reads as
      // "web" and refuses loopback http callbacks for. Treat them as native:
      // that allows loopback http, private-use schemes and https callbacks.
      if (
        ctx.path === "/oauth2/register" &&
        ctx.body &&
        !ctx.body.application_type
      ) {
        return {
          context: { body: { ...ctx.body, application_type: "native" } },
        };
      }

      if (authCaptchaPaths.has(ctx.path)) {
        const verdict = await verifyTurnstile(
          ctx.headers?.get("x-turnstile-token") ?? ctx.body?.turnstileToken,
        );
        if (!verdict.ok)
          throw new APIError("FORBIDDEN", { message: verdict.reason });
      }

      // Throwaway disposable-email accounts have been used to send phishing
      // invitations, so they cannot be invited either.
      if (ctx.path === "/organization/invite-member") {
        const inviteeEmail = (ctx.body?.email as string | undefined) ?? "";
        if (inviteeEmail && isDisposableEmail(inviteeEmail)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Invitations to disposable-email addresses are not allowed.",
          });
        }
      }

      // CAPTCHA is enforced above on every account-creation initiation when
      // configured. Existing accounts may still sign in with a disposable
      // address. Closed registration is enforced at account creation, so the
      // response here never reveals whether an address may register.
      if (ctx.path === "/email-otp/send-verification-otp") {
        const email = (ctx.body?.email as string | undefined) ?? "";
        if (
          email &&
          isDisposableEmail(email) &&
          !(await userExistsByEmail(email))
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Sign-up with disposable email addresses is not allowed.",
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up") || ctx.path.startsWith("/sign-in")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          const workspaceMember = await db
            .select({ workspaceId: schema.workspaceUserTable.workspaceId })
            .from(schema.workspaceUserTable)
            .where(eq(schema.workspaceUserTable.userId, newSession.user.id))
            .limit(1);

          const activeWorkspaceId = workspaceMember[0]?.workspaceId || null;

          if (activeWorkspaceId) {
            await db
              .update(schema.sessionTable)
              .set({ activeOrganizationId: activeWorkspaceId })
              .where(eq(schema.sessionTable.id, newSession.session.id));
          }
        }
      }
    }),
  },
  advanced: {
    ipAddress: {
      // Set only by the Node transport middleware, never accepted from clients.
      ipAddressHeaders: ["x-morrow-client-ip"],
      trustedProxies: [],
    },
    defaultCookieAttributes: {
      sameSite: "lax" as const,
      secure: new URL(apiUrl).protocol === "https:",
    },
  },
});
