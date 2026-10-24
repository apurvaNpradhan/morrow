import { taskDateDay } from "@morrow/sync-schemas";
import { useEffect, useState } from "react";
import { useTimeZone } from "@/app/hooks/use-time-zone";

/**
 * Today as `YYYY-MM-DD` in the user's time zone. Checked every minute and on
 * focus, since the zone's midnight need not be the browser's; it only
 * re-renders when the day changes.
 */
export function useToday() {
  const timeZone = useTimeZone();
  const [today, setToday] = useState(() =>
    taskDateDay(new Date(), true, timeZone),
  );

  useEffect(() => {
    const update = () => setToday(taskDateDay(new Date(), true, timeZone));
    update();
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [timeZone]);

  return today;
}
