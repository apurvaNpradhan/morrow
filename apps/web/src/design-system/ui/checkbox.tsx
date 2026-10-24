"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/design-system/cn";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-sm border border-input bg-background not-dark:bg-clip-padding shadow-xs/5 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/36 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-disabled:opacity-64 sm:size-4 dark:bg-input/32 [&_svg]:pointer-events-none",
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center"
        data-slot="checkbox-indicator"
      >
        <CheckIcon aria-hidden="true" className="size-3.5 sm:size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
