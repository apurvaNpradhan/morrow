import { useCallback, useState } from "react";
import { env } from "@/app/lib/env";

/**
 * Turnstile state for a signed-out page. Every action that sends mail or
 * starts a sign-in waits for `token`; `reset` re-arms the widget after each use.
 */
export function useAuthCaptcha() {
  const siteKey = env.turnstileSiteKey;
  const [token, setToken] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const clear = useCallback(() => setToken(null), []);
  const reset = useCallback(() => {
    setToken(null);
    setKey((value) => value + 1);
  }, []);

  return {
    siteKey,
    key,
    /** Configured, but not yet solved. */
    pending: Boolean(siteKey) && !token,
    /** `undefined` when no captcha is configured, so forms don't wait for one. */
    token: siteKey ? token : undefined,
    onVerify: setToken,
    onExpire: clear,
    reset,
  };
}

export type AuthCaptcha = ReturnType<typeof useAuthCaptcha>;
