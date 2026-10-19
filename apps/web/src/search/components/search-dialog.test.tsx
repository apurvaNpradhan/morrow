import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { closeOverlay } from "@/app/commands/overlay-store";
import { openSearch } from "../lib/search-seed";
import { SearchButton } from "./search-button";
import { SearchDialog } from "./search-dialog";

const navigate = vi.fn();
const serverSearch = vi.fn();
let ticket:
  | {
      task: {
        id: string;
        number: number;
        title: string;
        projectId: string;
        columnId: string;
      };
      projectKey: string;
    }
  | undefined;

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/app/lib/orpc", () => ({
  orpc: {
    search: {
      query: {
        queryOptions: ({ input }: { input: { q: string } }) => ({
          queryKey: ["search", input],
          queryFn: () => serverSearch(input.q),
        }),
      },
    },
  },
}));
vi.mock("@/app/commands/hotkeys", () => ({ appHotkeys: {} }));
vi.mock("@/design-system/tooltip-label", () => ({
  TooltipLabel: ({ label }: { label: string }) => label,
}));
vi.mock("@/workspace", () => ({
  useActiveWorkspace: () => ({ data: { id: "w1", slug: "acme" } }),
}));
vi.mock("@/labels", () => ({
  useLabels: () => ({
    labels: [
      { id: "l1", name: "Billing", color: "#ef4444", workspaceId: "w1" },
    ],
  }),
  LabelDot: () => null,
}));
vi.mock("@/members", () => ({
  useWorkspaceMembers: () => [
    {
      userId: "u1",
      user: { name: "Ada Lovelace", email: "ada@example.com", image: null },
    },
  ],
}));
vi.mock("@/projects", () => ({
  CATEGORY_ICONS: { unstarted: () => null, started: () => null },
  ProjectIcon: () => null,
  useProjectsWithoutSuspense: () => [
    { key: "BIL", name: "Billing app", archivedAt: null },
    { key: "OLD", name: "Billing legacy", archivedAt: new Date(0) },
  ],
  useProjectColumnsWithoutSuspense: () => [{ id: "c1", category: "started" }],
}));
vi.mock("@/tasks", () => ({ useTicketLookup: () => ticket }));

const task = (id: string, ticketId: string, title: string) => ({
  id,
  projectId: "p1",
  projectKey: "BIL",
  ticketId,
  title,
  priority: "none",
  category: "started",
  snippet: null,
  archived: false,
  projectArchived: false,
});

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <SearchButton />
      <SearchDialog />
    </QueryClientProvider>,
  );
}

/** The result rows whose text, with whitespace folded, matches. */
function rowNow(pattern: RegExp) {
  return screen
    .queryAllByRole("option")
    .find((option) =>
      pattern.test((option.textContent ?? "").replace(/\s+/g, " ")),
    );
}

async function row(pattern: RegExp) {
  return waitFor(() => {
    const found = rowNow(pattern);
    if (!found) throw new Error(`No result row matches ${pattern}`);
    return found;
  });
}

const type = (value: string) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });

async function open(query?: string) {
  act(() => openSearch(query));
  await screen.findByRole("combobox");
}

beforeEach(() => {
  ticket = undefined;
  serverSearch.mockResolvedValue({ tasks: [], comments: [] });
});

afterEach(() => {
  cleanup();
  closeOverlay();
  navigate.mockReset();
  serverSearch.mockReset();
});

describe("opening", () => {
  it("opens from the sidebar button and starts empty with a hint", async () => {
    mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "search.button" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(await screen.findByText("search.hint")).toBeInTheDocument();
  });

  it("starts with the text the palette handed over", async () => {
    mount();
    await open("billing");
    expect(screen.getByRole("combobox")).toHaveValue("billing");
    expect(rowNow(/Billing app/)).toBeInTheDocument();
  });
});

