const MAX_LENGTH = 60;

/** A git branch name for a task: `mor-12-external-links-on-a-task`, at most 60 characters. */
export function branchName(ticket: string, title: string) {
  const prefix = ticket.toLowerCase();
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return prefix;
  const name = `${prefix}-${slug}`;
  if (name.length <= MAX_LENGTH) return name;
  // Cut at the last dash before the cap; a first word too long to fit is cut hard.
  const cut = name.slice(0, MAX_LENGTH + 1);
  const dash = cut.lastIndexOf("-");
  return dash > prefix.length
    ? cut.slice(0, dash)
    : cut.slice(0, MAX_LENGTH).replace(/-+$/, "");
}
