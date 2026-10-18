import type { LabelRow, ProjectRow } from "@morrow/sync-schemas";
import { matchesQuery } from "./matches-query";

/** Where choosing a result goes, for the router. */
export type Destination = {
  to: string;
  params: Record<string, string>;
  search?: Record<string, string>;
};

type Base = { value: string; to: Destination };

export type SearchItem =
  | (Base & {
      kind: "task";
      ticketId: string;
      title: string;
      category: string;
      archived: boolean;
      snippet: string | null;
    })
  | (Base & {
      kind: "comment";
      ticketId: string;
      taskTitle: string;
      authorName: string | null;
      createdAt: Date;
      archived: boolean;
      snippet: string;
    })
  | (Base & { kind: "project"; project: ProjectRow; archived: boolean })
  | (Base & { kind: "label"; label: LabelRow })
  | (Base & {
      kind: "member";
      name: string;
      email: string;
      image: string | null;
    });

export type SearchGroupId =
  | "tasks"
  | "comments"
  | "projects"
  | "labels"
  | "members";

export type SearchGroup = {
  value: SearchGroupId;
  items: SearchItem[];
};

/** Projects, labels and members shown per query: they come from the browser, so there are few. */
const MAX_LOCAL = 5;

export type SearchSources = {
  slug: string;
  /** What was typed. */
  query: string;
  /** The server's answer to a settled query of at least two characters. */
  remote?: {
    tasks: Array<{
      id: string;
      ticketId: string;
      title: string;
      category: string;
      archived: boolean;
      projectArchived: boolean;
      snippet: string | null;
    }>;
    comments: Array<{
      id: string;
      ticketId: string;
      taskTitle: string;
      authorName: string | null;
      createdAt: Date;
      archived: boolean;
      projectArchived: boolean;
      snippet: string;
    }>;
  };
  /** The task a typed ticket id names. */
  ticket?: { id: string; ticketId: string; title: string; category: string };
  projects: ProjectRow[];
  labels: LabelRow[];
  members: Array<{
    userId: string;
    user: { name: string; email: string; image: string | null };
  }>;
};

/** The search dialog's groups, in their fixed order; a group with nothing to show is left out. */
export function buildSearchGroups(sources: SearchSources): SearchGroup[] {
  const { slug, query, remote, ticket } = sources;
  const toTask = (ticketId: string): Destination => ({
    to: "/$slug/tasks/$ticketId",
    params: { slug, ticketId },
  });

  const tasks: SearchItem[] = [];
  if (ticket) {
    tasks.push({
      kind: "task",
      value: `task:${ticket.id}`,
      to: toTask(ticket.ticketId),
      ticketId: ticket.ticketId,
      title: ticket.title,
      category: ticket.category,
      archived: false,
      snippet: null,
    });
  }
  for (const hit of remote?.tasks ?? []) {
    if (hit.id === ticket?.id) continue;
    tasks.push({
      kind: "task",
      value: `task:${hit.id}`,
      to: toTask(hit.ticketId),
      ticketId: hit.ticketId,
      title: hit.title,
      category: hit.category,
      archived: hit.archived || hit.projectArchived,
      snippet: hit.snippet,
    });
  }

  const comments: SearchItem[] = (remote?.comments ?? []).map((hit) => ({
    kind: "comment",
    value: `comment:${hit.id}`,
    to: { ...toTask(hit.ticketId), search: { comment: hit.id } },
    ticketId: hit.ticketId,
    taskTitle: hit.taskTitle,
    authorName: hit.authorName,
    createdAt: hit.createdAt,
    archived: hit.archived || hit.projectArchived,
    snippet: hit.snippet,
  }));

  const projects: SearchItem[] = sources.projects
    .filter((project) => matchesQuery(query, [project.name, project.key]))
    .slice(0, MAX_LOCAL)
    .map((project) => ({
      kind: "project",
      value: `project:${project.key}`,
      to: {
        to: "/$slug/projects/$key",
        params: { slug, key: project.key },
      },
      project,
      archived: project.archivedAt !== null,
    }));

  const labels: SearchItem[] = sources.labels
    .filter((label) => matchesQuery(query, [label.name]))
    .slice(0, MAX_LOCAL)
    .map((label) => ({
      kind: "label",
      value: `label:${label.id}`,
      to: { to: "/$slug/settings/workspace/labels", params: { slug } },
      label,
    }));

  const members: SearchItem[] = sources.members
    .filter((member) =>
      matchesQuery(query, [member.user.name, member.user.email]),
    )
    .slice(0, MAX_LOCAL)
    .map((member) => ({
      kind: "member",
      value: `member:${member.userId}`,
      to: { to: "/$slug/settings/workspace/members", params: { slug } },
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    }));

  const groups: SearchGroup[] = [
    { value: "tasks", items: tasks },
    { value: "comments", items: comments },
    { value: "projects", items: projects },
    { value: "labels", items: labels },
    { value: "members", items: members },
  ];
  return groups.filter((group) => group.items.length > 0);
}
