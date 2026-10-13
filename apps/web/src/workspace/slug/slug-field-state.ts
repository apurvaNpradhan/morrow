import {
  createDefaultSlug,
  getSlugIssue,
} from "@morrow/permissions/workspace-slug";

export type SlugFieldStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "invalid";

export type SlugAvailabilityResult =
  | { available: true }
  | { available: false; reason: "taken" | "reserved" | "invalid" };

export type SlugFieldValue = { slug: string; edited: boolean };

/** The slug follows the name until the person edits it by hand; clearing it hands control back. */
export function slugAfterNameChange(
  current: SlugFieldValue,
  name: string,
): SlugFieldValue {
  return current.edited
    ? current
    : { slug: createDefaultSlug(name), edited: false };
}

export function slugAfterEdit(value: string): SlugFieldValue {
  const slug = value.toLowerCase();
  return { slug, edited: slug !== "" };
}

/**
 * Format problems are decided locally; everything else waits on the API's
 * answer for this exact slug.
 */
export function getSlugFieldStatus({
  slug,
  checkedSlug,
  result,
}: {
  slug: string;
  /** The slug the latest availability answer is for. */
  checkedSlug: string | undefined;
  result: SlugAvailabilityResult | undefined;
}): SlugFieldStatus {
  if (slug === "") return "idle";
  const issue = getSlugIssue(slug);
  if (issue) return issue;
  if (!result || checkedSlug !== slug) return "checking";
  return result.available ? "available" : result.reason;
}

/** Continue is only enabled for a slug known to be free. */
export function isSlugUsable(status: SlugFieldStatus): boolean {
  return status === "available";
}
