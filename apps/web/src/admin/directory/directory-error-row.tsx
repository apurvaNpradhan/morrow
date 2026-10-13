import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/design-system/ui/button";
import { TableCell, TableRow } from "@/design-system/ui/table";

export function DirectoryErrorRow({
  columns,
  message,
  retryLabel,
  onRetry,
}: {
  columns: number;
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-56 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon aria-hidden="true" />
            {retryLabel}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
