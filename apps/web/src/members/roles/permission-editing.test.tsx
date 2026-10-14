import { defaultRolePayloads } from "@morrow/permissions";
import {
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
import { CustomRoleEditor } from "./components/custom-role-editor";
import { PermissionList } from "./components/permission-list";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("./queries/use-update-workspace-role", () => ({
  useUpdateWorkspaceRole: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("./queries/use-create-workspace-role", () => ({
  useCreateWorkspaceRole: () => ({}),
}));
vi.mock("./queries/use-delete-workspace-role", () => ({
  useDeleteWorkspaceRole: () => ({}),
}));
vi.mock("./queries/use-workspace-roles", () => ({
  useWorkspaceRoles: () => ({}),
}));
vi.mock("@/workspace/queries/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({}),
}));
vi.mock("@/design-system/page-title", () => ({ PageTitle: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/design-system/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockResolvedValue({ success: true });
});

describe("workspace role permission editing", () => {
  it("shows role administration, membership and invitations in read-only role details", () => {
    render(<PermissionList permissions={defaultRolePayloads.admin} readOnly />);
    for (const label of [
      "Change role permissions",
      "Change member roles",
      "Invite members",
      "Edit teams",
    ]) {
      expect(screen.getByRole("switch", { name: label })).toBeChecked();
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
  it("can remove every permission but read access, including all provider administrative rights", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "admin",
          permission: defaultRolePayloads.admin,
          createdAt: new Date(),
        }}
        isDefault
        onDelete={() => {}}
      />,
    );
    for (const control of screen.getAllByRole("switch", { checked: true }))
      fireEvent.click(control);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleName: "admin",
        permission: { workspace: ["read"] },
      }),
    );
  });
  it("also exposes unknown stored permission entries instead of silently retaining them", () => {
    const onToggle = vi.fn();
    render(
      <PermissionList
        permissions={{ extension: ["future-right"] }}
        selected={{ extension: new Set(["future-right"]) }}
        onToggle={onToggle}
      />,
    );
    const storedGrant = screen.getByRole("switch", {
      name: "future-right extension",
    });
    expect(storedGrant).toBeChecked();
    fireEvent.click(storedGrant);
    expect(onToggle).toHaveBeenCalledWith("extension", "future-right");
  });
  it("does not allow adding an unknown permission that is no longer stored", () => {
    render(
      <PermissionList
        permissions={{}}
        selected={{ extension: new Set() }}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.queryByRole("switch", { name: "future-right extension" }),
    ).not.toBeInTheDocument();
  });
});
