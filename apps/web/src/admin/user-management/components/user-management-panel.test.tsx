import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useAdminUsers, type AdminUser } from "@/admin/use-admin-users";
import { UserManagementPanel } from "./user-management-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "current-user" } }),
}));
vi.mock("@/admin/use-admin-users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/admin/use-admin-users")>()),
  useAdminUsers: vi.fn(),
}));
const { updateUserMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
}));
vi.mock("@/admin/user-management/queries/use-update-admin-user", () => ({
  useUpdateAdminUser: () => ({ mutateAsync: updateUserMock, isPending: false }),
}));
vi.mock("@/admin/user-management/queries/use-toggle-admin-user-status", () => ({
  useToggleAdminUserStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/admin/user-management/queries/use-delete-admin-user", () => ({
  useDeleteAdminUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const useAdminUsersMock = vi.mocked(useAdminUsers);

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: "user",
    banned: false,
    banReason: null,
    banExpires: null,
    ...overrides,
  };
}

function success(total: number, users: AdminUser[] = [user()]) {
  return {
    data: { users, total },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminUsers>;
}

function failure() {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: true,
    error: new Error("x"),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminUsers>;
}

function lastPageArgument() {
  const call = useAdminUsersMock.mock.calls.at(-1);
  return call?.[1];
}

function goToThirdPage() {
  const next = screen.getByRole("button", { name: "settings:adminUsers.next" });
  fireEvent.click(next);
  fireEvent.click(next);
  expect(lastPageArgument()).toBe(2);
}

function openEditDialog() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUsers.actions.open" }),
  );
  fireEvent.click(screen.getByText("settings:adminUsers.actions.edit"));
}

function submitEdit() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUsers.edit.save" }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useAdminUsersMock.mockReset();
  updateUserMock.mockReset();
  updateUserMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UserManagementPanel", () => {
  it("keeps the current page when the query fails", () => {
    useAdminUsersMock.mockReturnValue(success(60));
    const view = render(<UserManagementPanel />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    goToThirdPage();

    useAdminUsersMock.mockReturnValue(failure());
    view.rerender(<UserManagementPanel />);

    expect(screen.getByText("settings:adminUsers.loadError")).toBeTruthy();
    expect(lastPageArgument()).toBe(2);
  });

  it("clamps an out-of-range page once a smaller result set arrives", () => {
    useAdminUsersMock.mockReturnValue(success(60));
    const view = render(<UserManagementPanel />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    goToThirdPage();

    useAdminUsersMock.mockReturnValue(success(20));
    view.rerender(<UserManagementPanel />);

    expect(lastPageArgument()).toBe(0);
  });

  it("treats a comma-separated role containing admin as an instance admin", () => {
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ role: "user,admin" })]),
    );
    render(<UserManagementPanel />);

    const badge = screen.getByText("settings:adminUsers.roles.admin");
    expect(badge.closest('[data-slot="badge"]')).not.toBeNull();
  });
  it("never sends a role when a user is edited", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ role: "user,admin" })]),
    );
    render(<UserManagementPanel />);

    openEditDialog();
    submitEdit();

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(updateUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(updateUserMock.mock.calls[0]?.[0]).not.toHaveProperty("role");
  });
});
