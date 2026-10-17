const MAX_LENGTH = 60;

/**
 * A git branch name for a task: its lowercased ticket id, then its title as
 * words joined by dashes (`mor-12-external-links-on-a-task`). Only `a-z`, `0-9`
 * and `-` are used, so the result is always a valid ref. The whole name is cut
 * at a word boundary to 60 characters.
 */
export function branchName(ticketId: string, title: string) {
  const prefix = ticketId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = slug ? `${prefix}-${slug}` : prefix;
  if (name.length <= MAX_LENGTH) return name;

  const kept = name.slice(0, MAX_LENGTH);
  // Cut between words; one word longer than the cap is cut where it stands.
  const dash = name[MAX_LENGTH] === "-" ? MAX_LENGTH : kept.lastIndexOf("-");
  const cut = dash > prefix.length ? kept.slice(0, dash) : kept;
  return cut.replace(/-+$/, "");
}
