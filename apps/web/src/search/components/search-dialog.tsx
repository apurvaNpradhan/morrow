import { Suspense } from "react";
import { closeOverlay, useIsOverlayOpen } from "@/app/commands";
import { CommandDialog, CommandDialogPopup } from "@/design-system/ui/command";
import { useActiveWorkspace } from "@/workspace";
import { SearchContent } from "./search-content";

/** The search dialog: always mounted, shown while the "search" overlay is open. */
export function SearchDialog() {
  const open = useIsOverlayOpen("search");
  const { data: workspace } = useActiveWorkspace();

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeOverlay("search");
      }}
    >
      <CommandDialogPopup instant>
        {workspace ? (
          <Suspense fallback={null}>
            <SearchContent workspace={workspace} />
          </Suspense>
        ) : null}
      </CommandDialogPopup>
    </CommandDialog>
  );
}
