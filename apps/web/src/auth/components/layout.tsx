import type { ReactNode } from "react";
import { Logo } from "@/design-system/logo";

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /** An alert shown under the title: what went wrong, or what happens next. */
  notice?: ReactNode;
  /** Small print under the content, e.g. how accounts are created. */
  footer?: ReactNode;
};

/** One calm column for every signed-out page: mark, title, notice, content, footer. */
export function AuthLayout({
  children,
  title,
  subtitle,
  notice,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="flex h-svh w-full flex-col items-center overflow-y-auto bg-background px-4 py-6 sm:py-10">
      <div className="my-auto w-full max-w-sm space-y-8">
        <Logo className="mx-auto flex w-full items-end justify-center" />

        <div className="space-y-2 text-center">
          <h1 className="text-xl font-medium tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {notice ? <div>{notice}</div> : null}
        <div>{children}</div>
        {footer ? (
          <div className="space-y-2 text-center text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
