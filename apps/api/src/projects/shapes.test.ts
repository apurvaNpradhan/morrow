import { projectsShape } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";

describe("projects shape", () => {
  // A task create bumps these two columns; sending them would give the
  // Project a new identity and re-render every task on its page.
  it("leaves out the columns a task create changes", () => {
    const columns = Object.keys(projectsShape.schema.shape);
    expect(columns).not.toContain("lastTaskNumber");
    expect(columns).not.toContain("updatedAt");
  });
});
