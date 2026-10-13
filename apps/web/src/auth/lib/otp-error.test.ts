import { expect, it } from "vite-plus/test";
import { otpErrorKey } from "./otp-error";

it("tells wrong, expired and used-up codes apart", () => {
  expect(otpErrorKey("INVALID_OTP")).toBe("auth:verifyOtp.errors.invalid");
  expect(otpErrorKey("OTP_EXPIRED")).toBe("auth:verifyOtp.errors.expired");
  expect(otpErrorKey("TOO_MANY_ATTEMPTS")).toBe(
    "auth:verifyOtp.errors.tooManyAttempts",
  );
});

it("falls back to a generic message for anything else", () => {
  expect(otpErrorKey(undefined)).toBe("auth:verifyOtp.errors.generic");
  expect(otpErrorKey("SOMETHING_ELSE")).toBe("auth:verifyOtp.errors.generic");
});
