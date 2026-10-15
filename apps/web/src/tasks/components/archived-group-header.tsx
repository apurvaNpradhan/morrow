import { Archive, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";

/** The header of the list's last group: archived tasks, loaded once it is expanded. */
export function ArchivedGroupHeader({
  expanded,
  count,
  onToggle,
}: {
  expanded: boolean;
  /** Null while the group is collapsed or loading. */
  count: number | null;
  onToggle: () => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <div className="flex h-9 items-center gap-1 border-b bg-muted/30 px-3.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t(expanded ? "list.collapse" : "list.expand", {
          name: t("list.archived"),
        })}
        className="rounded-sm p-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onToggle}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 transition-transform", expanded && "rotate-90")}
        />
      </button>
      <Archive aria-hidden="true" className="size-4 text-muted-foreground" />
      <h2 className="flex-1 text-sm font-medium">{t("list.archived")}</h2>
      {count !== null ? (
        <span className="pe-2 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}
