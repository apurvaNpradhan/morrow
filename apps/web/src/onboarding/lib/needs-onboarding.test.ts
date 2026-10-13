import { describe, expect, it } from "vite-plus/test";
import { needsOnboarding } from "./needs-onboarding";

describe("needsOnboarding", () => {
  it("sends an unfinished user anywhere outside onboarding into it", () => {
    expect(needsOnboarding({ onboardingCompletedAt: null }, "/acme")).toBe(
      true,
    );
    expect(needsOnboarding({}, "/")).toBe(true);
  });

  it("lets an unfinished user stay in onboarding", () => {
    expect(needsOnboarding({}, "/onboarding")).toBe(false);
    expect(needsOnboarding({}, "/onboarding/workspace")).toBe(false);
  });

  it("never gates a finished user", () => {
    expect(
      needsOnboarding({ onboardingCompletedAt: new Date() }, "/acme"),
    ).toBe(false);
  });

  it("does not treat lookalike paths as onboarding", () => {
    expect(needsOnboarding({}, "/onboarding-fake")).toBe(true);
  });
});
