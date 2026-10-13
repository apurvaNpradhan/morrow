import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/app/settings/settings-row";
import {
  isWeekStartDay,
  useUserPreferencesStore,
  WEEK_START_DAYS,
  type WeekStartDay,
} from "@/app/store/user-preferences";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";

export function WeekStartRow() {
  const { t } = useTranslation();
  const { weekStartsOn, setWeekStartsOn } = useUserPreferencesStore();

  const labels: Record<WeekStartDay, string> = {
    0: t("settings:preferencesPage.weekStartsOnSunday"),
    1: t("settings:preferencesPage.weekStartsOnMonday"),
    6: t("settings:preferencesPage.weekStartsOnSaturday"),
  };

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.firstDayOfWeek")}
      description={t("settings:preferencesPage.firstDayOfWeekDescription")}
    >
      <Select
        value={String(weekStartsOn)}
        onValueChange={(value) => {
          if (!value) return;
          const day = Number(value);
          if (isWeekStartDay(day)) setWeekStartsOn(day);
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-40">
          <SelectValue
            placeholder={t("settings:preferencesPage.selectFirstDayOfWeek")}
          >
            {labels[weekStartsOn]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WEEK_START_DAYS.map((day) => (
            <SelectItem key={day} value={String(day)}>
              {labels[day]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
