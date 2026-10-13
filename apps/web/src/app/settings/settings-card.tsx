import type { ComponentProps } from "react";
import { cn } from "@/design-system/cn";

type SettingsCardProps = ComponentProps<"div"> & {
  tone?: "default" | "danger";
};

export function SettingsCard({
  tone = "default",
  className,
  ...props
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border bg-card",
        tone === "danger" ? "border-destructive/20" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
