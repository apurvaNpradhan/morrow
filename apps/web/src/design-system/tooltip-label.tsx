import { useAppHotkeys } from "@tanstack/react-hotkeys";
import { displayKeys } from "@/app/commands/display-hotkey";
import type { HotkeyId } from "@/app/commands/hotkeys";
import { KbdSequence } from "@/design-system/ui/kbd";

/**
 * The key caps of a registered hotkey, in the user's platform notation. They
 * are hidden from assistive technology, so a name stays just its label.
 */
export function HotkeyHint({ hotkeyId }: { hotkeyId: HotkeyId }) {
  const entry = useAppHotkeys()[hotkeyId];
  if (!entry.hotkey) return null;
  const { keys, separator } = displayKeys(entry.hotkey);
  return (
    <span aria-hidden="true" className="inline-flex">
      <KbdSequence keys={keys} separator={separator} />
    </span>
  );
}

/** A tooltip's content: a label, and the hotkey that runs the same thing. */
export function TooltipLabel({
  label,
  hotkeyId,
}: {
  label: string;
  hotkeyId?: HotkeyId;
}) {
  return (
    <span className="flex items-center gap-3">
      {label}
      {hotkeyId ? <HotkeyHint hotkeyId={hotkeyId} /> : null}
    </span>
  );
}

/** A registered hotkey's key caps at the end of a menu item. */
export function MenuHint({ hotkeyId }: { hotkeyId: HotkeyId }) {
  return (
    <span className="ms-auto ps-4">
      <HotkeyHint hotkeyId={hotkeyId} />
    </span>
  );
}
