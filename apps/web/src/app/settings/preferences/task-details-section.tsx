import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/settings/settings-card";
import { SettingsRow } from "@/app/settings/settings-row";
import { SettingsSection } from "@/app/settings/settings-section";
import {
  saveDevicePreferences,
  useDevicePreferences,
} from "@/app/preferences/use-device-preferences";
import { Button } from "@/design-system/ui/button";
import { Label } from "@/design-system/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { Switch } from "@/design-system/ui/switch";

const FIELDS = [
  ["showTaskNumbers", "numbers"],
  ["showTaskAssignees", "assignees"],
  ["showTaskStartDate", "startDates"],
  ["showTaskDueDates", "dueDates"],
  ["showTaskPriority", "priority"],
] as const;

/**
 * What shows on cards and rows of every board and list on this device, and
 * the layout a Project opens in. The Display menu of a board changes the same
 * settings.
 */
export function TaskDetailsSection() {
  const { t } = useTranslation("tasks");
  const preferences = useDevicePreferences();

  return (
    <SettingsSection
      title={t("preferences.title")}
      description={t("preferences.description")}
    >
      <SettingsCard>
        <SettingsRow
          stack
          title={t("preferences.defaultView")}
          description={t("preferences.defaultViewDescription")}
        >
          <Select
            value={preferences.taskView}
            onValueChange={(view) => {
              if (view === "board" || view === "list") {
                saveDevicePreferences({ taskView: view });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full sm:w-40"
              aria-label={t("preferences.defaultView")}
            >
              <SelectValue>{t(`display.${preferences.taskView}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="board">{t("display.board")}</SelectItem>
              <SelectItem value="list">{t("display.list")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
        {FIELDS.map(([key, field]) => (
          <SettingsRow
            key={key}
            title={
              <Label htmlFor={`task-detail-${field}`}>
                {t(`display.field.${field}`)}
              </Label>
            }
          >
            <Switch
              id={`task-detail-${field}`}
              checked={preferences[key]}
              onCheckedChange={(show) => saveDevicePreferences({ [key]: show })}
            />
          </SettingsRow>
        ))}
        <SettingsRow stack title={t("preferences.resetTitle")}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              saveDevicePreferences({
                showTaskNumbers: true,
                showTaskAssignees: true,
                showTaskStartDate: true,
                showTaskDueDates: true,
                showTaskPriority: true,
              })
            }
          >
            {t("display.reset")}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
