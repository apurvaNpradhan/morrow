import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import { Badge } from "@/design-system/ui/badge";
import { getInitials } from "@/design-system/get-initials";
import { formatRelativeTime } from "@/design-system/format";
import { LabelDot } from "@/labels";
import { CATEGORY_ICONS, ProjectIcon } from "@/projects";
import { splitByMarks, splitByWords } from "../lib/highlight";
import type { SearchItem } from "../lib/search-groups";
import { Highlighted } from "./highlighted";

function ArchivedBadge() {
  const { t } = useTranslation("navigation");
  return <Badge variant="outline">{t("search.archived")}</Badge>;
}

function Snippet({ snippet }: { snippet: string }) {
  return (
    <span className="line-clamp-1 text-xs text-muted-foreground">
      <Highlighted segments={splitByMarks(snippet)} />
    </span>
  );
}

/** One result: what it is, what matched, and whether it is archived. */
export function SearchRow({
  item,
  query,
}: {
  item: SearchItem;
  query: string;
}) {
  const { t } = useTranslation("navigation");

  switch (item.kind) {
    case "task": {
      const Icon =
        CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS] ??
        CATEGORY_ICONS.unstarted;
      return (
        <>
          <Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {item.ticketId}
              </span>
              <span className="truncate">
                <Highlighted segments={splitByWords(item.title, query)} />
              </span>
            </span>
            {item.snippet ? <Snippet snippet={item.snippet} /> : null}
          </span>
          {item.archived ? <ArchivedBadge /> : null}
        </>
      );
    }
    case "comment":
      return (
        <>
          <MessageSquare
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <Snippet snippet={item.snippet} />
            <span className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">
                {t("search.commentOn", {
                  author: item.authorName ?? t("search.deletedUser"),
                  ticketId: item.ticketId,
                })}
              </span>
              <span className="shrink-0">
                {formatRelativeTime(item.createdAt)}
              </span>
            </span>
          </span>
          {item.archived ? <ArchivedBadge /> : null}
        </>
      );
    case "project":
      return (
        <>
          <ProjectIcon project={item.project} />
          <span className="min-w-0 flex-1 truncate">
            <Highlighted segments={splitByWords(item.project.name, query)} />
          </span>
          <span className="text-xs text-muted-foreground">
            {item.project.key}
          </span>
          {item.archived ? <ArchivedBadge /> : null}
        </>
      );
    case "label":
      return (
        <>
          <LabelDot color={item.label.color} />
          <span className="min-w-0 flex-1 truncate">
            <Highlighted segments={splitByWords(item.label.name, query)} />
          </span>
        </>
      );
    case "member":
      return (
        <>
          <Avatar className="size-5 text-[0.625rem]">
            {item.image ? <AvatarImage src={item.image} alt="" /> : null}
            <AvatarFallback>{getInitials(item.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">
            <Highlighted segments={splitByWords(item.name, query)} />
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {item.email}
          </span>
        </>
      );
  }
}
