import { useEffect } from "react";
import { trackSignup } from "@/app/analytics/activation";
import { isNewSignup } from "@/app/analytics/is-new-signup";

type SessionUser = {
  id: string;
  createdAt: Date | string;
};

export function useTrackSignup(user: SessionUser | undefined) {
  const id = user?.id;
  const createdAt = user?.createdAt;

  useEffect(() => {
    if (!id || !createdAt || !isNewSignup(createdAt)) return;
    trackSignup({ id });
  }, [id, createdAt]);
}
