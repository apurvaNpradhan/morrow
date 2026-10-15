"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";

import { cn } from "@/design-system/cn";

const ContextMenu = ContextMenuPrimitive.Root;

function ContextMenuTrigger({
  className,
  ...props
}: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger
      className={className}
      data-slot="context-menu-trigger"
      {...props}
    />
  );
}

/**
 * The popup of a right-click menu, styled like `MenuPopup`. Its items, radio
 * groups and submenus are the ones from `menu.tsx`: they are the same parts.
 */
function ContextMenuPopup({
  children,
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="z-50"
        data-slot="context-menu-positioner"
      >
        <ContextMenuPrimitive.Popup
          className={cn(
            "relative flex min-w-44 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-overlay outline-none transition-[scale,opacity] duration-150 ease-out data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 focus:outline-none",
            className,
          )}
          data-slot="context-menu-popup"
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

export { ContextMenu, ContextMenuPopup, ContextMenuTrigger };
