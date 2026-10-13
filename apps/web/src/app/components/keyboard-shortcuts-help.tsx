import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { KbdSequence } from "@/design-system/ui/kbd";
import { shortcuts } from "@/app/lib/shortcuts";

type ShortcutItem = {
  keys: string[];
  description: string;
  icon?: React.ReactNode;
};

type ShortcutCategory = {
  title: string;
  shortcuts: ShortcutItem[];
};

function useShortcutCategories(): ShortcutCategory[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      {
        title: t("navigation:keyboardShortcuts.categories.general"),
        shortcuts: [
          {
            keys: [shortcuts.palette.prefix, shortcuts.palette.open],
            description: t(
              "navigation:keyboardShortcuts.items.openCommandPalette",
            ),
          },
          {
            keys: [shortcuts.sidebar.prefix, shortcuts.sidebar.toggle],
            description: t("navigation:keyboardShortcuts.items.toggleSidebar"),
          },
          {
            keys: ["?"],
            description: t("navigation:keyboardShortcuts.items.showShortcuts"),
          },
          {
            keys: ["Escape"],
            description: t("navigation:keyboardShortcuts.items.closeModal"),
          },
        ],
      },
      {
        title: t("navigation:keyboardShortcuts.categories.create"),
        shortcuts: [
          {
            keys: [shortcuts.workspace.prefix, shortcuts.workspace.create],
            description: t(
              "navigation:keyboardShortcuts.items.createWorkspace",
            ),
          },
        ],
      },
    ],
    [t],
  );
}

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const shortcutCategories = useShortcutCategories();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCategories = shortcutCategories
    .map((category) => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        (shortcut) =>
          shortcut.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          shortcut.keys.some((key) =>
            key.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      ),
    }))
    .filter((category) => category.shortcuts.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={`${category.title}-${shortcut.description}-${shortcut.keys.join("+")}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <span className="text-xs">{shortcut.description}</span>
                      <KbdSequence keys={shortcut.keys} />
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
