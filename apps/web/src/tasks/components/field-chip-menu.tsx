import type { ReactNode } from "react";
import { Menu, MenuPopup, MenuTrigger } from "@/design-system/ui/menu";

/** A chip that opens a menu of choices for one field, in the create dialog and the sheet. */
export function FieldChipMenu({
  label,
  icon,
  value,
  disabled = false,
  sheetField,
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
  children: ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        aria-label={label}
        data-sheet-field={sheetField}
        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border bg-accent/60 px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64"
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
