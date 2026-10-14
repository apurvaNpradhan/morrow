import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

type ActivityItemProps = {
  activity: {
    type: string;
    actorName: string | null;
    eventData: Record<string, unknown>;
    createdAt: Date | string;
  };
};

const ACTIVITY_KEYS = new Map(
  Object.entries({
    "workspace.member_joined": "memberJoined",
    "workspace.member_removed": "memberRemoved",
    "workspace.member_role_changed": "memberRoleChanged",
    "workspace.invitation_created": "invitationCreated",
    "workspace.invitation_revoked": "invitationRevoked",
    "workspace.updated": "workspaceUpdated",
    "workspace.ownership_transferred": "ownershipTransferred",
    "project.created": "projectCreated",
    "project.archived": "projectArchived",
    "project.unarchived": "projectUnarchived",
    "project.deleted": "projectDeleted",
    "project.key_changed": "projectKeyChanged",
  } satisfies Record<string, string>),
);

/** Renders an activity summary with the verified actor and event time. */
export function ActivityItem({ activity }: ActivityItemProps) {
  const { t } = useTranslation("workspace");
  const key = ACTIVITY_KEYS.get(activity.type);
  const eventData = activity.eventData;
  const eventTitle = key
    ? t(`home.activity.events.${key}`, {
        memberName:
          typeof eventData.memberName === "string" ? eventData.memberName : "",
        ownerName:
          typeof eventData.ownerName === "string" ? eventData.ownerName : "",
        previousRole:
          typeof eventData.previousRole === "string"
            ? eventData.previousRole
            : "",
        role: typeof eventData.role === "string" ? eventData.role : "",
        projectKey:
          typeof eventData.projectKey === "string" ? eventData.projectKey : "",
        projectName:
          typeof eventData.projectName === "string"
            ? eventData.projectName
            : "",
        previousKey:
          typeof eventData.previousKey === "string"
            ? eventData.previousKey
            : "",
      })
    : t("home.activity.unknown");
  const elapsed = formatDistanceToNow(new Date(activity.createdAt));
  return (
    <li className="flex flex-col gap-1 border-b py-3 last:border-b-0">
      <p className="text-sm">{eventTitle}</p>
      <p className="text-xs text-muted-foreground">
        <span>{activity.actorName ?? t("home.activity.unknownActor")}</span>
        <span aria-hidden="true"> · </span>
        <time dateTime={new Date(activity.createdAt).toISOString()}>
          {t("home.activity.timeAgo", { time: elapsed })}
        </time>
      </p>
    </li>
  );
}
