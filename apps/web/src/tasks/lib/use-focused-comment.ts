import { useSearch } from "@tanstack/react-router";
import { type RefObject, useEffect, useState } from "react";

/** How long a comment asked for by address stays marked. */
export const FLASH_MS = 2000;

/**
 * The comment the address asks to show (`?comment=`): once it is in the list
 * under `listRef`, scrolls to it and returns its id for `FLASH_MS`, so the row
 * can be marked. Undefined the rest of the time.
 */
export function useFocusedComment(
  listRef: RefObject<HTMLElement | null>,
  commentIds: readonly string[],
): string | undefined {
  const { comment } = useSearch({ strict: false }) as { comment?: unknown };
  const focusedId = typeof comment === "string" ? comment : undefined;
  const present = focusedId !== undefined && commentIds.includes(focusedId);
  const [flashId, setFlashId] = useState<string>();

  useEffect(() => {
    if (!focusedId || !present) return;
    const element = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-comment-id]") ?? [],
    ).find((candidate) => candidate.dataset.commentId === focusedId);
    element?.scrollIntoView?.({ block: "center" });
    setFlashId(focusedId);
    const timer = setTimeout(() => setFlashId(undefined), FLASH_MS);
    return () => clearTimeout(timer);
  }, [focusedId, present, listRef]);

  return flashId;
}
