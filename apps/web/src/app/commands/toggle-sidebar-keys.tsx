import { KbdSequence } from "@/design-system/ui/kbd";
import { displayKeys } from "./display-hotkey";
import { appHotkeys } from "./hotkeys";

export function ToggleSidebarKeys() {
  const { keys, separator } = displayKeys(
    appHotkeys.toggleSidebar.defaultHotkey,
  );
  return <KbdSequence keys={keys} separator={separator} />;
}
