import { isPreviewable } from "@morrow/sync-schemas";
import { Download } from "lucide-react";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  VideoPlayer,
  VideoPlayerContent,
  VideoPlayerControlBar,
  VideoPlayerMuteButton,
  VideoPlayerPlayButton,
  VideoPlayerTimeDisplay,
  VideoPlayerTimeRange,
} from "@/design-system/ui/video-player";
import { assetPath } from "@morrow/document-schema";
import { AttachmentCard } from "@morrow/document-schema";
import { FilePreview } from "./file-preview";
import { FileTypeIcon } from "./file-type-icon";
import { formatBytes } from "./format-bytes";

/**
 * A file in the text. A video plays inline. Any other file is a card: type icon,
 * name and size. Clicking a card previews what a browser can show (PDF, text,
 * audio) in a frame and does nothing for the rest; only the download button
 * downloads. The look is the `.morrow-attachment-*` rules in `index.css`.
 */
export function AttachmentCardView({ node }: NodeViewProps) {
  const { id, filename, mimeType, size } = node.attrs as {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  };
  const url = assetPath(id);
  const previewable = isPreviewable(mimeType);
  const [previewing, setPreviewing] = useState(false);

  if (mimeType.startsWith("video/")) {
    return (
      <NodeViewWrapper
        className="morrow-attachment-node morrow-attachment-video"
        data-type="attachment-card"
        contentEditable={false}
      >
        <VideoPlayer className="max-w-full overflow-hidden rounded-lg border">
          <VideoPlayerContent slot="media" src={url} preload="metadata" />
          <VideoPlayerControlBar>
            <VideoPlayerPlayButton />
            <VideoPlayerTimeRange />
            <VideoPlayerTimeDisplay showDuration />
            <VideoPlayerMuteButton />
          </VideoPlayerControlBar>
        </VideoPlayer>
        <DownloadButton name={filename} url={url} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="morrow-attachment-node"
      data-type="attachment-card"
      contentEditable={false}
    >
      <button
        type="button"
        className="morrow-attachment-card"
        // Only a file that can be previewed reacts to a click.
        style={previewable ? undefined : { cursor: "default" }}
        onClick={previewable ? () => setPreviewing(true) : undefined}
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
      <DownloadButton name={filename} url={url} />
      {previewable ? (
        <FilePreview
          file={previewing ? { id, filename } : null}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

function DownloadButton({ name, url }: { name: string; url: string }) {
  const { t } = useTranslation("tasks");
  return (
    <button
      type="button"
      aria-label={t("attachments.download", { name })}
      className="morrow-attachment-download"
      onClick={() => download(`${url}?download=1`)}
    >
      <Download aria-hidden="true" />
    </button>
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
