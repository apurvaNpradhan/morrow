/**
 * The i18n key for why a sign-in code was refused, from Better Auth's error
 * code. Wrong, expired and used-up codes each tell the visitor what to do next.
 */
export function otpErrorKey(code: string | undefined) {
  switch (code) {
    case "INVALID_OTP":
      return "auth:verifyOtp.errors.invalid";
    case "OTP_EXPIRED":
      return "auth:verifyOtp.errors.expired";
    case "TOO_MANY_ATTEMPTS":
      return "auth:verifyOtp.errors.tooManyAttempts";
    default:
      return "auth:verifyOtp.errors.generic";
  }
}
