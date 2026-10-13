import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageTitle } from "@/design-system/page-title";
import { Button } from "@/design-system/ui/button";

/** Shown for a slug that doesn't exist and for one the user can't open, identically. */
export function WorkspaceNotFound() {
  const { t } = useTranslation();
  return (
    <main className="flex h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <PageTitle title={t("workspace:notFound.title")} />
      <h1 className="text-xl font-semibold text-foreground">
        {t("workspace:notFound.title")}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("workspace:notFound.description")}
      </p>
      <Button render={<Link to="/" />}>{t("workspace:notFound.action")}</Button>
    </main>
  );
}
