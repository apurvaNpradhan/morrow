import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  OWNER_STAMP_KEY,
  readOwnerStamp,
  removeOwnerStamp,
  writeOwnerStamp,
} from "./owner-stamp";

afterEach(() => localStorage.clear());

describe("owner stamp", () => {
  it("is empty until written", () => {
    expect(readOwnerStamp()).toBeNull();
  });

  it("round-trips the user part of a session", () => {
    writeOwnerStamp({ id: "u1", name: "Ada", email: "ada@example.com" });
    expect(readOwnerStamp()).toEqual({
      userId: "u1",
      user: { id: "u1", name: "Ada", email: "ada@example.com" },
    });
  });

  it("reads damaged storage as no stamp", () => {
    localStorage.setItem(OWNER_STAMP_KEY, "{not json");
    expect(readOwnerStamp()).toBeNull();
    localStorage.setItem(OWNER_STAMP_KEY, JSON.stringify({ userId: 1 }));
    expect(readOwnerStamp()).toBeNull();
  });

  it("is gone once removed", () => {
    writeOwnerStamp({ id: "u1" });
    removeOwnerStamp();
    expect(readOwnerStamp()).toBeNull();
  });
});
