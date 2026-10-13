import { setUserImage } from "./set-user-image";

export async function deleteAvatar(userId: string) {
  const { hadImage } = await setUserImage(userId, null);
  return { deleted: hadImage };
}
