import { type AppLocale, defaultLocale, supportedLocales } from "@morrow/i18n";
import { useTranslation } from "react-i18next";
import { getLocaleLabel } from "@/app/i18n/get-locale-label";
import { SettingsRow } from "@/app/settings/settings-row";
import { useLocale } from "@/app/hooks/use-locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";

export function LanguageRow() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const selected: AppLocale = locale ?? defaultLocale;

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.language")}
      description={t("settings:preferencesPage.languageDescription")}
    >
      <Select
        value={selected}
        onValueChange={(value) => {
          if (value) void setLocale(value as AppLocale);
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-40">
          <SelectValue
            placeholder={t("settings:preferencesPage.selectLanguage")}
          >
            {getLocaleLabel(selected)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {supportedLocales.map((supportedLocale) => (
            <SelectItem key={supportedLocale} value={supportedLocale}>
              {getLocaleLabel(supportedLocale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
