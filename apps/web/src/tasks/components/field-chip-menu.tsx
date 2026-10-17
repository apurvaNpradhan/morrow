import type { ReactNode } from "react";
import { cn } from "@/design-system/cn";
import { Menu, MenuPopup, MenuTrigger } from "@/design-system/ui/menu";

/** A chip that opens a menu of choices for one field, in the create dialog and the sheet. */
export function FieldChipMenu({
  label,
  icon,
  value,
  disabled = false,
  sheetField,
  muted = false,
  children,
}: {
  /** What the field is called, for assistive technology. */
  label: string;
  icon: ReactNode;
  /** The current choice, in words. */
  value: ReactNode;
  disabled?: boolean;
  /** Names the chip in the sheet, so a keyboard shortcut can open it. */
  sheetField?: string;
  /** Nothing is chosen yet: the value reads as a prompt. */
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        aria-label={label}
        data-sheet-field={sheetField}
        className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border bg-control px-2 text-xs outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64",
          // In a wide task view the chip is a plain row of the properties rail.
          "@min-[720px]:h-8 @min-[720px]:w-full @min-[720px]:justify-start @min-[720px]:border-transparent @min-[720px]:bg-transparent @min-[720px]:text-sm @min-[720px]:hover:bg-accent",
          muted && "text-muted-foreground",
        )}
      >
        {icon}
        <span className="max-w-40 truncate">{value}</span>
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-48">
        {children}
      </MenuPopup>
    </Menu>
  );
}
