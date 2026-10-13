import { ORPCError } from "@orpc/client";
import { expect, it } from "vite-plus/test";
import { avatarErrorKey } from "./avatar-error-key";
import { AvatarImageError } from "./prepare-avatar-image";

const fallback = "settings:informationPage.avatar.updateError";

it("explains why a picked picture was refused", () => {
  expect(avatarErrorKey(new AvatarImageError("not-image"), fallback)).toBe(
    "settings:informationPage.avatar.notImage",
  );
});

it("uses the API's domain code for a refused upload", () => {
  const error = new ORPCError("BAD_REQUEST", {
    data: { code: "IMAGE_TOO_LARGE" },
  });
  expect(avatarErrorKey(error, fallback)).toBe("common:errors.imageTooLarge");
});

it("falls back for anything else, never showing its message", () => {
  expect(avatarErrorKey(new Error("secret detail"), fallback)).toBe(fallback);
});
