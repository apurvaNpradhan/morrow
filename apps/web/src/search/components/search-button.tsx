import { SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TooltipLabel } from "@/design-system/tooltip-label";
import { Button } from "@/design-system/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system/ui/tooltip";
import { openSearch } from "../lib/search-seed";

/** The sidebar's way into the search dialog. */
export function SearchButton() {
  const { t } = useTranslation("navigation");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label={t("search.button")}
            onClick={() => openSearch()}
          />
        }
      >
        <SearchIcon />
      </TooltipTrigger>
      <TooltipContent>
        <TooltipLabel label={t("search.button")} hotkeyId="search" />
      </TooltipContent>
    </Tooltip>
  );
}
