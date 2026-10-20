import { isInlineViewable } from "@morrow/sync-schemas";
import { Download } from "lucide-react";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { assetPath } from "./asset-markdown";
import { AttachmentCard } from "./attachment-card";
import { FileTypeIcon } from "./file-type-icon";
import { formatBytes } from "./format-bytes";

/**
 * A file card: type icon, name and size. The card opens the file (in a new tab
 * when a browser can show it, otherwise the download starts); the button always
 * downloads. The look is the `.morrow-attachment-*` rules in `index.css`.
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
  const viewable = isInlineViewable(mimeType);

  return (
    <NodeViewWrapper
      className="morrow-attachment-node"
      data-type="attachment-card"
      contentEditable={false}
    >
      <button
        type="button"
        className="morrow-attachment-card"
        onClick={() => openAsset(url, viewable)}
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
        onClick={() => openAsset(`${url}?download=1`, false)}
      >
        <Download aria-hidden="true" />
      </button>
    </NodeViewWrapper>
  );
}

/**
 * Opens or downloads a file. The cards are buttons, not links: the editor's link
 * extension also opens any link that is clicked, so a link here would act twice.
 */
function openAsset(url: string, inNewTab: boolean) {
  if (inNewTab) window.open(url, "_blank", "noopener,noreferrer");
  else window.location.assign(url);
}

/** The card node as the editor shows it. */
export const AttachmentCardWithView = AttachmentCard.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
  },
});
