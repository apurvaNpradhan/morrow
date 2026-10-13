import type { ReactElement, ReactNode } from "react";
import { SettingsRow } from "./settings-row";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/design-system/ui/form";

type SettingsFormRowProps = {
  label: ReactNode;
  description?: ReactNode;
  children: ReactElement;
};

export function SettingsFormRow({
  label,
  description,
  children,
}: SettingsFormRowProps) {
  return (
    <FormItem className="space-y-0">
      <SettingsRow
        stack
        title={<FormLabel>{label}</FormLabel>}
        description={description}
      >
        <FormControl>{children}</FormControl>
      </SettingsRow>
      <FormMessage className="-mt-1.5 px-4 pb-3 text-xs" />
    </FormItem>
  );
}
