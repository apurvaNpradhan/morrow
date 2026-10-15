import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { isOverlayOpen, toggleOverlay } from "./overlay-store";
import type { Command } from "./use-commands";

/**
 * Any modal dialog other than the palette and the shortcuts help owns the
 * keyboard: a key pressed on its buttons must not open or navigate behind it.
 */
function modalOwnsKeyboard() {
  if (isOverlayOpen("palette") || isOverlayOpen("help")) return false;
  return (
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
}

function unlessModal(run: () => void) {
  return () => {
    if (!modalOwnsKeyboard()) run();
  };
}

/** Binds the palette toggle and every available command's hotkey. Renders nothing. */
export function CommandHotkeys({ commands }: { commands: Command[] }) {
  const hotkeys = useAppHotkeys();

  useHotkeys([
    {
      hotkey: hotkeys.palette,
      callback: unlessModal(() => toggleOverlay("palette")),
    },
    ...commands.flatMap((command) =>
      command.hotkey
        ? [
            {
              hotkey: hotkeys[command.hotkey],
              callback: unlessModal(command.run),
            },
          ]
        : [],
    ),
  ]);

  return null;
}
