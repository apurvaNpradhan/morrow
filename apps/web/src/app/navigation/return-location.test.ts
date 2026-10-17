import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  getReturnLocation,
  recordLocation,
  setReturnLocation,
  usableReturnLocation,
} from "./return-location";

const board = { pathname: "/acme/projects/MOR/board", search: "?status=open" };

beforeEach(() => setReturnLocation(null));

describe("recordLocation", () => {
  it("keeps the page before Settings, skipping every Settings page", () => {
    recordLocation(board);
    recordLocation({ pathname: "/acme/settings/workspace", search: "" });
    recordLocation({ pathname: "/acme/settings/projects/MOR", search: "" });
    expect(getReturnLocation()).toEqual(board);
  });

  it("leaves an open sheet out of the place", () => {
    recordLocation({
      pathname: "/acme/projects/MOR/board",
      search: "?task=12&view=x",
    });
    expect(getReturnLocation()?.search).toBe("?view=x");
  });

  it("skips a full-page task", () => {
    recordLocation(board);
    recordLocation({ pathname: "/acme/tasks/MOR-12", search: "" });
    expect(getReturnLocation()).toEqual(board);
  });
});

describe("usableReturnLocation", () => {
  const keys = new Set(["MOR"]);

  it("uses a stored location of this workspace", () => {
    expect(usableReturnLocation(board, "acme", keys)).toEqual(board);
  });

  it("falls back when nothing is stored", () => {
    expect(usableReturnLocation(null, "acme", keys)).toBeNull();
  });

  it("falls back after a workspace slug rename", () => {
    expect(usableReturnLocation(board, "acme-2", keys)).toBeNull();
  });

  it("falls back when the project is gone", () => {
    expect(usableReturnLocation(board, "acme", new Set())).toBeNull();
  });

  it("keeps pages that are not project pages", () => {
    const members = { pathname: "/acme/members", search: "" };
    expect(usableReturnLocation(members, "acme", new Set())).toEqual(members);
  });
});