describe("what is asked of the server, and when", () => {
  it("shows projects, labels and members from one character, without a request", async () => {
    mount();
    await open();
    type("b");
    expect(await row(/Billing app/)).toBeInTheDocument();
    expect(rowNow(/Billing legacy/)).toBeInTheDocument();
    expect(rowNow(/Billing$/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(serverSearch).not.toHaveBeenCalled();
  });

  it("asks once, after typing pauses, with the settled text", async () => {
    mount();
    await open();
    for (const value of ["lo", "log", "logi", "login"]) type(value);
    expect(serverSearch).not.toHaveBeenCalled();
    await waitFor(() => expect(serverSearch).toHaveBeenCalledTimes(1));
    expect(serverSearch).toHaveBeenCalledWith("login");
  });

  it("keeps the previous results until the next ones arrive", async () => {
    let finish: (value: unknown) => void = () => {};
    serverSearch.mockResolvedValueOnce({
      tasks: [task("t1", "BIL-1", "First result")],
      comments: [],
    });
    mount();
    await open();
    type("first");
    expect(await row(/First result/)).toBeInTheDocument();

    serverSearch.mockReturnValueOnce(
      new Promise((resolve) => (finish = resolve)),
    );
    type("second");
    await waitFor(() => expect(serverSearch).toHaveBeenCalledTimes(2));
    expect(rowNow(/First result/)).toBeInTheDocument();

    finish({ tasks: [task("t2", "BIL-2", "Second result")], comments: [] });
    expect(await row(/Second result/)).toBeInTheDocument();
    expect(rowNow(/First result/)).toBeUndefined();
  });

  it("resolves a ticket id at once, without waiting for the server", async () => {
    ticket = {
      projectKey: "BIL",
      task: {
        id: "t9",
        number: 9,
        title: "Nine",
        projectId: "p1",
        columnId: "c1",
      },
    };
    serverSearch.mockReturnValue(new Promise(() => {}));
    mount();
    await open();
    type("BIL-9");
    expect(await row(/BIL-9.*Nine/)).toBeInTheDocument();
  });
});

describe("choosing a result", () => {
  async function results() {
    serverSearch.mockResolvedValue({
      tasks: [task("t1", "BIL-1", "Login task")],
      comments: [
        {
          id: "c1",
          taskId: "t1",
          projectId: "p1",
          projectKey: "BIL",
          ticketId: "BIL-1",
          taskTitle: "Login task",
          authorName: null,
          createdAt: new Date(0),
          snippet: "the login failed",
          archived: false,
          projectArchived: false,
        },
      ],
    });
    mount();
    await open();
    type("login");
    await row(/Login task/);
  }

  it("opens a task on its own page", async () => {
    await results();
    fireEvent.click(await row(/Login task/));
    expect(navigate).toHaveBeenCalledWith({
      to: "/$slug/tasks/$ticketId",
      params: { slug: "acme", ticketId: "BIL-1" },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a comment's task with the comment to show", async () => {
    await results();
    fireEvent.click(await row(/the login failed/));
    expect(navigate).toHaveBeenCalledWith({
      to: "/$slug/tasks/$ticketId",
      params: { slug: "acme", ticketId: "BIL-1" },
      search: { comment: "c1" },
    });
  });

  it("sends a label to the labels settings and a member to the members page", async () => {
    mount();
    await open();
    type("billing");
    fireEvent.click(await row(/Billing$/));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(navigate).toHaveBeenCalledWith({
      to: "/$slug/settings/workspace/labels",
      params: { slug: "acme" },
    });
    await open();
    type("ada");
    fireEvent.click(await row(/Ada Lovelace/));
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/$slug/settings/workspace/members",
      params: { slug: "acme" },
    });
  });

  it("badges an archived project", async () => {
    mount();
    await open();
    type("legacy");
    const legacy = await row(/Billing legacy/);
    expect(legacy).toHaveTextContent("search.archived");
  });
});
