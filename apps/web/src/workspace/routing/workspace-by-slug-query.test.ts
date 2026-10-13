import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import {
  refreshSlugLookups,
  WORKSPACE_BY_SLUG_KEY,
} from "./workspace-by-slug-query";

describe("refreshSlugLookups", () => {
  it("forgets idle lookups so a renamed-back slug can't redirect from a stale answer", async () => {
    const client = new QueryClient();
    // Before the rename, the former slug resolved to the then-current one.
    client.setQueryData([...WORKSPACE_BY_SLUG_KEY, "acme"], {
      slug: "acme-inc",
      requestedSlug: "acme",
    });
    client.setQueryData([...WORKSPACE_BY_SLUG_KEY, "acme-inc"], {
      slug: "acme-inc",
      requestedSlug: "acme-inc",
    });

    await refreshSlugLookups(client);

    expect(
      client.getQueryData([...WORKSPACE_BY_SLUG_KEY, "acme"]),
    ).toBeUndefined();
    expect(
      client.getQueryData([...WORKSPACE_BY_SLUG_KEY, "acme-inc"]),
    ).toBeUndefined();
  });
});
