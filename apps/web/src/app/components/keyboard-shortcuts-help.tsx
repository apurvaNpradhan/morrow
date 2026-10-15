import { useAppHotkeyList } from "@tanstack/react-hotkeys";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { closeOverlay, displayKeys, useIsOverlayOpen } from "@/app/commands";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { KbdSequence } from "@/design-system/ui/kbd";

const GROUP_ORDER = ["general", "navigate", "create", "view"] as const;

function useShortcutCategories(searchQuery: string) {
  const { t } = useTranslation();
  const items = useAppHotkeyList();
  const query = searchQuery.toLowerCase();

  return GROUP_ORDER.flatMap((group) => {
    const shortcuts = items.flatMap(({ appHotkey }) => {
      if (!appHotkey.hotkey || appHotkey.meta?.group !== group) return [];
      const description = t(`navigation:commands.${appHotkey.id}`);
      const displayed = displayKeys(appHotkey.hotkey);
      const matches =
        description.toLowerCase().includes(query) ||
        displayed.keys.some((key) => key.toLowerCase().includes(query));
      return matches ? [{ id: appHotkey.id, description, ...displayed }] : [];
    });
    return shortcuts.length > 0
      ? [
          {
            group,
            title: t(`navigation:commandPalette.groups.${group}`),
            shortcuts,
          },
        ]
      : [];
  });
}

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const open = useIsOverlayOpen("help");
  const [searchQuery, setSearchQuery] = useState("");
  const filteredCategories = useShortcutCategories(searchQuery);

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOverlay("help");
      }}
    >
      <DialogContent className="px-4 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("navigation:keyboardShortcuts.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:keyboardShortcuts.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder={t("navigation:keyboardShortcuts.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />

        <div className="overflow-y-auto flex-1">
          <div className="space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.group}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <span className="text-xs">{shortcut.description}</span>
                      <KbdSequence
                        keys={shortcut.keys}
                        separator={shortcut.separator}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground mb-4">
          <Trans
            i18nKey="navigation:keyboardShortcuts.footer"
            components={{
              kbd: <kbd className="px-1.5 py-0.5 rounded bg-muted" />,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
