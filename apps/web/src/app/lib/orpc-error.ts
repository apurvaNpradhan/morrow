import { ORPCError } from "@orpc/client";

/** Translation keys for the typed error codes the API throws. */
const KEYS = new Map(
  Object.entries({
    BAD_REQUEST: "common:errors.badRequest",
    UNAUTHORIZED: "common:errors.unauthorized",
    FORBIDDEN: "common:errors.forbidden",
    NOT_FOUND: "common:errors.notFound",
    CONFLICT: "common:errors.conflict",
    TOO_MANY_REQUESTS: "common:errors.tooManyRequests",
    BAD_GATEWAY: "common:errors.badGateway",
  } satisfies Record<string, string>),
);

/**
 * Translation keys for the stable `data.code` values domain functions throw
 * (`new ORPCError("BAD_REQUEST", { data: { code: "IMAGE_TOO_LARGE" } })`).
 * Add the code here when you add it on the server.
 */
const DOMAIN_KEYS = new Map(
  Object.entries({
    IMAGE_TOO_LARGE: "common:errors.imageTooLarge",
    IMAGE_UNSUPPORTED_TYPE: "common:errors.imageUnsupportedType",
    IMAGE_INVALID: "common:errors.imageInvalid",
    WORKSPACE_LIMIT_REACHED: "common:errors.workspaceLimitReached",
    STORAGE_UNAVAILABLE: "common:errors.storageUnavailable",
    ADMIN_ROLE_MANAGED: "common:errors.adminRoleManaged",
    INVITATION_EMAIL_FAILED: "common:errors.invitationEmailFailed",
    PROJECT_KEY_TAKEN: "common:errors.projectKeyTaken",
    POSITION_TAKEN: "common:errors.positionTaken",
    PROJECT_ARCHIVED: "common:errors.projectArchived",
    PROJECT_NOT_ARCHIVED: "common:errors.projectNotArchived",
    COLUMN_NAME_TAKEN: "common:errors.columnNameTaken",
    LAST_REQUIRED_COLUMN: "common:errors.lastRequiredColumn",
    INVALID_POSITION: "common:errors.invalidPosition",
    INVALID_TARGET_COLUMN: "common:errors.invalidTargetColumn",
    INVALID_ID: "common:errors.taskInvalidId",
    ID_TAKEN: "common:errors.taskIdTaken",
    COLUMN_NOT_IN_PROJECT: "common:errors.taskColumnNotInProject",
    COLUMN_NOT_CLOSED: "common:errors.taskColumnNotClosed",
    ASSIGNEE_NOT_MEMBER: "common:errors.taskAssigneeNotMember",
    FORBIDDEN_ASSIGN: "common:errors.taskForbiddenAssign",
    IMPORT_TOO_LARGE: "common:errors.taskImportTooLarge",
    IMPORT_INVALID: "common:errors.taskImportInvalid",
    INVALID_LABEL_ID: "common:errors.labelInvalidId",
    LABEL_ID_TAKEN: "common:errors.labelIdTaken",
    LABEL_NAME_TAKEN: "common:errors.labelNameTaken",
    LABEL_LIMIT_REACHED: "common:errors.labelLimitReached",
  } satisfies Record<string, string>),
);

/** The typed code of an API error, if it is one. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof ORPCError ? error.code : undefined;
}

/** The finer-grained code some failures carry (e.g. INVITATION_EMAIL_FAILED). */
export function detailCode(error: unknown): string | undefined {
  if (!(error instanceof ORPCError)) return undefined;
  const data = error.data as { code?: unknown } | null | undefined;
  return typeof data?.code === "string" ? data.code : undefined;
}

/**
 * The i18n key for an API error: the domain code's key, else the typed code's,
 * else a generic one. The error's own message is never shown.
 */
export function errorMessageKey(error: unknown): string {
  if (!(error instanceof ORPCError)) return "common:errors.unknown";
  const detail = detailCode(error);
  return (
    (detail ? DOMAIN_KEYS.get(detail) : undefined) ??
    KEYS.get(error.code) ??
    "common:errors.unknown"
  );
}
