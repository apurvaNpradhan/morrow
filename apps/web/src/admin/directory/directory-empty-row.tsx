import type { ReactNode } from "react";
import { Button } from "@/design-system/ui/button";
import { TableCell, TableRow } from "@/design-system/ui/table";

export function DirectoryEmptyRow({
  columns,
  icon,
  title,
  description,
  clearLabel,
  onClear,
}: {
  columns: number;
  icon: ReactNode;
  title: string;
  description: string;
  clearLabel: string;
  /** Present while a search is active. */
  onClear?: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-56 text-center">
        <div className="flex flex-col items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            {icon}
          </div>
          <p className="text-sm font-medium">{title}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {description}
          </p>
          {onClear ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              {clearLabel}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
