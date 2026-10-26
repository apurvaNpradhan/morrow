import { useState } from "react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/design-system/copy-to-clipboard";
import { Button } from "@/design-system/ui/button";
import type { PageRefusal } from "../lib/page-refusal";

/**
 * What a page shows when the server refused something it will keep refusing:
 * the page is read-only, the text typed here is offered for copying, and
 * Reload starts over from the server's page. The browser's copy was already
 * dropped, so a reload never replays what was refused.
 */
export function PageEndedNotice({
  refusal,
  unsentText,
}: {
  refusal: PageRefusal;
  unsentText: string;
}) {
  const { t } = useTranslation("documents");
  const [copied, setCopied] = useState(false);
  const reason = refusal.code ?? "UNKNOWN";

  return (
    <div
      role="alert"
      className="mb-4 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <div>
        <p className="font-medium">
          {t(`ended.title.${reason}`, {
            defaultValue: t("ended.title.UNKNOWN"),
          })}
        </p>
        <p className="text-muted-foreground">
          {t(`ended.description.${reason}`, {
            defaultValue: t("ended.description.UNKNOWN"),
          })}
        </p>
      </div>
      {unsentText.trim() ? (
        <textarea
          readOnly
          aria-label={t("ended.unsentLabel")}
          value={unsentText}
          rows={6}
          className="w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
        />
      ) : null}
      <div className="flex gap-2">
        {unsentText.trim() ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copyToClipboard(unsentText).then(setCopied)}
          >
            {copied ? t("ended.copied") : t("ended.copy")}
          </Button>
        ) : null}
        <Button size="sm" onClick={() => window.location.reload()}>
          {t("ended.reload")}
        </Button>
      </div>
    </div>
  );
}
