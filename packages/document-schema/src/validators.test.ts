import { describe, expect, it } from "vite-plus/test";
import {
  attributeProblem,
  isAllowedHref,
  isAssetSource,
  isBlockId,
  type WorkspaceRefs,
} from "./validators";

const refs: WorkspaceRefs = {
  memberIds: new Set(["user1"]),
  documentIds: new Set(["page1"]),
};

describe("validators", () => {
  it("accepts only our own assets as image sources", () => {
    expect(isAssetSource("/api/asset/abc123")).toBe(true);
    expect(isAssetSource("/api/asset/abc123?w=12&h=8")).toBe(true);
    expect(isAssetSource("https://evil.example.com/pixel.png")).toBe(false);
    expect(isAssetSource("https://morrow.example.com/api/asset/abc123")).toBe(
      false,
    );
    expect(isAssetSource("//evil.example.com/api/asset/abc123")).toBe(false);
    expect(isAssetSource("/api/asset/abc123/../../x")).toBe(false);
    expect(isAssetSource("data:image/png;base64,AAAA")).toBe(false);
    expect(isAssetSource(undefined)).toBe(false);
  });

  it("accepts only http(s) and mailto links", () => {
    expect(isAllowedHref("https://example.com/a?b=c")).toBe(true);
    expect(isAllowedHref("http://example.com")).toBe(true);
    expect(isAllowedHref("mailto:a@example.com")).toBe(true);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isAllowedHref(" javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("https://example.com/\njavascript:x")).toBe(false);
    expect(isAllowedHref("data:text/html,<script>")).toBe(false);
    expect(isAllowedHref("/relative")).toBe(false);
    expect(isAllowedHref("https://")).toBe(false);
  });

  it("accepts only UUIDs as block ids", () => {
    expect(isBlockId("6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001")).toBe(true);
    expect(isBlockId("not-a-uuid")).toBe(false);
    expect(isBlockId("6f1c1f0e8f0b4a539a4e0a55b0a1c001")).toBe(false);
    expect(isBlockId("6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001<script>")).toBe(
      false,
    );
    expect(isBlockId(42)).toBe(false);
  });

  describe("attributeProblem", () => {
    it("refuses a foreign image source", () => {
      expect(
        attributeProblem(
          "assetImage",
          { src: "https://evil.test/x.png" },
          refs,
        ),
      ).not.toBeNull();
      expect(
        attributeProblem("assetImage", { src: "/api/asset/abc123" }, refs),
      ).toBeNull();
    });

    it("refuses a link that is not http(s) or mailto", () => {
      expect(
        attributeProblem("link", { href: "javascript:alert(1)" }, refs),
      ).not.toBeNull();
      expect(
        attributeProblem("link", { href: "https://example.com" }, refs),
      ).toBeNull();
    });

    it("refuses a malformed block id on any node", () => {
      expect(
        attributeProblem("paragraph", { blockId: "../../etc" }, refs),
      ).not.toBeNull();
      expect(attributeProblem("paragraph", { blockId: null }, refs)).toBeNull();
      expect(
        attributeProblem(
          "heading",
          { blockId: "6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001", level: 2 },
          refs,
        ),
      ).toBeNull();
    });

    it("refuses a mention or page link outside the Workspace", () => {
      expect(
        attributeProblem("mention", { id: "stranger" }, refs),
      ).not.toBeNull();
      expect(attributeProblem("mention", { id: "user1" }, refs)).toBeNull();
      expect(
        attributeProblem("pageLink", { docId: "elsewhere" }, refs),
      ).not.toBeNull();
      expect(attributeProblem("pageLink", { docId: "page1" }, refs)).toBeNull();
    });

    it("refuses a file card whose id is not an asset id and a bad ticket id", () => {
      expect(
        attributeProblem("attachmentCard", { id: "../x" }, refs),
      ).not.toBeNull();
      expect(
        attributeProblem("attachmentCard", { id: "def456" }, refs),
      ).toBeNull();
      expect(
        attributeProblem("ticketReference", { ticketId: "nope" }, refs),
      ).not.toBeNull();
      expect(
        attributeProblem("ticketReference", { ticketId: "MOR-12" }, refs),
      ).toBeNull();
    });
  });
});
