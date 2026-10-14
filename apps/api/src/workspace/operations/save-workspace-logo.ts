import { savePublicImage } from "#api/storage/index";
import { setWorkspaceLogo } from "./set-workspace-logo";

/** Stores a new logo under a fresh key and makes it the workspace's image. */
export async function saveWorkspaceLogo(workspaceId: string, file: Blob) {
  let txid: number | null = null;
  const saved = await savePublicImage({
    folder: "workspace-logos",
    ownerId: workspaceId,
    file,
    apply: async (url) => {
      ({ txid } = await setWorkspaceLogo(workspaceId, url));
    },
  });
  return { ...saved, txid };
}
