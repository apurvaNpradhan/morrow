import {
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
  ticketId,
} from "@morrow/sync-schemas";
import { sql } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { parseQuery } from "../lib/parse-query";

export const MAX_TASK_HITS = 8;
export const MAX_COMMENT_HITS = 5;

/** A title this close to the text counts as a typo of it (default 0.6 is too strict). */
const WORD_SIMILARITY_THRESHOLD = "0.45";

const HEADLINE = `StartSel=${SNIPPET_MARK_START}, StopSel=${SNIPPET_MARK_END}, MaxWords=20, MinWords=8, MaxFragments=1`;

/** What the markers must not collide with: the text is cleaned of them first. */
const withoutMarkers = (column: string) =>
  `translate(${column}, '${SNIPPET_MARK_START}${SNIPPET_MARK_END}', '')`;

/*
 * Where a hit stands, so open work comes first: 0 open, 1 completed (a done or
 * canceled Column), 2 archived task, 3 task of an archived Project.
 */
const STATE = `CASE
  WHEN p.archived_at IS NOT NULL THEN 3
  WHEN t.archived_at IS NOT NULL THEN 2
  WHEN c.category IN ('done', 'canceled') THEN 1
  ELSE 0
END`;

type TaskRow = {
  id: string;
  project_id: string;
  project_key: string;
  number: number;
  title: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  category: string;
  archived: boolean;
  project_archived: boolean;
  snippet: string | null;
};

type CommentRow = {
  id: string;
  task_id: string;
  project_id: string;
  project_key: string;
  number: number;
  task_title: string;
  author_name: string | null;
  /** Milliseconds since the epoch: `execute` returns raw driver values. */
  created_ms: number;
  archived: boolean;
  project_archived: boolean;
  snippet: string;
};

/**
 * Tasks (title, then description) and comments of a Workspace that match what
 * was typed, in one statement. Full-text search finds words in any order, with
 * stemming and the last word still being typed; trigram similarity finds a
 * title despite a typo. Both are served by the indexes of migration 0023.
 */
export async function searchWorkspace(workspaceId: string, input: string) {
  const query = parseQuery(input);
  if (!query) return { tasks: [], comments: [] };

  const inWorkspace = sql`(SELECT id FROM project WHERE workspace_id = ${workspaceId})`;
  const tsquery = sql`to_tsquery('english', ${query.tsquery})`;

  const { rows } = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${WORD_SIMILARITY_THRESHOLD}, true)`,
    );
    return tx.execute<
      ({ kind: "task" } & TaskRow) | ({ kind: "comment" } & CommentRow)
    >(sql`
      WITH q AS (SELECT ${tsquery} AS tsq, ${query.text}::text AS text),
      matching_tasks AS (
        SELECT id FROM task, q
        WHERE project_id IN ${inWorkspace}
          AND (to_tsvector('english', title) @@ q.tsq OR q.text <% title)
        UNION
        SELECT task_id FROM task_description, q
        WHERE project_id IN ${inWorkspace}
          AND to_tsvector('english', description) @@ q.tsq
      ),
      ranked_tasks AS (
        SELECT t.id, t.project_id, p.key AS project_key, t.number, t.title,
          t.priority, c.category, t.archived_at IS NOT NULL AS archived,
          p.archived_at IS NOT NULL AS project_archived, d.description,
          (to_tsvector('english', t.title) @@ q.tsq OR q.text <% t.title) AS title_match,
          ${sql.raw(STATE)} AS state,
          CASE
            WHEN to_tsvector('english', t.title) @@ q.tsq
              THEN 3 + ts_rank_cd(to_tsvector('english', t.title), q.tsq, 32)
            WHEN q.text <% t.title THEN 2 + word_similarity(q.text, t.title)
            ELSE 1 + ts_rank_cd(to_tsvector('english', d.description), q.tsq, 32)
          END AS score,
          t.updated_at
        FROM matching_tasks m
        JOIN task t ON t.id = m.id
        JOIN project p ON p.id = t.project_id
        JOIN project_column c ON c.id = t.column_id
        LEFT JOIN task_description d ON d.task_id = t.id
        CROSS JOIN q
        ORDER BY state, score DESC, t.updated_at DESC
        LIMIT ${MAX_TASK_HITS}
      ),
      ranked_comments AS (
        SELECT cm.id, cm.task_id, cm.project_id, p.key AS project_key, t.number,
          t.title AS task_title, u.name AS author_name,
          extract(epoch FROM cm.created_at)::float8 * 1000 AS created_ms,
          t.archived_at IS NOT NULL AS archived,
          p.archived_at IS NOT NULL AS project_archived, cm.body,
          ${sql.raw(STATE)} AS state,
          ts_rank_cd(to_tsvector('english', cm.body), q.tsq, 32) AS score
        FROM task_comment cm
        JOIN task t ON t.id = cm.task_id
        JOIN project p ON p.id = cm.project_id
        JOIN project_column c ON c.id = t.column_id
        LEFT JOIN "user" u ON u.id = cm.author_id
        CROSS JOIN q
        WHERE cm.project_id IN ${inWorkspace}
          AND to_tsvector('english', cm.body) @@ q.tsq
        ORDER BY state, score DESC, cm.created_at DESC
        LIMIT ${MAX_COMMENT_HITS}
      )
      SELECT 'task' AS kind, id, project_id, project_key, number, title, priority,
        category, archived, project_archived, NULL::text AS task_title,
        NULL::text AS author_name, NULL::float8 AS created_ms, NULL::text AS task_id,
        CASE WHEN NOT title_match AND description IS NOT NULL THEN ts_headline(
          'english', ${sql.raw(withoutMarkers("description"))}, (SELECT tsq FROM q), ${HEADLINE}
        ) END AS snippet, state, score, 0 AS seq
      FROM ranked_tasks
      UNION ALL
      SELECT 'comment', id, project_id, project_key, number, NULL, NULL, NULL,
        archived, project_archived, task_title, author_name, created_ms, task_id,
        ts_headline('english', ${sql.raw(withoutMarkers("body"))}, (SELECT tsq FROM q), ${HEADLINE}),
        state, score, 1
      FROM ranked_comments
      ORDER BY seq, state, score DESC
    `);
  });

  const tasks = rows.flatMap((row) =>
    row.kind === "task"
      ? [
          {
            id: row.id,
            projectId: row.project_id,
            projectKey: row.project_key,
            ticketId: ticketId(row.project_key, row.number),
            title: row.title,
            priority: row.priority,
            category: row.category,
            snippet: row.snippet,
            archived: row.archived,
            projectArchived: row.project_archived,
          },
        ]
      : [],
  );
  const comments = rows.flatMap((row) =>
    row.kind === "comment"
      ? [
          {
            id: row.id,
            taskId: row.task_id,
            projectId: row.project_id,
            projectKey: row.project_key,
            ticketId: ticketId(row.project_key, row.number),
            taskTitle: row.task_title,
            authorName: row.author_name,
            createdAt: new Date(row.created_ms),
            snippet: row.snippet,
            archived: row.archived,
            projectArchived: row.project_archived,
          },
        ]
      : [],
  );
  return { tasks, comments };
}
