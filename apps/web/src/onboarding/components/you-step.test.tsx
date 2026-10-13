import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { YouStep } from "./you-step";

const updateProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./onboarding-shell", () => ({
  OnboardingShell: ({
    segments,
    children,
  }: {
    segments: number;
    children: React.ReactNode;
  }) => (
    <div data-testid="shell" data-segments={segments}>
      {children}
    </div>
  ),
}));
vi.mock("@/account/queries/use-update-user-profile", () => ({
  useUpdateUserProfile: () => ({
    mutateAsync: updateProfile,
    isPending: false,
  }),
}));
vi.mock("@/design-system/toast", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const input = () =>
  screen.getByLabelText("auth:onboarding.you.nameLabel") as HTMLInputElement;
const submit = () =>
  screen.getByRole("button", { name: "auth:onboarding.continue" });

describe("YouStep", () => {
  it("offers the email's local part as a placeholder, not a value", () => {
    render(
      <YouStep
        initialName=""
        emailLocalPart="ada"
        isSingleStep={false}
        onDone={vi.fn()}
      />,
    );
    expect(input().value).toBe("");
    expect(input().placeholder).toBe("ada");
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
  });

  it("pre-fills a name supplied by a sign-in provider", () => {
    render(
      <YouStep
        initialName="Ada Lovelace"
        emailLocalPart="ada"
        isSingleStep={false}
        onDone={vi.fn()}
      />,
    );
    expect(input().value).toBe("Ada Lovelace");
    expect(document.activeElement).toBe(input());
  });

  it("saves the typed name and continues on Enter", async () => {
    const onDone = vi.fn();
    render(
      <YouStep
        initialName=""
        emailLocalPart="ada"
        isSingleStep={false}
        onDone={onDone}
      />,
    );
    fireEvent.change(input(), { target: { value: "  Ada  " } });
    fireEvent.submit(input().closest("form")!);

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(updateProfile).toHaveBeenCalledWith({ name: "Ada" });
  });

  it("does not rewrite a name that was only confirmed", async () => {
    const onDone = vi.fn();
    render(
      <YouStep
        initialName="Ada"
        emailLocalPart="ada"
        isSingleStep={false}
        onDone={onDone}
      />,
    );
    fireEvent.submit(input().closest("form")!);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("shows no progress bar for the single step of an invite-link signup", () => {
    render(
      <YouStep
        initialName=""
        emailLocalPart="ada"
        isSingleStep
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByTestId("shell").dataset.segments).toBe("0");
  });
});
