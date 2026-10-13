import { and, desc, eq, lt, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import {
  encodeWorkspaceActivityCursor,
  parseWorkspaceActivityCursor,
} from "#api/activity/feed/workspace-activity-cursor";
import { db } from "#api/platform/database/index";
import { eventContext } from "#api/platform/event-context";
import { activityTable, userTable } from "#api/platform/database/schema";
import { parseWorkspaceActivityEvent } from "./events";
import {
  projectStoredWorkspaceActivity,
  projectWorkspaceActivity,
} from "#api/activity/feed/project-workspace-activity";

const PAGE_LIMIT_MAX = 100;

/** A workspace activity row with only the actor display name exposed. */
export type WorkspaceActivityItem = {
  id: string;
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  type: string;
  actorUserId: string | null;
  actorName: string | null;
  content: string;
  eventData: Record<string, unknown>;
  createdAt: Date;
};

/** A stable newest-first page of activity scoped to one workspace. */
export type WorkspaceActivityPage = {
  items: WorkspaceActivityItem[];
  nextCursor: string | null;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Persists one validated, allowlisted event as a generic workspace activity row,
 * attributed to the request's verified actor. Pass the caller's `tx` to commit
 * the row with the change it describes.
 */
export async function recordWorkspaceActivity(
  input: unknown,
  executor: typeof db | Transaction = db,
): Promise<string> {
  const event = parseWorkspaceActivityEvent(input);
  const { type, workspaceId } = event;
  const resource = projectWorkspaceActivity(event);

  const id = createId();
  await executor.insert(activityTable).values({
    id,
    workspaceId,
    ...resource,
    type,
    actorUserId: eventContext.getStore()?.actorUserId ?? null,
    content: type,
    eventData: resource.eventData,
  });
  return id;
}

/** Reads a bounded, stable page of workspace activity; cursor ties break by activity ID. */
export async function listWorkspaceActivityPage(request: {
  workspaceId: string;
  limit: number;
  cursor?: string;
}): Promise<WorkspaceActivityPage> {
  const limit = Math.min(PAGE_LIMIT_MAX, Math.max(1, request.limit));
  let cursor: { createdAt: Date; id: string } | undefined;
  if (request.cursor) {
    const parsedCursor = parseWorkspaceActivityCursor(request.cursor);
    if (!parsedCursor) {
      throw new Error("Invalid workspace activity cursor");
    }
    cursor = parsedCursor;
  }

  const rows = await db
    .select({
      id: activityTable.id,
      workspaceId: activityTable.workspaceId,
      resourceType: activityTable.resourceType,
      resourceId: activityTable.resourceId,
      type: activityTable.type,
      actorUserId: activityTable.actorUserId,
      actorName: userTable.name,
      content: activityTable.content,
      eventData: activityTable.eventData,
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .leftJoin(userTable, eq(activityTable.actorUserId, userTable.id))
    .where(
      and(
        eq(activityTable.workspaceId, request.workspaceId),
        cursor
          ? or(
              lt(activityTable.createdAt, cursor.createdAt),
              and(
                eq(activityTable.createdAt, cursor.createdAt),
                lt(activityTable.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => {
    const eventData = z
      .record(z.string(), z.unknown())
      .safeParse(row.eventData);
    const safeProjection = projectStoredWorkspaceActivity({
      workspaceId: row.workspaceId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      type: row.type,
      eventData: eventData.success ? eventData.data : {},
    });
    return {
      ...row,
      ...safeProjection,
      content: row.content ?? row.type,
    };
  });
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeWorkspaceActivityCursor({
            createdAt: last.createdAt,
            id: last.id,
          })
        : null,
  };
}
