import { rpc } from "@/app/lib/orpc";
import { projectCollection } from "../collections/project-collection";

/** Uploads a background image and waits for the project to show it. */
export async function uploadProjectBackground(input: {
  workspaceId: string;
  projectId: string;
  file: File;
}) {
  const { txid } = await rpc.projects.uploadBackground(input);
  await projectCollection.utils.awaitTxId(txid);
}

export async function removeProjectBackground(input: {
  workspaceId: string;
  projectId: string;
}) {
  const { txid } = await rpc.projects.removeBackground(input);
  await projectCollection.utils.awaitTxId(txid);
}
