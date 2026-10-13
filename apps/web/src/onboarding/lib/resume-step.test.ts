import { describe, expect, it } from "vite-plus/test";
import { getResumeStep } from "./resume-step";

describe("getResumeStep", () => {
  it("starts at You without a name or workspace", () => {
    expect(
      getResumeStep({
        hasName: false,
        hasWorkspace: false,
        ownsWorkspace: false,
      }),
    ).toBe("you");
  });

  it("moves to Workspace once the name is set", () => {
    expect(
      getResumeStep({
        hasName: true,
        hasWorkspace: false,
        ownsWorkspace: false,
      }),
    ).toBe("workspace");
  });

  it("asks only for the name of someone who joined through an invitation", () => {
    expect(
      getResumeStep({
        hasName: false,
        hasWorkspace: true,
        ownsWorkspace: false,
      }),
    ).toBe("you");
  });

  it("offers the invite step to someone who created a workspace", () => {
    expect(
      getResumeStep({ hasName: true, hasWorkspace: true, ownsWorkspace: true }),
    ).toBe("invite");
  });

  it("only needs completing for a named member of an invited workspace", () => {
    expect(
      getResumeStep({
        hasName: true,
        hasWorkspace: true,
        ownsWorkspace: false,
      }),
    ).toBe("complete");
  });
});
