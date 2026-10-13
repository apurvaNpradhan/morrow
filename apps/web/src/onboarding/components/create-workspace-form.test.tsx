import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SlugUnavailableError } from "@/workspace/routing/lib/workspace-slug-error";
import { CreateWorkspaceForm } from "./create-workspace-form";

const getSlugAvailability = vi.fn();
const createWorkspace = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/lib/orpc", () => ({
  rpc: {
    workspace: {
      slugAvailability: (input: { slug: string; workspaceId?: string }) =>
        getSlugAvailability(input.slug, input.workspaceId),
    },
  },
}));
vi.mock("@/workspace/queries/use-create-workspace", () => ({
  useCreateWorkspace: () => ({
    mutateAsync: createWorkspace,
    isPending: false,
  }),
}));
vi.mock("@/design-system/toast", () => ({ toast: { error: vi.fn() } }));

function renderForm(onCreated = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateWorkspaceForm onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return onCreated;
}

const nameInput = () =>
  screen.getByLabelText(
    "auth:onboarding.workspace.nameLabel",
  ) as HTMLInputElement;
const slugInput = () =>
  screen.getByLabelText("workspace:slug.label") as HTMLInputElement;
const continueButton = () =>
  screen.getByRole("button", {
    name: "auth:onboarding.continue",
  }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateWorkspaceForm", () => {
  it("fills the slug from the name", async () => {
    getSlugAvailability.mockResolvedValue({ available: true });
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "My Team" } });

    expect(slugInput().value).toBe("my-team");
  });

  it("stops following the name once the slug is edited by hand", () => {
    getSlugAvailability.mockResolvedValue({ available: true });
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "My Team" } });
    fireEvent.change(slugInput(), { target: { value: "custom" } });
    fireEvent.change(nameInput(), { target: { value: "Another Team" } });

    expect(slugInput().value).toBe("custom");
  });

  it("keeps Continue disabled until the slug is confirmed available", async () => {
    getSlugAvailability.mockResolvedValue({ available: true });
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "My Team" } });
    expect(continueButton().disabled).toBe(true);

    await waitFor(() => expect(continueButton().disabled).toBe(false));
    expect(getSlugAvailability).toHaveBeenCalledWith("my-team", undefined);
  });

  it("says a slug is taken and blocks Continue", async () => {
    getSlugAvailability.mockResolvedValue({
      available: false,
      reason: "taken",
    });
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "Acme" } });

    expect(await screen.findByText("workspace:slug.taken")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("flags reserved and malformed slugs without asking the server", async () => {
    renderForm();
    fireEvent.change(nameInput(), { target: { value: "Team" } });

    fireEvent.change(slugInput(), { target: { value: "admin" } });
    expect(screen.getByText("workspace:slug.reserved")).toBeTruthy();
    fireEvent.change(slugInput(), { target: { value: "a" } });
    expect(screen.getByText("workspace:slug.invalid")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
    expect(getSlugAvailability).not.toHaveBeenCalled();
  });

  it("reports a slug lost to a concurrent create as taken", async () => {
    getSlugAvailability.mockResolvedValue({ available: true });
    createWorkspace.mockRejectedValue(new SlugUnavailableError("taken"));
    const onCreated = renderForm();

    fireEvent.change(nameInput(), { target: { value: "My Team" } });
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.submit(nameInput().closest("form")!);

    expect(await screen.findByText("workspace:slug.taken")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates the workspace with exactly the chosen slug", async () => {
    getSlugAvailability.mockResolvedValue({ available: true });
    createWorkspace.mockResolvedValue({
      id: "w1",
      slug: "my-team",
      name: "My Team",
    });
    const onCreated = renderForm();

    fireEvent.change(nameInput(), { target: { value: "My Team" } });
    await waitFor(() => expect(continueButton().disabled).toBe(false));
    fireEvent.submit(nameInput().closest("form")!);

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(createWorkspace).toHaveBeenCalledWith({
      name: "My Team",
      slug: "my-team",
    });
  });
});
