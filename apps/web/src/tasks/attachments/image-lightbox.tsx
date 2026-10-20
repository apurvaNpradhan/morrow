import { useTranslation } from "react-i18next";
import { Dialog, DialogPopup, DialogTitle } from "@/design-system/ui/dialog";
import { assetPath } from "./asset-markdown";
import { assetIdOf } from "./asset-markdown";

/** An uploaded image at its natural size, capped to the window, with a link to the original. */
export function ImageLightbox({
  image,
  onClose,
}: {
  image: { src: string; alt: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("tasks");
  const id = image && assetIdOf(image.src);
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="w-auto max-w-[min(96vw,1400px)] items-center gap-2 border-0 bg-transparent p-0 shadow-none before:hidden"
      >
        <DialogTitle className="sr-only">
          {t("attachments.imagePreview")}
        </DialogTitle>
        {image ? (
          <>
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            {id ? (
              <a
                href={assetPath(id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white underline underline-offset-2"
              >
                {t("attachments.openOriginal")}
              </a>
            ) : null}
          </>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
