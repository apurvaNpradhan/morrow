import { isPreviewable } from "@morrow/sync-schemas";
import { Download } from "lucide-react";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { assetPath } from "./asset-markdown";
import { AttachmentCard } from "./attachment-card";
import { FilePreview } from "./file-preview";
import { FileTypeIcon } from "./file-type-icon";
import { formatBytes } from "./format-bytes";

/**
 * A file card: type icon, name and size. A file a browser can show (PDF, text,
 * video, audio) previews in a frame; any other starts its download. The button
 * always downloads. The look is the `.morrow-attachment-*` rules in `index.css`.
 */
export function AttachmentCardView({ node }: NodeViewProps) {
  const { t } = useTranslation("tasks");
  const { id, filename, mimeType, size } = node.attrs as {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  };
  const url = assetPath(id);
  const previewable = isPreviewable(mimeType);
  const [previewing, setPreviewing] = useState(false);

  return (
    <NodeViewWrapper
      className="morrow-attachment-node"
      data-type="attachment-card"
      contentEditable={false}
    >
      <button
        type="button"
        className="morrow-attachment-card"
        onClick={() =>
          previewable ? setPreviewing(true) : download(`${url}?download=1`)
        }
      >
        <span className="morrow-attachment-card-icon">
          <FileTypeIcon mimeType={mimeType} />
        </span>
        <span className="morrow-attachment-card-content">
          <span className="morrow-attachment-card-title">{filename}</span>
          <span className="morrow-attachment-card-meta">
            {formatBytes(size)}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={t("attachments.download", { name: filename })}
        className="morrow-attachment-download"
        onClick={() => download(`${url}?download=1`)}
      >
        <Download aria-hidden="true" />
      </button>
      {previewable ? (
        <FilePreview
          file={previewing ? { id, filename } : null}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

/**
 * Starts a download. The cards are buttons, not links: the editor's link
 * extension also opens any link that is clicked, so a link here would act twice.
 */
function download(url: string) {
  window.location.assign(url);
}

/** The card node as the editor shows it. */
export const AttachmentCardWithView = AttachmentCard.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
  },
});
