import type { AppLocale } from "@morrow/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { rpc } from "@/app/lib/orpc";
import { refreshSession } from "@/auth";
import { getBrowserLocale, resolveLocale } from "@/app/i18n";

export function useLocale() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();

  const locale = useMemo(
    () => resolveLocale(i18n.resolvedLanguage, getBrowserLocale()),
    [i18n.resolvedLanguage],
  );

  const setLocale = async (nextLocale: AppLocale) => {
    await rpc.account.updateProfile({ locale: nextLocale });
    refreshSession();

    const resolved = resolveLocale(nextLocale, null);
    document.documentElement.lang = resolved;
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    await i18n.changeLanguage(resolved);
  };

  return {
    locale,
    setLocale,
  };
}
