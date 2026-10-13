import { savePublicImage } from "#api/storage/index";
import { setUserImage } from "./set-user-image";

/** Stores a new avatar under a fresh key and makes it the user's picture. */
export function saveAvatar(userId: string, file: Blob) {
  return savePublicImage({
    folder: "avatars",
    ownerId: userId,
    file,
    apply: (url) => setUserImage(userId, url),
  });
}
