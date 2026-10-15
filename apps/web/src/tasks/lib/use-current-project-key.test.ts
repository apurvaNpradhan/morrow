import { describe, expect, it } from "vite-plus/test";
import { projectKeyOfPath } from "./use-current-project-key";

describe("projectKeyOfPath", () => {
  it("reads the key of a Project's board, list and settings-free pages", () => {
    expect(projectKeyOfPath("/acme/projects/mor/board")).toBe("MOR");
    expect(projectKeyOfPath("/acme/projects/MOR/list")).toBe("MOR");
    expect(projectKeyOfPath("/acme/projects/MOR")).toBe("MOR");
  });

  it("reads the key of a ticket id", () => {
    expect(projectKeyOfPath("/acme/tasks/WEB-12")).toBe("WEB");
    expect(projectKeyOfPath("/acme/tasks/nonsense")).toBeUndefined();
  });

  it("is undefined elsewhere", () => {
    expect(projectKeyOfPath("/acme")).toBeUndefined();
    expect(projectKeyOfPath("/acme/projects")).toBeUndefined();
    expect(projectKeyOfPath("/acme/members")).toBeUndefined();
  });
});
