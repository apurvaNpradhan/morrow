import { ORPCError } from "@orpc/client";
import { expect, it } from "vite-plus/test";
import { errorMessageKey } from "./orpc-error";

it("maps typed API errors to translation keys", () => {
  expect(errorMessageKey(new ORPCError("FORBIDDEN"))).toBe(
    "common:errors.forbidden",
  );
  expect(errorMessageKey(new ORPCError("NOT_FOUND"))).toBe(
    "common:errors.notFound",
  );
});

it("falls back to a generic message for anything else", () => {
  expect(errorMessageKey(new ORPCError("TEAPOT"))).toBe(
    "common:errors.unknown",
  );
  expect(errorMessageKey(new Error("boom"))).toBe("common:errors.unknown");
});

it("prefers the stable domain code over the generic one", () => {
  const tooLarge = new ORPCError("BAD_REQUEST", {
    data: { code: "IMAGE_TOO_LARGE" },
  });
  expect(errorMessageKey(tooLarge)).toBe("common:errors.imageTooLarge");
});

it("ignores a domain code it does not know and keeps the generic key", () => {
  const unknown = new ORPCError("BAD_REQUEST", { data: { code: "NEW_CODE" } });
  expect(errorMessageKey(unknown)).toBe("common:errors.badRequest");
});
