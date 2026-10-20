import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
} from "lucide-react";

/** The icon for a file's type; the type is only a hint, so anything unknown is a plain file. */
export function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage aria-hidden="true" />;
  if (mimeType.startsWith("video/")) return <FileVideo aria-hidden="true" />;
  if (mimeType.startsWith("audio/")) return <FileAudio aria-hidden="true" />;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) {
    return <FileText aria-hidden="true" />;
  }
  if (/zip|tar|gzip|compressed|7z|rar/.test(mimeType)) {
    return <FileArchive aria-hidden="true" />;
  }
  return <File aria-hidden="true" />;
}
