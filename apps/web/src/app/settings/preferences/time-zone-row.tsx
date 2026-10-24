import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { browserTimeZone, useTimeZoneSetting } from "@/app/hooks/use-time-zone";
import { SettingsRow } from "@/app/settings/settings-row";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/design-system/ui/combobox";

/** The choice that follows the browser. */
const FOLLOW_BROWSER = "";

export function TimeZoneRow() {
  const { t } = useTranslation();
  const { timeZone, setTimeZone } = useTimeZoneSetting();
  const zones = useMemo(
    () => [FOLLOW_BROWSER, ...Intl.supportedValuesOf("timeZone")],
    [],
  );
  const label = (zone: string) =>
    zone === FOLLOW_BROWSER
      ? t("settings:preferencesPage.timeZoneFollowBrowser", {
          zone: browserTimeZone(),
        })
      : zone.replaceAll("_", " ");

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.timeZone")}
      description={t("settings:preferencesPage.timeZoneDescription")}
    >
      <Combobox
        items={zones}
        value={timeZone ?? FOLLOW_BROWSER}
        itemToStringLabel={label}
        onValueChange={(zone) => {
          if (zone !== null) void setTimeZone(zone || null);
        }}
      >
        <ComboboxInput
          className="w-full sm:w-64"
          aria-label={t("settings:preferencesPage.timeZone")}
          placeholder={t("settings:preferencesPage.selectTimeZone")}
        />
        <ComboboxPopup>
          <ComboboxEmpty>
            {t("settings:preferencesPage.noTimeZones")}
          </ComboboxEmpty>
          <ComboboxList>
            {(zone: string) => (
              <ComboboxItem key={zone} value={zone}>
                {label(zone)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </SettingsRow>
  );
}
