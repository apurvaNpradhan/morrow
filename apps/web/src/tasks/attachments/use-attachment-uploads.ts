import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import type { UploadHandlers } from "./attachment-uploads";
import { uploadAsset } from "./upload-asset";

/**
 * How an editor uploads for a Workspace, and how it tells the user a file
 * failed. Without a Workspace there is nothing to upload to. The handlers
 * change only with the Workspace, so an editor that holds them is not reset by
 * a re-render; the text is translated when it is needed.
 */
export function useAttachmentUploads(
  workspaceId: string | undefined,
): UploadHandlers | null {
  const { t } = useTranslation("tasks");
  const translate = useRef(t);
  useEffect(() => {
    translate.current = t;
  });
  return useMemo(
    () =>
      workspaceId
        ? {
            upload: (file, onProgress) =>
              uploadAsset(workspaceId, file, onProgress),
            onError: (file, error) =>
              toast.error(
                errorMessage(
                  translate.current,
                  error,
                  translate.current("attachments.uploadFailed", {
                    name: file.name,
                  }),
                ),
              ),
            label: (name) =>
              translate.current("attachments.uploading", { name }),
          }
        : null,
    [workspaceId],
  );
}
