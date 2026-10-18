import type { Segment } from "../lib/highlight";

/** Text with its matching segments emphasised. */
export function Highlighted({ segments }: { segments: Segment[] }) {
  let offset = 0;
  return segments.map((segment) => {
    const key = offset;
    offset += segment.text.length;
    return segment.match ? (
      <mark key={key} className="rounded-xs bg-primary/15 text-foreground">
        {segment.text}
      </mark>
    ) : (
      <span key={key}>{segment.text}</span>
    );
  });
}
