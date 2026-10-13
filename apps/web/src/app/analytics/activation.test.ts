import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { trackSignup } from "./activation";

const plausible = vi.fn();

beforeEach(() => {
  window.plausible = plausible;
});

afterEach(() => {
  delete window.plausible;
  localStorage.clear();
  plausible.mockReset();
});

describe("trackSignup", () => {
  it("records a signup once per user on this device", () => {
    trackSignup({ id: "user-1" });
    trackSignup({ id: "user-1" });

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith("Signup", undefined);
  });

  it("stores nothing when analytics is not loaded", () => {
    delete window.plausible;

    trackSignup({ id: "user-1" });

    expect(localStorage.length).toBe(0);
  });
});
