import { useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { refreshSession, useAuth } from "@/auth";

/** The zone this browser runs in. */
export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The user's time zone: the one chosen in preferences, else the browser's. It
 * decides "today", overdue and how times read.
 */
export function useTimeZone() {
  const { user } = useAuth();
  return user?.timeZone || browserTimeZone();
}

/** The chosen zone (null: follow the browser) and a setter that saves it. */
export function useTimeZoneSetting() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const setTimeZone = async (timeZone: string | null) => {
    await rpc.account.updateProfile({ timeZone });
    refreshSession();
    await queryClient.invalidateQueries({ queryKey: ["session"] });
  };
  return { timeZone: user?.timeZone ?? null, setTimeZone };
}
