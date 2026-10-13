import { describe, expect, it } from "vite-plus/test";
import {
  getSlugFieldStatus,
  isSlugUsable,
  slugAfterEdit,
  slugAfterNameChange,
} from "./slug-field-state";

describe("slug following the name", () => {
  it("follows the name until edited by hand", () => {
    let value = slugAfterNameChange({ slug: "", edited: false }, "My Team");
    expect(value).toEqual({ slug: "my-team", edited: false });
    value = slugAfterEdit("custom");
    expect(slugAfterNameChange(value, "Another Name")).toEqual({
      slug: "custom",
      edited: true,
    });
  });

  it("follows the name again after the slug is cleared", () => {
    const cleared = slugAfterEdit("");
    expect(slugAfterNameChange(cleared, "Team Two").slug).toBe("team-two");
  });

  it("lowercases what is typed", () => {
    expect(slugAfterEdit("MyTeam").slug).toBe("myteam");
  });
});

describe("getSlugFieldStatus", () => {
  const free = { available: true } as const;

  it("is idle for an empty slug", () => {
    expect(
      getSlugFieldStatus({
        slug: "",
        checkedSlug: undefined,
        result: undefined,
      }),
    ).toBe("idle");
  });

  it("reports format and reserved problems without waiting for the API", () => {
    expect(
      getSlugFieldStatus({
        slug: "a",
        checkedSlug: undefined,
        result: undefined,
      }),
    ).toBe("invalid");
    expect(
      getSlugFieldStatus({
        slug: "admin",
        checkedSlug: undefined,
        result: undefined,
      }),
    ).toBe("reserved");
  });

  it("is checking until the answer is for the current slug", () => {
    expect(
      getSlugFieldStatus({
        slug: "my-team",
        checkedSlug: undefined,
        result: undefined,
      }),
    ).toBe("checking");
    expect(
      getSlugFieldStatus({
        slug: "my-team",
        checkedSlug: "my-tea",
        result: free,
      }),
    ).toBe("checking");
  });

  it("reflects the API answer", () => {
    expect(
      getSlugFieldStatus({
        slug: "my-team",
        checkedSlug: "my-team",
        result: free,
      }),
    ).toBe("available");
    expect(
      getSlugFieldStatus({
        slug: "my-team",
        checkedSlug: "my-team",
        result: { available: false, reason: "taken" },
      }),
    ).toBe("taken");
  });

  it("only allows continuing with an available slug", () => {
    expect(isSlugUsable("available")).toBe(true);
    for (const status of [
      "idle",
      "checking",
      "taken",
      "reserved",
      "invalid",
    ] as const)
      expect(isSlugUsable(status)).toBe(false);
  });
});
