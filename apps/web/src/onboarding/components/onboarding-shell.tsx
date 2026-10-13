import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { authClient } from "@/auth";
import { Logo } from "@/design-system/logo";
import { PageTitle } from "@/design-system/page-title";
import { Button } from "@/design-system/ui/button";
import { useFadeTransition } from "@/design-system/use-fade-transition";
import { AccountMenu } from "./account-menu";
import { ProgressBar } from "./progress-bar";

type OnboardingShellProps = {
  title: string;
  subtitle?: string;
  /** Total progress segments; 0 hides the bar. */
  segments: number;
  /** One-based segment the person is on. */
  current: number;
  onBack?: () => void;
  children: React.ReactNode;
};

/** The one layout every onboarding step, on cloud and self-hosted, is drawn in. */
export function OnboardingShell({
  title,
  subtitle,
  segments,
  current,
  onBack,
  children,
}: OnboardingShellProps) {
  const { t } = useTranslation();
  const fade = useFadeTransition();
  const { data: session } = authClient.useSession();

  return (
    <main className="flex h-svh w-full flex-col overflow-y-auto bg-background px-6 py-6 sm:px-10">
      <PageTitle title={title} />
      <header className="flex items-start justify-between gap-4">
        <Logo />
        {session?.user.email ? (
          <AccountMenu email={session.user.email} />
        ) : null}
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
        <ProgressBar segments={segments} current={current} />
        <motion.div
          variants={fade}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-md"
        >
          <h1 className="text-center text-xl font-medium tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-8">{children}</div>
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mt-6 text-muted-foreground"
              onClick={onBack}
            >
              {t("auth:onboarding.back")}
            </Button>
          ) : null}
        </motion.div>
      </div>
    </main>
  );
}
