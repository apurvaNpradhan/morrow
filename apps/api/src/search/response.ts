import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import { z } from "zod";

const snippet = z
  .string()
  .nullable()
  .describe(
    "A few words around the match, with the matched words wrapped in SNIPPET_MARK_START and SNIPPET_MARK_END.",
  );

const where = {
  archived: z.boolean().describe("The task is archived."),
  projectArchived: z.boolean().describe("The task's Project is archived."),
};

export const taskHit = z.object({
  id: z.string(),
  projectId: z.string(),
  projectKey: z.string(),
  ticketId: z.string(),
  title: z.string(),
  priority: z.enum(TASK_PRIORITIES),
  category: z.string().describe("The category of the Column the task sits in."),
  snippet: snippet.describe(
    "Present when the task matched on its description and not its title.",
  ),
  ...where,
});

export const commentHit = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  projectKey: z.string(),
  ticketId: z.string(),
  taskTitle: z.string(),
  authorName: z.string().nullable(),
  createdAt: z.date(),
  snippet: snippet.unwrap().describe("The matching part of the comment."),
  ...where,
});

export const searchResult = z.object({
  tasks: z.array(taskHit),
  comments: z.array(commentHit),
});
