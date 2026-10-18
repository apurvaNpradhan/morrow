import type { LabelRow, ProjectRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { buildSearchGroups, type SearchSources } from "./search-groups";

const project = (key: string, name: string, archivedAt: Date | null = null) =>
  ({ key, name, archivedAt }) as ProjectRow;
const label = (id: string, name: string) => ({ id, name }) as LabelRow;

const empty: SearchSources = {
  slug: "acme",
  query: "",
  projects: [],
  labels: [],
  members: [],
};

const taskHit = (id: string, ticketId: string, title: string) => ({
  id,
  ticketId,
  title,
  category: "started",
  archived: false,
  projectArchived: false,
  snippet: null,
});

describe("buildSearchGroups", () => {
  it("orders groups tasks, comments, projects, labels, members and drops empty ones", () => {
    const groups = buildSearchGroups({
      ...empty,
      query: "ada",
      remote: {
        tasks: [taskHit("t1", "MOR-1", "Ada task")],
        comments: [
          {
            id: "c1",
            ticketId: "MOR-1",
            taskTitle: "Ada task",
            authorName: "Ada",
            createdAt: new Date(0),
            archived: false,
            projectArchived: false,
            snippet: "ada said",
          },
        ],
      },
      projects: [project("ADA", "Ada")],
      labels: [label("l1", "ada")],
      members: [
        {
          userId: "u1",
          user: { name: "Ada", email: "ada@example.com", image: null },
        },
      ],
    });
    expect(groups.map((group) => group.value)).toEqual([
      "tasks",
      "comments",
      "projects",
      "labels",
      "members",
    ]);
    expect(buildSearchGroups({ ...empty, query: "zzz" })).toEqual([]);
  });

  it("filters projects, labels and members by the typed words and caps each at five", () => {
    const projects = Array.from({ length: 8 }, (_, n) =>
      project(`P${n}`, `Plan ${n}`),
    );
    const [group] = buildSearchGroups({ ...empty, query: "plan", projects });
    expect(group?.items).toHaveLength(5);
    expect(buildSearchGroups({ ...empty, query: "other", projects })).toEqual(
      [],
    );
  });

  it("puts a typed ticket id first and does not repeat it from the server", () => {
    const [group] = buildSearchGroups({
      ...empty,
      query: "MOR-1",
      ticket: {
        id: "t1",
        ticketId: "MOR-1",
        title: "One",
        category: "started",
      },
      remote: {
        tasks: [taskHit("t2", "MOR-2", "Two"), taskHit("t1", "MOR-1", "One")],
        comments: [],
      },
    });
    expect(group?.items.map((item) => item.value)).toEqual([
      "task:t1",
      "task:t2",
    ]);
  });

  it("sends each result where it belongs", () => {
    const groups = buildSearchGroups({
      ...empty,
      query: "x",
      remote: {
        tasks: [taskHit("t1", "MOR-1", "x")],
        comments: [
          {
            id: "c1",
            ticketId: "MOR-1",
            taskTitle: "x",
            authorName: null,
            createdAt: new Date(0),
            archived: false,
            projectArchived: false,
            snippet: "x",
          },
        ],
      },
      projects: [project("XX", "x")],
      labels: [label("l1", "x")],
      members: [
        { userId: "u1", user: { name: "x", email: "x@y.z", image: null } },
      ],
    });
    expect(groups.map((group) => group.items[0]?.to)).toEqual([
      {
        to: "/$slug/tasks/$ticketId",
        params: { slug: "acme", ticketId: "MOR-1" },
      },
      {
        to: "/$slug/tasks/$ticketId",
        params: { slug: "acme", ticketId: "MOR-1" },
        search: { comment: "c1" },
      },
      { to: "/$slug/projects/$key", params: { slug: "acme", key: "XX" } },
      { to: "/$slug/settings/workspace/labels", params: { slug: "acme" } },
      { to: "/$slug/settings/workspace/members", params: { slug: "acme" } },
    ]);
  });

  it("flags archived tasks, and tasks and projects of archived projects", () => {
    const groups = buildSearchGroups({
      ...empty,
      query: "x",
      remote: {
        tasks: [
          { ...taskHit("t1", "MOR-1", "x"), archived: true },
          { ...taskHit("t2", "MOR-2", "x"), projectArchived: true },
          taskHit("t3", "MOR-3", "x"),
        ],
        comments: [],
      },
      projects: [project("XX", "x", new Date(0))],
    });
    const archived = groups.map((group) =>
      group.items.map((item) =>
        item.kind === "task" || item.kind === "project" ? item.archived : null,
      ),
    );
    expect(archived).toEqual([[true, true, false], [true]]);
  });
});
