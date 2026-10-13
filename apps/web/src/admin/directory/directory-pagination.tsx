import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/design-system/ui/button";

export function DirectoryPagination({
  page,
  pageCount,
  busy,
  summary,
  previousLabel,
  nextLabel,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  busy: boolean;
  summary: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground tabular-nums">{summary}</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0 || busy}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount || busy}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
