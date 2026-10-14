import { savePublicImage } from "#api/storage/index";
import { setProjectBackground } from "./set-project-background";

/** Stores a new background under a fresh key and makes it the project's image. */
export async function saveProjectBackground(
  workspaceId: string,
  projectId: string,
  file: Blob,
) {
  let txid = 0;
  const saved = await savePublicImage({
    folder: "project-backgrounds",
    ownerId: projectId,
    file,
    apply: async (url) => {
      ({ txid } = await setProjectBackground(workspaceId, projectId, url));
    },
  });
  return { ...saved, txid };
}
