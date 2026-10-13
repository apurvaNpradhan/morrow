import { Check, Loader2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { cn } from "@/design-system/cn";
import { type SlugFieldStatus } from "./slug-field-state";

type WorkspaceSlugFieldProps = {
  value: string;
  status: SlugFieldStatus;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Extra guidance under the status line, e.g. that old links keep working. */
  hint?: string;
};

const ERROR_STATUSES: SlugFieldStatus[] = ["taken", "reserved", "invalid"];

export function WorkspaceSlugField({
  value,
  status,
  onChange,
  disabled,
  hint,
}: WorkspaceSlugFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const messageId = `${id}-message`;
  const isError = ERROR_STATUSES.includes(status);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        {t("workspace:slug.label")}
      </Label>
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-xl border border-input bg-background shadow-xs/5 transition-shadow focus-within:ring-2 focus-within:ring-ring",
          isError && "border-destructive/60",
          disabled && "opacity-64",
        )}
      >
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center whitespace-nowrap border-r border-input bg-muted px-3 text-sm text-muted-foreground"
        >
          /
        </span>
        <Input
          unstyled
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={isError || undefined}
          aria-describedby={messageId}
          className="min-w-0 flex-1 [&_[data-slot=input]]:px-3"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p
        id={messageId}
        aria-live="polite"
        className={cn(
          "flex min-h-4 items-center gap-1 text-xs",
          isError ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {status === "checking" ? (
          <>
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            {t("workspace:slug.checking")}
          </>
        ) : null}
        {status === "available" ? (
          <>
            <Check className="size-3" aria-hidden="true" />
            {t("workspace:slug.available")}
          </>
        ) : null}
        {status === "taken" ? t("workspace:slug.taken") : null}
        {status === "reserved" ? t("workspace:slug.reserved") : null}
        {status === "invalid" ? t("workspace:slug.invalid") : null}
        {!isError && status !== "checking" && status !== "available"
          ? hint
          : null}
      </p>
    </div>
  );
}
