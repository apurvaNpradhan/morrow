/** Only same-origin paths may be used as a post-onboarding destination. */
export function getSafeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return undefined;
  return value;
}
