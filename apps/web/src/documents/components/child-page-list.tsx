import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocumentRow } from "@morrow/sync-schemas";

/** A page's sub-pages, listed under its text as Notion shows them. */
export function ChildPageList({
  slug,
  pages,
}: {
  slug: string;
  pages: readonly DocumentRow[];
}) {
  const { t } = useTranslation("documents");
  if (pages.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col">
      {pages.map((page) => (
        <li key={page.id}>
          <Link
            to="/$slug/pages/$documentId"
            params={{ slug, documentId: page.id }}
            className="-mx-1 flex items-center gap-2 rounded px-1 py-1 text-base hover:bg-muted/60"
          >
            <FileText
              aria-hidden="true"
              className="size-[1.1em] shrink-0 text-muted-foreground"
            />
            <span className="truncate font-medium underline decoration-border underline-offset-4">
              {page.title || t("untitled")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
