import { QueryClient } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const m = vi.hoisted(() => ({
  social: vi.fn(),
  navigate: vi.fn(),
  getConfig: vi.fn(),
}));
vi.mock("@/app/lib/orpc", () => ({
  rpc: { auth: { registrationStatus: m.getConfig } },
}));
vi.mock("@/auth/lib/auth-client", () => ({
  authClient: { signIn: m, getLastUsedLoginMethod: () => null },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({}),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => m.navigate,
}));
vi.mock("@/auth/use-registration-status", () => ({
  REGISTRATION_STATUS_QUERY_KEY: ["registration-status"],
  useRegistrationStatus: () => ({ data: { open: true }, isLoading: false }),
}));
vi.mock("@/auth/components/layout", () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/auth/components/otp-sign-in-form", () => ({
  OtpSignInForm: () => null,
}));
vi.mock("@/auth/components/toggle", () => ({ AuthToggle: () => null }));
vi.mock("@/design-system/page-title", () => ({ PageTitle: () => null }));
vi.mock("@/auth/components/turnstile", () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("fresh-token")}>
      Solve CAPTCHA
    </button>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/design-system/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/lib/env", () => ({
  env: { turnstileSiteKey: "test-sitekey" },
}));
const { Route: signin } = await import("./sign-in");
const { Route: signup } = await import("./sign-up");
afterAll(() => vi.unstubAllEnvs());
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.social.mockResolvedValue({ error: { message: "Retry" } });
});
describe("sign-up route", () => {
  it("still renders the route when config preloading fails", async () => {
    m.getConfig.mockRejectedValueOnce(new Error("offline"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const loader = signup.options.loader as (args: {
      context: { queryClient: QueryClient };
    }) => Promise<void>;
    await expect(loader({ context: { queryClient } })).resolves.toBeUndefined();
    expect(queryClient.getQueryState(["registration-status"])?.status).toBe(
      "error",
    );
  });
});
describe.each([
  ["sign-in", signin],
  ["sign-up", signup],
] as const)("%s CAPTCHA submission", (_name, route) => {
  it("sends the token and requires a fresh one after the provider fails", async () => {
    const Page = route.options.component as ComponentType;
    render(<Page />);
    const button = screen.getByRole("button", {
      name: "auth:signIn.continueWithGithub",
    });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Solve CAPTCHA" }));
    fireEvent.click(button);
    await waitFor(() => expect(m.social).toHaveBeenCalledTimes(1));
    expect(m.social.mock.calls[0]?.[1]).toEqual({
      headers: { "x-turnstile-token": "fresh-token" },
    });
    await waitFor(() => expect(button).toBeDisabled());
    expect(
      screen.getByRole("button", { name: "Solve CAPTCHA" }),
    ).toBeInTheDocument();
  });
});
