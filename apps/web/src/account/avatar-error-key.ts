import { errorMessageKey } from "@/app/lib/orpc-error";
import { ORPCError } from "@orpc/client";
import { AvatarImageError } from "./prepare-avatar-image";

const IMAGE_KEYS = {
  "not-image": "settings:informationPage.avatar.notImage",
  "source-too-large": "settings:informationPage.avatar.sourceTooLarge",
  unreadable: "settings:informationPage.avatar.unreadable",
} as const;

/** The i18n key for a failed avatar change; the error's own message is never shown. */
export function avatarErrorKey(error: unknown, fallbackKey: string): string {
  if (error instanceof AvatarImageError) return IMAGE_KEYS[error.reason];
  return error instanceof ORPCError ? errorMessageKey(error) : fallbackKey;
}
