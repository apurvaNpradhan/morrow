import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** How accounts are created, then the privacy page. */
export function AuthLegalFooter({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      {children ? <p>{children}</p> : null}
      <p>
        <Link to="/privacy" className="underline underline-offset-4">
          {t("account:privacy.title")}
        </Link>
      </p>
    </>
  );
}
