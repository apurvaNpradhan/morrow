import { useAppHotkeys, useHotkeys } from "@tanstack/react-hotkeys";
import { toggleOverlay } from "./overlay-store";
import type { Command } from "./use-commands";

/** Binds the palette toggle and every available command's hotkey. Renders nothing. */
export function CommandHotkeys({ commands }: { commands: Command[] }) {
  const hotkeys = useAppHotkeys();

  useHotkeys([
    { hotkey: hotkeys.palette, callback: () => toggleOverlay("palette") },
    ...commands.flatMap((command) =>
      command.hotkey
        ? [{ hotkey: hotkeys[command.hotkey], callback: command.run }]
        : [],
    ),
  ]);

  return null;
}
