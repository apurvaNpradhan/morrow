import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

// The first render loads Tiptap and is slow.
vi.setConfig({ testTimeout: 30_000 });

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/design-system/toast", () => ({ toast }));

const uploadAsset = vi.hoisted(() => vi.fn());
vi.mock("../attachments/upload-asset", () => ({ uploadAsset }));

const { TaskDescriptionEditor } = await import("./task-description-editor");

// The editor loads on demand; the first import transforms Tiptap and is slow.
beforeAll(() => import("./description-markdown-editor"), 60_000);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

/** An upload the test settles by hand. */
function pendingUpload() {
  let resolve!: (asset: unknown) => void;
  let reject!: (error: unknown) => void;
  let progress!: (fraction: number) => void;
  uploadAsset.mockImplementationOnce(
    (_workspaceId: string, _file: File, onProgress: (f: number) => void) => {
      progress = onProgress;
      return new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
    },
  );
  return {
    progress: (fraction: number) => progress(fraction),
    resolve: (asset: unknown) => resolve(asset),
    reject: (error: unknown) => reject(error),
  };
}

const image = {
  id: "abc123",
  filename: "shot.png",
  kind: "image",
  mimeType: "image/png",
  size: 64,
  width: 1200,
  height: 800,
};
const zip = {
  id: "zip789",
  filename: "logs.zip",
  kind: "file",
  mimeType: "application/zip",
  size: 4096,
  width: null,
  height: null,
};

async function mountEditor(props: Partial<{ workspaceId: string }> = {}) {
  const onChange = vi.fn();
  const onAttachReady = vi.fn();
  const onUploadingChange = vi.fn();
  const view = render(
    <TaskDescriptionEditor
      label="Description"
      value="Hello"
      onChange={onChange}
      onAttachReady={onAttachReady}
      onUploadingChange={onUploadingChange}
      {...{ workspaceId: "ws1", ...props }}
    />,
  );
  const surface = await waitFor(
    () => {
      const found = view.container.querySelector<HTMLElement>(".ProseMirror");
      if (!found) throw new Error("editor not ready");
      return found;
    },
    { timeout: 10_000 },
  );
  const editor = (surface as unknown as { editor: Editor }).editor;
  // Uploads become available once the handlers are set after mount.
  await waitFor(() =>
    expect(onAttachReady).toHaveBeenLastCalledWith(expect.any(Function)),
  );
  return {
    ...view,
    surface,
    editor,
    onChange,
    onAttachReady,
    onUploadingChange,
  };
}

const file = (name: string, type: string) =>
  new File([new Uint8Array(4)], name, { type });

