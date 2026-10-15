import { useLocalDay } from "@/design-system/use-local-day";
import { dayString } from "../lib/calendar-day";

/** The local calendar day as `YYYY-MM-DD`; changes at midnight. */
export function useToday() {
  return dayString(new Date(useLocalDay()));
}
