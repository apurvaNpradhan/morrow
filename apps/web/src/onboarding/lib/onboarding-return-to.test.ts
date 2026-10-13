import { describe, expect, it } from "vite-plus/test";
import { getOnboardingReturnTo } from "./onboarding-return-to";

describe("getOnboardingReturnTo", () => {
  it("remembers a deep link", () => {
    expect(
      getOnboardingReturnTo({
        href: "/acme/inbox?x=1",
        pathname: "/acme/inbox",
      }),
    ).toBe("/acme/inbox?x=1");
  });

  it("drops the bare entry points", () => {
    expect(getOnboardingReturnTo({ href: "/", pathname: "/" })).toBeUndefined();
    expect(getOnboardingReturnTo({ href: "/", pathname: "/" })).toBeUndefined();
  });
});