const paste = (surface: HTMLElement, files: File[], text = "") =>
  fireEvent.paste(surface, {
    clipboardData: {
      files,
      types: files.length ? ["Files"] : ["text/plain"],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  });

describe("attaching files in the editor", () => {
  it("shows a placeholder with progress while an image uploads, then the image", async () => {
    const { surface, onChange, onUploadingChange } = await mountEditor();
    const upload = pendingUpload();

    paste(surface, [file("shot.png", "image/png")]);

    const placeholder = await waitFor(() => {
      const found = surface.querySelector(".morrow-upload-placeholder");
      if (!found) throw new Error("no placeholder");
      return found;
    });
    expect(placeholder.textContent).toContain("shot.png");
    expect(placeholder.getAttribute("aria-label")).toBe(
      "attachments.uploading:shot.png",
    );
    upload.progress(0.5);
    expect(placeholder.getAttribute("aria-valuenow")).toBe("50");
    expect(onUploadingChange).toHaveBeenLastCalledWith(1);

    upload.resolve(image);

    await waitFor(() =>
      expect(surface.querySelector("img[data-asset-image]")).not.toBeNull(),
    );
    expect(surface.querySelector(".morrow-upload-placeholder")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining("![shot.png](/api/asset/abc123?w=1200&h=800)"),
    );
    expect(onUploadingChange).toHaveBeenLastCalledWith(0);
    expect(uploadAsset).toHaveBeenCalledWith(
      "ws1",
      expect.any(File),
      expect.any(Function),
    );
  });

  it("puts any other file in as a card with its name", async () => {
    const { surface, onChange } = await mountEditor();
    const upload = pendingUpload();

    paste(surface, [file("logs.zip", "application/zip")]);
    upload.resolve(zip);

    await waitFor(() =>
      expect(
        surface.querySelector("[data-type='attachment-card']"),
      ).not.toBeNull(),
    );
    expect(surface.textContent).toContain("logs.zip");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining(
        '[logs.zip](/api/asset/zip789 "application/zip 4096")',
      ),
    );
  });

  it("takes a dropped file the same way", async () => {
    const { editor, surface, onChange } = await mountEditor();
    const upload = pendingUpload();
    const event = new Event("drop", { cancelable: true }) as Event & {
      dataTransfer: unknown;
      clientX: number;
      clientY: number;
    };
    event.dataTransfer = { files: [file("logs.zip", "application/zip")] };
    event.clientX = 0;
    event.clientY = 0;
    // jsdom has no layout; with nothing under the pointer the file goes in at the cursor.
    document.elementFromPoint = () => null;

    // jsdom has no layout to turn the pointer into a position, so the plugin
    // is called as ProseMirror would.
    const handled = editor.view.someProp("handleDrop", (handle) =>
      handle(editor.view, event as DragEvent, null as never, false),
    );
    upload.resolve(zip);

    expect(handled).toBe(true);
    await waitFor(() =>
      expect(
        surface.querySelector("[data-type='attachment-card']"),
      ).not.toBeNull(),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining("logs.zip"),
    );
  });

  it("removes the placeholder and says why when an upload fails", async () => {
    const { surface, onChange } = await mountEditor();
    const upload = pendingUpload();
    paste(surface, [file("big.bin", "application/octet-stream")]);
    await waitFor(() =>
      expect(
        surface.querySelector(".morrow-upload-placeholder"),
      ).not.toBeNull(),
    );
    onChange.mockClear();

    upload.reject(new Error("network"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      "attachments.uploadFailed:big.bin",
    );
    expect(surface.querySelector(".morrow-upload-placeholder")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("leaves a paste that carries text as text", async () => {
    const { surface } = await mountEditor();

    paste(surface, [file("cells.png", "image/png")], "a\tb\nc\td");

    expect(uploadAsset).not.toHaveBeenCalled();
  });

  it("takes no files without a workspace to upload to", async () => {
    const view = render(
      <TaskDescriptionEditor
        label="Description"
        value="Hello"
        onChange={vi.fn()}
      />,
    );
    const surface = await waitFor(() => {
      const found = view.container.querySelector<HTMLElement>(".ProseMirror");
      if (!found) throw new Error("editor not ready");
      return found;
    });

    paste(surface, [file("shot.png", "image/png")]);

    expect(uploadAsset).not.toHaveBeenCalled();
    expect(surface.querySelector(".morrow-upload-placeholder")).toBeNull();
  });

  it("opens the file picker from the attach button and uploads what is chosen", async () => {
    const { onAttachReady, surface } = await mountEditor();
    const attach = onAttachReady.mock.calls.at(-1)![0] as () => void;
    const click = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(function (this: HTMLInputElement) {
        Object.defineProperty(this, "files", {
          value: [file("notes.pdf", "application/pdf")],
        });
        this.onchange?.(new Event("change"));
      });
    const upload = pendingUpload();

    attach();

    expect(click).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        surface.querySelector(".morrow-upload-placeholder"),
      ).not.toBeNull(),
    );
    upload.resolve({
      ...zip,
      filename: "notes.pdf",
      mimeType: "application/pdf",
    });
    await waitFor(() =>
      expect(
        surface.querySelector("[data-type='attachment-card']"),
      ).not.toBeNull(),
    );
  });

  it("opens an image full size when it is clicked", async () => {
    const { editor, surface } = await mountEditor();
    editor.commands.setContent("![shot.png](/api/asset/abc123?w=1200&h=800)", {
      contentType: "markdown",
    });
    await waitFor(() =>
      expect(surface.querySelector("img[data-asset-image]")).not.toBeNull(),
    );
    const node = editor.state.doc.firstChild!.firstChild!;

    editor.view.someProp("handleClickOn", (handle) =>
      handle(editor.view, 1, node, 1, new MouseEvent("click"), true),
    );

    const preview = await waitFor(() => {
      const found = document.body.querySelector<HTMLImageElement>(
        "[data-slot='dialog-popup'] img",
      );
      if (!found) throw new Error("no preview");
      return found;
    });
    expect(preview.getAttribute("src")).toBe("/api/asset/abc123?w=1200&h=800");
    expect(
      document.body
        .querySelector("[data-slot='dialog-popup'] a")
        ?.getAttribute("href"),
    ).toBe("/api/asset/abc123");
  });
});

describe("an editor inside a parent that re-renders with new callbacks", () => {
  it("settles instead of re-registering on every render, and enables the attach button", async () => {
    const renders = { count: 0 };
    function Composer() {
      useEffect(() => {
        renders.count += 1;
      });
      const [attach, setAttach] = useState<(() => void) | null>(null);
      const [, setBusy] = useState(false);
      return (
        <>
          <TaskDescriptionEditor
            label="Comment"
            value=""
            onChange={() => {}}
            workspaceId="ws1"
            onAttachReady={(open) => setAttach(() => open)}
            onUploadingChange={(running) => setBusy(running > 0)}
          />
          <button disabled={attach === null}>attach</button>
        </>
      );
    }

    const { getByText } = render(<Composer />);

    await waitFor(() => expect(getByText("attach")).toBeEnabled(), {
      timeout: 10_000,
    });
    const settled = renders.count;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(renders.count).toBe(settled);
    expect(settled).toBeLessThan(10);
  });
});

describe("several files added together", () => {
  it("become separate cards, in the order they were added", async () => {
    const { surface, onChange } = await mountEditor();
    const names = ["a.zip", "b.zip", "c.zip"];
    const uploads = names.map(() => pendingUpload());

    paste(
      surface,
      names.map((name) => file(name, "application/zip")),
    );
    await waitFor(() =>
      expect(
        surface.querySelectorAll(".morrow-upload-placeholder"),
      ).toHaveLength(3),
    );
    names.forEach((name, i) =>
      uploads[i]!.resolve({ ...zip, id: `id${i}`, filename: name }),
    );

    await waitFor(() =>
      expect(
        surface.querySelectorAll("[data-type='attachment-card']"),
      ).toHaveLength(3),
    );
    const saved = onChange.mock.calls.at(-1)![0] as string;
    expect(saved.match(/\[(.)\.zip\]/g)).toEqual([
      "[a.zip]",
      "[b.zip]",
      "[c.zip]",
    ]);
    expect(saved.match(/\n\n\[/g)).toHaveLength(3);
  });
});

describe("clicking a file card", () => {
  async function cardFor(markdown: string) {
    const { editor, surface } = await mountEditor();
    editor.commands.setContent(markdown, { contentType: "markdown" });
    const card = await waitFor(() => {
      const found = surface.querySelector<HTMLElement>(
        "button.morrow-attachment-card",
      );
      if (!found) throw new Error("no card");
      return found;
    });
    return card;
  }

  it("previews a PDF in a frame, once, with ways to open or download it", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const card = await cardFor(
      '[r.pdf](/api/asset/def456 "application/pdf 10")',
    );

    fireEvent.click(card);

    const frame = await waitFor(() => {
      const found = document.body.querySelector<HTMLIFrameElement>(
        "[data-slot='dialog-popup'] iframe",
      );
      if (!found) throw new Error("no preview");
      return found;
    });
    expect(frame.getAttribute("src")).toBe("/api/asset/def456");
    expect(frame.getAttribute("title")).toBe("r.pdf");
    const popup = document.body.querySelector("[data-slot='dialog-popup']")!;
    expect(
      popup.querySelector("a[target='_blank']")?.getAttribute("href"),
    ).toBe("/api/asset/def456");
    expect(popup.querySelector("a[download]")?.getAttribute("href")).toBe(
      "/api/asset/def456?download=1",
    );
    expect(open).not.toHaveBeenCalled();
    expect(document.body.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("does nothing when a file a browser cannot show is clicked", async () => {
    const card = await cardFor(
      '[logs.zip](/api/asset/zip789 "application/zip 4096")',
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    fireEvent.click(card);

    expect(assign).not.toHaveBeenCalled();
    expect(document.body.querySelector("iframe")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("downloads only from the download button", async () => {
    const card = await cardFor(
      '[r.pdf](/api/asset/def456 "application/pdf 10")',
    );
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    fireEvent.click(
      card.parentElement!.querySelector(".morrow-attachment-download")!,
    );

    expect(assign).toHaveBeenCalledWith("/api/asset/def456?download=1");
    expect(document.body.querySelector("iframe")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("plays a video inline instead of showing a card", async () => {
    const { editor, surface } = await mountEditor();
    editor.commands.setContent('[v.mp4](/api/asset/vid123 "video/mp4 2048")', {
      contentType: "markdown",
    });

    const video = await waitFor(() => {
      const found = surface.querySelector("video");
      if (!found) throw new Error("no video");
      return found;
    });
    expect(video.getAttribute("src")).toBe("/api/asset/vid123");
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(surface.querySelector("button.morrow-attachment-card")).toBeNull();
  });
});
