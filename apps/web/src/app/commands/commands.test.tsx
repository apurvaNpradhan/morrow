import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { findHotkeyConflicts } from "@tanstack/react-hotkeys";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { CommandPalette } from "@/app/components/command-palette";
import { KeyboardShortcutsHelp } from "@/app/components/keyboard-shortcuts-help";
import { AppHotkeysProvider } from "./app-hotkeys-provider";
import { appHotkeys } from "./hotkeys";
import { closeOverlay } from "./overlay-store";

const navigate = vi.fn();
const openCreateTask = vi.fn();
const openSearch = vi.fn();
const capabilities = {
  createProjects: true,
  createTasks: true,
  inviteUsers: true,
  manageRoles: true,
};
let adminAccess = false;

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/workspace", () => ({
  useActiveWorkspace: () => ({ data: { id: "w1", slug: "acme" } }),
  useMyWorkspaces: () => [
    { id: "w1", slug: "acme", name: "Acme" },
    { id: "w2", slug: "side", name: "Side Project" },
  ],
  useWorkspacePermission: () => ({
    canCreateProjects: () => capabilities.createProjects,
    canCreateTasks: () => capabilities.createTasks,
    canInviteUsers: () => capabilities.inviteUsers,
    canManageRoles: () => capabilities.manageRoles,
  }),
  CreateWorkspaceModal: ({ open }: { open: boolean }) =>
    open ? <div>create-workspace-modal</div> : null,
}));

vi.mock("@/projects", () => ({
  useNavProjects: () => [
    { key: "MOR", name: "Morrow", icon: () => null },
    { key: "WEB", name: "Website", icon: () => null },
  ],
  CreateProjectDialog: ({ open }: { open: boolean }) =>
    open ? <div>create-project-dialog</div> : null,
}));

vi.mock("@/tasks", () => ({
  openCreateTask: () => openCreateTask(),
  CreateTaskDialog: () => null,
  useTicketLookup: () => undefined,
}));

vi.mock("@/search", () => ({
  openSearch: (query?: string) => openSearch(query),
  SearchDialog: () => null,
}));

vi.mock("@/members", () => ({
  InviteTeamMemberModal: ({ open }: { open: boolean }) =>
    open ? <div>invite-member-modal</div> : null,
}));

vi.mock("@/admin", () => ({
  useAdminAccess: () => ({ data: adminAccess }),
}));

vi.mock("@/auth", () => ({
  useSignOut: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/app/preferences/set-theme", () => ({ setTheme: vi.fn() }));

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element | Document = document,
) {
  fireEvent.keyDown(target, { key, ...init });
  fireEvent.keyUp(target, { key, ...init });
}

function mount() {
  return render(
    <AppHotkeysProvider>
      <CommandPalette />
      <KeyboardShortcutsHelp />
    </AppHotkeysProvider>,
  );
}

beforeEach(() => {
  adminAccess = false;
  Object.assign(capabilities, {
    createProjects: true,
    createTasks: true,
    inviteUsers: true,
    manageRoles: true,
  });
});

afterEach(() => {
  cleanup();
  closeOverlay();
  navigate.mockReset();
  openCreateTask.mockReset();
  openSearch.mockReset();
});

describe("hotkey registry", () => {
  it("declares no conflicting hotkeys", () => {
    for (const hotkey of Object.values(appHotkeys)) {
      if (!hotkey.hotkey) continue;
      const conflicts = findHotkeyConflicts(hotkey.hotkey, { scope: "all" });
      expect(conflicts).toHaveLength(0);
    }
  });
});

describe("search", () => {
  it("opens with / but not while typing in a field", () => {
    mount();
    press("/");
    expect(openSearch).toHaveBeenCalledTimes(1);
    press("k", { ctrlKey: true });
    press("/", {}, screen.getByRole("combobox"));
    expect(openSearch).toHaveBeenCalledTimes(1);
  });

  it("is handed the typed text by the palette's last row", () => {
    mount();
    press("k", { ctrlKey: true });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: " login bug " },
    });
    fireEvent.click(screen.getByText("navigation:commandPalette.searchFor"));
    expect(openSearch).toHaveBeenCalledWith("login bug");
  });

  it("is reached with Enter when nothing else in the palette matches", () => {
    mount();
    press("k", { ctrlKey: true });
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zzzqqq" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(openSearch).toHaveBeenCalledWith("zzzqqq");
  });

  it("is not offered before anything is typed", () => {
    mount();
    press("k", { ctrlKey: true });
    expect(
      screen.queryByText("navigation:commandPalette.searchFor"),
    ).toBeNull();
  });
});

