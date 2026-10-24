import {
  type FieldConfig,
  FIELD_UNIT_MAX,
  NUMBER_FORMATS,
  parseFieldConfig,
  type ProjectFieldRow,
  TEXT_FORMATS,
} from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { toast } from "@/design-system/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { updateField } from "../actions/field-actions";
import { BlurSaveInput } from "../components/blur-save-input";

/** A number as typed in a bound box; empty means no bound, anything else not a number is refused. */
const parseBound = (text: string) =>
  text === ""
    ? undefined
    : /^-?\d+(\.\d+)?$/.test(text)
      ? Number(text)
      : Number.NaN;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * How a text or number Field reads, in the Field's card: a text is plain or a
 * link; a number is plain, a currency (with its code) or a percent, with a
 * unit label and lowest and highest values it may take.
 */
export function FieldConfigEditor({
  field,
  disabled,
}: {
  field: ProjectFieldRow;
  disabled: boolean;
}) {
  const { t } = useTranslation("projects");
  const { config } = field;
  const isNumber = field.type === "number";
  const formats = isNumber ? NUMBER_FORMATS : TEXT_FORMATS;
  const format = config.format ?? "plain";

  async function save(next: FieldConfig) {
    // Plain is the default: leaving it out keeps the stored config short.
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) =>
          value !== undefined && !(key === "format" && value === "plain"),
      ),
    );
    if (!parseFieldConfig(field.type, cleaned)) {
      toast.error(t("fields.configInvalid"));
      return;
    }
    try {
      await updateField(field.id, { config: cleaned });
    } catch (error) {
      toast.error(errorMessage(t, error, t("fields.updateError")));
    }
  }

  return (
    <div className="divide-y divide-border">
      <Row label={t("fields.formatLabel")}>
        <Select
          value={format}
          disabled={disabled}
          onValueChange={(value) => {
            if (!value) return;
            const picked = value as NonNullable<FieldConfig["format"]>;
            // A unit means something else for each format, so it starts over;
            // a currency needs a code from the start.
            void save({
              ...config,
              format: picked,
              unit: picked === "currency" ? "USD" : undefined,
            });
          }}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue>{t(`fields.format.${format}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {formats.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {t(`fields.format.${candidate}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      {isNumber && format !== "percent" ? (
        <Row
          label={
            format === "currency"
              ? t("fields.currencyLabel")
              : t("fields.unitLabel")
          }
        >
          <BlurSaveInput
            size="sm"
            className="w-40"
            maxLength={format === "currency" ? 3 : FIELD_UNIT_MAX}
            placeholder={format === "currency" ? "USD" : "pts"}
            disabled={disabled}
            value={config.unit ?? ""}
            isAcceptable={() => true}
            onCommit={(unit) =>
              save({
                ...config,
                unit:
                  unit === ""
                    ? undefined
                    : format === "currency"
                      ? unit.toUpperCase()
                      : unit,
              })
            }
          />
        </Row>
      ) : null}
      {isNumber
        ? (["min", "max"] as const).map((bound) => (
            <Row key={bound} label={t(`fields.${bound}Label`)}>
              <BlurSaveInput
                size="sm"
                className="w-40"
                inputMode="decimal"
                disabled={disabled}
                value={config[bound]?.toString() ?? ""}
                isAcceptable={() => true}
                onCommit={(text) => {
                  const parsed = parseBound(text);
                  if (Number.isNaN(parsed)) {
                    toast.error(t("fields.configInvalid"));
                    return;
                  }
                  return save({ ...config, [bound]: parsed });
                }}
              />
            </Row>
          ))
        : null}
    </div>
  );
}
