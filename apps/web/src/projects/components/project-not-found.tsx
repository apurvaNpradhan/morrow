import { Link } from "@tanstack/react-router";
import { FolderX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/design-system/ui/empty";

/** What an unknown key shows: the same for a deleted project and a changed key. */
export function ProjectNotFound({ slug }: { slug: string }) {
  const { t } = useTranslation("projects");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderX aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("board.notFoundTitle")}</EmptyTitle>
        <EmptyDescription>{t("board.notFoundDescription")}</EmptyDescription>
      </EmptyHeader>
      <Button
        variant="outline"
        size="sm"
        render={<Link to="/$slug/projects" params={{ slug }} />}
      >
        {t("board.backToProjects")}
      </Button>
    </Empty>
  );
}