describe("palette", () => {
  it("toggles with Mod+K, also from inside an input", () => {
    mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    press("k", { ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    press("k", { ctrlKey: true }, screen.getByRole("combobox"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the default groups without projects or workspaces", () => {
    mount();
    press("k", { ctrlKey: true });
    expect(
      screen.getByText("navigation:commands.goProjects"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("navigation:commands.createProject"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("navigation:commands.createTask"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Morrow")).toBeNull();
  });

  it("searches only: letters typed in the palette run nothing", () => {
    mount();
    press("k", { ctrlKey: true });
    const input = screen.getByRole("combobox");
    for (const key of ["w", "c"]) press(key, {}, input);
    expect(screen.queryByText("create-workspace-modal")).toBeNull();
  });

  it("adds matching projects and workspaces while typing, and navigates on Enter", () => {
    mount();
    press("k", { ctrlKey: true });
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Website" } });
    expect(screen.getByText("Website")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Website"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/$slug/projects/$key",
      params: { slug: "acme", key: "WEB" },
    });
  });

  it("hides commands the user lacks the capability for", () => {
    capabilities.createProjects = false;
    capabilities.createTasks = false;
    capabilities.inviteUsers = false;
    mount();
    press("k", { ctrlKey: true });
    expect(screen.queryByText("navigation:commands.createProject")).toBeNull();
    expect(screen.queryByText("navigation:commands.createTask")).toBeNull();
    expect(screen.queryByText("navigation:commands.inviteMember")).toBeNull();
  });

  it("shows admin commands only to instance admins", () => {
    mount();
    press("k", { ctrlKey: true });
    expect(screen.queryByText("navigation:commands.adminUsers")).toBeNull();
    cleanup();
    closeOverlay();
    adminAccess = true;
    mount();
    press("k", { ctrlKey: true });
    expect(
      screen.getByText("navigation:commands.adminUsers"),
    ).toBeInTheDocument();
  });
});

describe("hotkeys", () => {
  it("navigates with g then p", () => {
    mount();
    press("g");
    press("p");
    expect(navigate).toHaveBeenCalledWith({
      to: "/$slug/projects",
      params: { slug: "acme" },
    });
  });

  it("opens create task with c, create project with p c and create workspace with w c", async () => {
    mount();
    press("c");
    await Promise.resolve();
    expect(openCreateTask).toHaveBeenCalledTimes(1);
    press("p");
    press("c");
    await Promise.resolve();
    expect(screen.getByText("create-project-dialog")).toBeInTheDocument();
    // The "c" that ends "p c" must not also create a task.
    expect(openCreateTask).toHaveBeenCalledTimes(1);
    press("w");
    press("c");
    await Promise.resolve();
    expect(screen.getByText("create-workspace-modal")).toBeInTheDocument();
    expect(screen.queryByText("create-project-dialog")).toBeNull();
    expect(openCreateTask).toHaveBeenCalledTimes(1);
  });

  it("does nothing for c and p c when the user cannot create tasks or projects", () => {
    capabilities.createProjects = false;
    capabilities.createTasks = false;
    mount();
    press("c");
    press("p");
    press("c");
    expect(openCreateTask).not.toHaveBeenCalled();
    expect(screen.queryByText("create-project-dialog")).toBeNull();
  });

  it("ignores letter hotkeys while typing in a field", () => {
    mount();
    const field = document.createElement("input");
    document.body.append(field);
    try {
      press("c", {}, field);
    } finally {
      field.remove();
    }
    expect(openCreateTask).not.toHaveBeenCalled();
  });

  it("does nothing while another modal dialog is open", () => {
    mount();
    const modal = document.createElement("div");
    modal.setAttribute("role", "alertdialog");
    document.body.append(modal);
    try {
      press("c");
      press("g");
      press("p");
      press("k", { ctrlKey: true });
    } finally {
      modal.remove();
    }
    expect(openCreateTask).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens one overlay at a time", () => {
    mount();
    press("k", { ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      press("?");
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});

describe("shortcuts help", () => {
  it("opens with ? and lists the declared hotkeys", () => {
    mount();
    press("?");
    expect(
      screen.getByText("navigation:keyboardShortcuts.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("navigation:commands.goProjects"),
    ).toBeInTheDocument();
    expect(screen.getByText("navigation:commands.palette")).toBeInTheDocument();
  });
});
