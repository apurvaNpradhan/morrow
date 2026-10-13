import { savePublicImage } from "#api/storage/index";
import { setWorkspaceLogo } from "./set-workspace-logo";

/** Stores a new logo under a fresh key and makes it the workspace's image. */
export function saveWorkspaceLogo(workspaceId: string, file: Blob) {
  return savePublicImage({
    folder: "workspace-logos",
    ownerId: workspaceId,
    file,
    apply: (url) => setWorkspaceLogo(workspaceId, url),
  });
}
