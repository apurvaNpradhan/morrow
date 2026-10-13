import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/design-system/logo";
import { PageTitle } from "@/design-system/page-title";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

const SECTIONS = ["what", "who", "control"] as const;

function Privacy() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("account:privacy.pageTitle")} />
      <div className="h-svh w-full overflow-y-auto bg-background px-4 py-10">
        <main className="mx-auto w-full max-w-xl space-y-6">
          <Logo className="flex w-full items-end" />
          <header className="space-y-1">
            <h1 className="text-xl font-medium tracking-tight">
              {t("account:privacy.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("account:privacy.subtitle")}
            </p>
          </header>
          {SECTIONS.map((section) => (
            <section key={section} className="space-y-1">
              <h2 className="text-sm font-medium">
                {t(`account:privacy.${section}Title`)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(`account:privacy.${section}Body`)}
              </p>
            </section>
          ))}
          <Link
            to="/"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            {t("account:privacy.back")}
          </Link>
        </main>
      </div>
    </>
  );
}
