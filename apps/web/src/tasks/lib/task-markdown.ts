/** A task as shareable markdown: ticket id and title, its link, then the description. */
export function taskAsMarkdown(task: {
  ticket: string;
  title: string;
  url: string;
  description: string;
}) {
  const body = task.description.trim();
  return [
    `# ${task.ticket}: ${task.title}`,
    "",
    task.url,
    ...(body ? ["", body] : []),
    "",
  ].join("\n");
}
