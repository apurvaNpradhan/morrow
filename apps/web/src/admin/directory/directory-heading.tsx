import { RefreshCwIcon, SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/design-system/ui/input-group";

export function DirectoryHeading({
  title,
  count,
  refreshing,
  refreshingLabel,
  search,
  onSearchChange,
  searchMaxLength,
  searchPlaceholder,
  searchLabel,
}: {
  title: string;
  count: string;
  refreshing: boolean;
  refreshingLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchMaxLength: number;
  searchPlaceholder: string;
  searchLabel: string;
}) {
  return (
    <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{count}</p>
        </div>
        {refreshing ? (
          <RefreshCwIcon
            aria-label={refreshingLabel}
            className="animate-spin text-muted-foreground"
          />
        ) : null}
      </div>

      <InputGroup className="w-full sm:w-72">
        <InputGroupInput
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          maxLength={searchMaxLength}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
        />
        <InputGroupAddon align="inline-start">
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
