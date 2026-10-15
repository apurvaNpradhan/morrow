import { describe, expect, it } from "vite-plus/test";
import { taskAsMarkdown } from "./task-markdown";

describe("taskAsMarkdown", () => {
  it("puts the ticket and title first, then the link and the description", () => {
    expect(
      taskAsMarkdown({
        ticket: "MOR-12",
        title: "Write docs",
        url: "https://morrow.test/acme/tasks/MOR-12",
        description: "- [ ] outline\n",
      }),
    ).toBe(
      "# MOR-12: Write docs\n\nhttps://morrow.test/acme/tasks/MOR-12\n\n- [ ] outline\n",
    );
  });

  it("leaves out an empty description", () => {
    expect(
      taskAsMarkdown({
        ticket: "MOR-1",
        title: "T",
        url: "https://x.test/a",
        description: "  ",
      }),
    ).toBe("# MOR-1: T\n\nhttps://x.test/a\n");
  });
});
