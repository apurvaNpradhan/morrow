import { Download, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { assetPath } from "./asset-markdown";

/**
 * A file shown in a frame, using the browser's own viewer: PDF, plain text,
 * video and audio. The file comes from the storage service's origin, not the
 * app's, and only types that cannot run script are ever served inline (see
 * `isInlineViewable`), so the frame needs no sandbox, which would also stop
 * the PDF viewer.
 */
export function FilePreview({
  file,
  onClose,
}: {
  file: { id: string; filename: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="h-[88vh] w-full max-w-5xl"
      >
        {file ? (
          <>
            <DialogHeader className="flex-row items-center gap-2 py-3 pe-14">
              <DialogTitle className="min-w-0 flex-1 truncate text-base">
                {file.filename}
              </DialogTitle>
              <Button
                size="xs"
                variant="outline"
                render={
                  <a
                    href={assetPath(file.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink aria-hidden="true" />
                {t("attachments.openInTab")}
              </Button>
              <Button
                size="xs"
                variant="outline"
                render={
                  <a
                    href={`${assetPath(file.id)}?download=1`}
                    download={file.filename}
                  />
                }
              >
                <Download aria-hidden="true" />
                {t("attachments.downloadFile")}
              </Button>
            </DialogHeader>
            <iframe
              src={assetPath(file.id)}
              title={file.filename}
              className="min-h-0 w-full flex-1 rounded-b-2xl border-t bg-background"
            />
          </>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
