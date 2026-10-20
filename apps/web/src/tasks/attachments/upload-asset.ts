import { ORPCError } from "@orpc/client";
import { ASSET_MAX_BYTES } from "@morrow/sync-schemas";
import { rpc } from "@/app/lib/orpc";
import type { UploadedAsset } from "./asset-markdown";

/** Sends the file to the signed URL with real progress, which `fetch` cannot report. */
function putFile(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload refused (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.send(file);
  });
}

/**
 * Uploads a file for a Workspace: the server signs a URL, the bytes go straight
 * to storage, and the server then checks them and says what the file is. The
 * result is a draft only the uploader can see until a saved text links to it.
 */
export async function uploadAsset(
  workspaceId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadedAsset> {
  if (file.size > ASSET_MAX_BYTES) {
    throw new ORPCError("BAD_REQUEST", { data: { code: "UPLOAD_TOO_LARGE" } });
  }
  const upload = await rpc.assets.createUpload({
    workspaceId,
    filename: file.name || "file",
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  await putFile(upload.uploadUrl, upload.headers, file, onProgress);
  return rpc.assets.finalize({ workspaceId, assetId: upload.assetId });
}
