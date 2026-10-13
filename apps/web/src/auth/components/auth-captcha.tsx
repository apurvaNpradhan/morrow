import { Turnstile } from "./turnstile";
import type { AuthCaptcha } from "@/auth/use-auth-captcha";

/** Renders nothing unless Cloudflare asks the visitor to do something. */
export function AuthCaptcha({ captcha }: { captcha: AuthCaptcha }) {
  if (!captcha.siteKey) return null;
  return (
    <Turnstile
      key={captcha.key}
      siteKey={captcha.siteKey}
      onVerify={captcha.onVerify}
      onExpire={captcha.onExpire}
      onError={captcha.onExpire}
    />
  );
}
