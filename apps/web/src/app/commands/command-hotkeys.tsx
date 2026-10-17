import {
  isHotkeySequence,
  useAppHotkeys,
  useHotkeys,
} from "@tanstack/react-hotkeys";
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

/** Key presses that completed a sequence; a single key must not also act on them. */
const sequenceEvents = new WeakSet<KeyboardEvent>();

/** Binds the palette toggle and every available command's hotkey. Renders nothing. */
export function CommandHotkeys({ commands: all }: { commands: Command[] }) {
  const hotkeys = useAppHotkeys();
  // Task commands show their key but are bound by the task page, which also
  // acts while a task's sheet is open.
  const commands = all.filter((command) => command.group !== "task");

  // "P C" ends on the key "C" binds alone, so both would fire on one press.
  // The library runs chords before sequences, so such a key waits a microtask
  // to see whether a sequence claimed the press.
  const hotkeyOf = (command: Command) =>
    command.hotkey ? hotkeys[command.hotkey] : null;
  const sequenceEnds = new Set<unknown>(
    commands.flatMap((command) => {
      const hotkey = hotkeyOf(command)?.hotkey;
      return hotkey && isHotkeySequence(hotkey) ? [hotkey.at(-1)] : [];
    }),
  );
  const bindings = commands.flatMap((command) => {
    const hotkey = hotkeyOf(command);
    if (!hotkey) return [];
    const run = unlessModal(command.run);
    if (hotkey.hotkey && isHotkeySequence(hotkey.hotkey)) {
      return [
        {
          hotkey,
          callback: (event: KeyboardEvent) => {
            sequenceEvents.add(event);
            run();
          },
        },
      ];
    }
    if (!sequenceEnds.has(hotkey.hotkey)) {
      return [{ hotkey, callback: run }];
    }
    return [
      {
        hotkey,
        callback: (event: KeyboardEvent) =>
          queueMicrotask(() => {
            if (!sequenceEvents.has(event)) run();
          }),
      },
    ];
  });

  useHotkeys([
    {
      hotkey: hotkeys.palette,
      callback: unlessModal(() => toggleOverlay("palette")),
    },
    ...bindings,
  ]);

  return null;
}
