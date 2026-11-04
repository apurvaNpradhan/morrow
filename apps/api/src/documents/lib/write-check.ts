import type { WorkspaceRefs } from "@morrow/document-schema";
import { DOCUMENT_MAX_BYTES } from "@morrow/sync-schemas";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "#api/platform/database/index";
import { userHasWorkspacePermission } from "#api/platform/permissions";
import { projectTable } from "#api/projects/index";
import { documentClientTable, documentTable } from "../tables";
import { inspectUpdate } from "./inspect-update";
import { pageWriteBudget } from "./rate-budget";
import {
  refusal,
  type YjsAccessCheck,
  type YjsUpdateCheck,
} from "./yjs-access";

/**
 * Whether the session's user may read or write the page they ask for, run on
 * every request to the proxy:
 *
 * - a non-member sees the same "not found" as a page that does not exist, so
 *   page ids cannot be probed (instance administrators are not members and are
 *   refused here too; they reach other Workspaces through the administration
 *   pages only);
 * - the page must belong to the Workspace in the URL, and its stream
 *   generation must be the current one;
 * - writing needs `document: update`, and the page and its Project must not be
 *   archived. An archived page stays readable.
 */
export const documentAccess: YjsAccessCheck = async ({
  userId,
  target,
  mode,
}) => {
  const notFound = refusal("DOCUMENT_NOT_FOUND", "There is no such page");
  const isMember = await userHasWorkspacePermission(
    userId,
    target.workspaceId,
    { workspace: ["read"] },
    false,
  );
  if (!isMember) return notFound;

  const [page] = await db
    .select({
      generation: documentTable.generation,
      archivedAt: documentTable.archivedAt,
      projectArchivedAt: projectTable.archivedAt,
    })
    .from(documentTable)
    .leftJoin(projectTable, eq(projectTable.id, documentTable.projectId))
    .where(
      and(
        eq(documentTable.id, target.docId),
        eq(documentTable.workspaceId, target.workspaceId),
      ),
    );
  if (!page) return notFound;
  if (page.generation !== target.generation) {
    return refusal("SCHEMA_MISMATCH", "The page has moved to a newer version");
  }
  if (mode === "read") return null;

  const canWrite = await userHasWorkspacePermission(
    userId,
    target.workspaceId,
    { document: ["update"] },
    false,
  );
  if (!canWrite) {
    return refusal("FORBIDDEN", "You cannot edit pages in this Workspace");
  }
  if (page.archivedAt || page.projectArchivedAt) {
    return refusal("DOCUMENT_ARCHIVED", "The page is archived");
  }
  return null;
};

/** The members and pages of a Workspace, for the mentions and page links an update holds. */
async function workspaceRefs(workspaceId: string): Promise<WorkspaceRefs> {
  const [members, pages] = await Promise.all([
    db
      .select({ userId: schema.workspaceUserTable.userId })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspaceId)),
    db
      .select({ id: documentTable.id })
      .from(documentTable)
      .where(eq(documentTable.workspaceId, workspaceId)),
  ]);
  return {
    memberIds: new Set(members.map((member) => member.userId)),
    documentIds: new Set(pages.map((page) => page.id)),
  };
}

/**
 * The check every decoded update passes before it is forwarded to the stream.
 * It holds no page state and refuses what no editor sends:
 *
 * - more than the rate budget of (user, page) allows (`RATE_LIMITED`, retried
 *   by the editor), or an update over 1 MB;
 * - an update the page schema does not admit (`inspectUpdate`);
 * - a Yjs client id that is not registered to the sender on this page;
 * - an insert while the page is over its size limit. A pure delete passes, so
 *   people can shrink the page.
 *
 * Awareness updates are not checked here.
 */
export const documentUpdateCheck: YjsUpdateCheck = async ({
  userId,
  target,
  kind,
  update,
}) => {
  if (kind === "awareness") return null;

  const wait = pageWriteBudget.take(userId, target.docId, update.byteLength);
  if (wait !== null) {
    return refusal("RATE_LIMITED", "Too many edits; try again shortly", {
      retryAfterSeconds: wait,
    });
  }
  if (update.byteLength > DOCUMENT_MAX_BYTES) {
    return refusal("DOCUMENT_TOO_LARGE", "The update is over 1 MB");
  }

  const findings = await inspectUpdate(update, () =>
    workspaceRefs(target.workspaceId),
  );
  if (findings.problem) return refusal("INVALID_UPDATE", findings.problem);

  if (findings.clientIds.size > 0) {
    const registered = await db
      .select({ clientId: documentClientTable.yjsClientId })
      .from(documentClientTable)
      .where(
        and(
          eq(documentClientTable.documentId, target.docId),
          eq(documentClientTable.userId, userId),
          inArray(documentClientTable.yjsClientId, [...findings.clientIds]),
        ),
      );
    if (registered.length !== findings.clientIds.size) {
      const known = new Set(registered.map((row) => row.clientId));
      const missing = [...findings.clientIds].filter((id) => !known.has(id));
      return refusal(
        "FORBIDDEN",
        `The update is not written by you (unregistered client ids: ${missing.join(", ")})`,
      );
    }
  }

  if (findings.inserts) {
    const [page] = await db
      .select({ overLimit: documentTable.overLimit })
      .from(documentTable)
      .where(eq(documentTable.id, target.docId));
    if (page?.overLimit) {
      return refusal(
        "DOCUMENT_TOO_LARGE",
        "The page is over its size limit; delete something first",
      );
    }
  }
  return null;
};
