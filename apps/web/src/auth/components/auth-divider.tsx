import { useTranslation } from "react-i18next";

export function AuthDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-sm text-muted-foreground">
        {t("auth:forms.or")}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
