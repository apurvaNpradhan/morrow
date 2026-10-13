import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sessionTable, userTable } from "#api/auth/tables";

// The tables Better Auth's OAuth provider plugin reads and writes for the MCP
// endpoint's OAuth server. Keys match the plugin's model names; keep them in
// step with the plugin's schema when upgrading it.

export const oauthClientTable = pgTable(
  "oauth_client",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default([]),
    userId: text("user_id").references(() => userTable.id),
    createdAt: timestamp("created_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauth_client_user_id_idx").on(table.userId)],
);

export const oauthResourceTable = pgTable("oauth_resource", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: timestamp("created_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

export const oauthClientResourceTable = pgTable(
  "oauth_client_resource",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientTable.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResourceTable.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }),
  },
  (table) => [
    index("oauth_client_resource_client_id_idx").on(table.clientId),
    index("oauth_client_resource_resource_id_idx").on(table.resourceId),
    uniqueIndex("oauth_client_resource_client_id_resource_id_uidx").on(
      table.clientId,
      table.resourceId,
    ),
  ],
);

export const oauthRefreshTokenTable = pgTable(
  "oauth_refresh_token",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientTable.clientId),
    sessionId: text("session_id").references(() => sessionTable.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    revoked: timestamp("revoked", { mode: "date" }),
    rotatedAt: timestamp("rotated_at", { mode: "date" }),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: timestamp("rotation_replay_expires_at", {
      mode: "date",
    }),
    authTime: timestamp("auth_time", { mode: "date" }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauth_refresh_token_client_id_idx").on(table.clientId),
    index("oauth_refresh_token_session_id_idx").on(table.sessionId),
    index("oauth_refresh_token_user_id_idx").on(table.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
  ],
);

export const oauthAccessTokenTable = pgTable(
  "oauth_access_token",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientTable.clientId),
    sessionId: text("session_id").references(() => sessionTable.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => userTable.id),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: text("refresh_id").references(() => oauthRefreshTokenTable.id),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    revoked: timestamp("revoked", { mode: "date" }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauth_access_token_client_id_idx").on(table.clientId),
    index("oauth_access_token_session_id_idx").on(table.sessionId),
    index("oauth_access_token_user_id_idx").on(table.userId),
    index("oauth_access_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
    index("oauth_access_token_refresh_id_idx").on(table.refreshId),
  ],
);

export const oauthConsentTable = pgTable(
  "oauth_consent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClientTable.clientId),
    userId: text("user_id").references(() => userTable.id),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("oauth_consent_client_id_idx").on(table.clientId),
    index("oauth_consent_user_id_idx").on(table.userId),
  ],
);

export const oauthClientAssertionTable = pgTable("oauth_client_assertion", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});
