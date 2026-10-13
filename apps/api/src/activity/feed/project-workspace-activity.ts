import type { WorkspaceActivityEvent } from "#api/activity/recording/events";

export type PublicWorkspaceActivity = {
  resourceType: "user" | "workspace";
  resourceId: string;
  eventData: Record<string, unknown>;
};

/** Projects an event to public activity metadata without exposing invitation capabilities. */
export function projectWorkspaceActivity(
  event: WorkspaceActivityEvent,
): PublicWorkspaceActivity {
  switch (event.type) {
    case "workspace.member_joined":
    case "workspace.member_removed":
      return {
        resourceType: "user",
        resourceId: event.memberId,
        eventData: { memberName: event.memberName },
      };
    case "workspace.member_role_changed":
      return {
        resourceType: "user",
        resourceId: event.memberId,
        eventData: {
          memberName: event.memberName,
          previousRole: event.previousRole,
          role: event.role,
        },
      };
    case "workspace.invitation_created":
      return {
        resourceType: "workspace",
        resourceId: event.workspaceId,
        eventData: { role: event.role },
      };
    case "workspace.invitation_revoked":
      return {
        resourceType: "workspace",
        resourceId: event.workspaceId,
        eventData: {},
      };
    case "workspace.updated":
      return {
        resourceType: "workspace",
        resourceId: event.workspaceId,
        eventData: { fields: event.fields },
      };
    case "workspace.ownership_transferred":
      return {
        resourceType: "user",
        resourceId: event.ownerId,
        eventData: { ownerName: event.ownerName },
      };
  }
}

/** Removes sensitive fields from previously stored invitation activity on reads. */
export function projectStoredWorkspaceActivity(input: {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  type: string;
  eventData: Record<string, unknown>;
}): PublicWorkspaceActivity {
  if (input.type === "workspace.invitation_created") {
    return {
      resourceType: "workspace",
      resourceId: input.workspaceId,
      eventData:
        typeof input.eventData.role === "string" ||
        input.eventData.role === null
          ? { role: input.eventData.role }
          : {},
    };
  }
  if (input.type === "workspace.invitation_revoked") {
    return {
      resourceType: "workspace",
      resourceId: input.workspaceId,
      eventData: {},
    };
  }
  const allowedKeys = new Map(
    Object.entries({
      "workspace.member_joined": ["memberName"],
      "workspace.member_removed": ["memberName"],
      "workspace.member_role_changed": ["memberName", "previousRole", "role"],
      "workspace.updated": ["fields"],
      "workspace.ownership_transferred": ["ownerName"],
    } satisfies Record<string, string[]>),
  );
  const eventData = Object.fromEntries(
    (allowedKeys.get(input.type) ?? [])
      .filter((key) => key in input.eventData)
      .map((key) => [key, input.eventData[key]]),
  );
  const isWorkspaceResource = input.resourceType === "workspace";
  return {
    resourceType: isWorkspaceResource ? "workspace" : "user",
    resourceId: isWorkspaceResource ? input.workspaceId : input.resourceId,
    eventData,
  };
}
