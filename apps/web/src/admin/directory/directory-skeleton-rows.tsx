import { Skeleton } from "@/design-system/ui/skeleton";
import { TableCell, TableRow } from "@/design-system/ui/table";

const ROWS = ["first", "second", "third", "fourth", "fifth"];

export function DirectorySkeletonRows({ columns }: { columns: number }) {
  return ROWS.map((row) => (
    <TableRow key={row}>
      <TableCell className="ps-6 py-3" colSpan={columns}>
        <Skeleton className="h-9 w-full" />
      </TableCell>
    </TableRow>
  ));
}
