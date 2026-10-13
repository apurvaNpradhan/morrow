import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";

type ProgressBarProps = {
  /** Total segments; nothing is rendered for zero. */
  segments: number;
  /** One-based segment the person is on. */
  current: number;
};

/** A quiet segmented bar: no labels, nothing to click. */
export function ProgressBar({ segments, current }: ProgressBarProps) {
  const { t } = useTranslation();
  if (segments <= 0) return null;

  return (
    <div
      role="progressbar"
      aria-label={t("auth:onboarding.progress")}
      aria-valuemin={1}
      aria-valuemax={segments}
      aria-valuenow={current}
      className="flex w-full max-w-md gap-1.5"
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 flex-1 rounded-full bg-border transition-colors duration-300",
            index < current && "bg-foreground",
          )}
        />
      ))}
    </div>
  );
}
