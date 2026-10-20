import { ASSET_MAX_BYTES } from "@morrow/sync-schemas";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const rpc = vi.hoisted(() => ({
  assets: { createUpload: vi.fn(), finalize: vi.fn() },
}));
vi.mock("@/app/lib/orpc", () => ({ rpc }));

const { uploadAsset } = await import("./upload-asset");

type Sent = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

/** A stand-in for XMLHttpRequest that answers with the status the test sets. */
class FakeRequest {
  static sent: Sent[] = [];
  static status = 200;
  static progress: Array<[number, number]> = [
    [50, 100],
    [100, 100],
  ];
  upload: {
    onprogress?: (event: {
      loaded: number;
      total: number;
      lengthComputable: boolean;
    }) => void;
  } = {};
  onload?: () => void;
  onerror?: () => void;
  status = 0;
  private call: Sent = { method: "", url: "", headers: {}, body: null };
  open(method: string, url: string) {
    this.call.method = method;
    this.call.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.call.headers[name] = value;
  }
  send(body: unknown) {
    this.call.body = body;
    FakeRequest.sent.push(this.call);
    queueMicrotask(() => {
      for (const [loaded, total] of FakeRequest.progress) {
        this.upload.onprogress?.({ loaded, total, lengthComputable: true });
      }
      this.status = FakeRequest.status;
      this.onload?.();
    });
  }
}

const asset = {
  id: "abc123",
  filename: "shot.png",
  kind: "image",
  mimeType: "image/png",
  size: 4,
  width: 2,
  height: 3,
};

beforeEach(() => {
  FakeRequest.sent = [];
  FakeRequest.status = 200;
  rpc.assets.createUpload.mockReset().mockResolvedValue({
    assetId: "abc123",
    uploadUrl: "https://storage.example.test/put?sig=1",
    headers: { "Content-Type": "image/png" },
  });
  rpc.assets.finalize.mockReset().mockResolvedValue(asset);
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
});
afterEach(() => vi.unstubAllGlobals());

const png = () =>
  new File([new Uint8Array(4)], "shot.png", { type: "image/png" });

describe("uploadAsset", () => {
  it("asks for an upload, puts the bytes to the signed URL, finishes it, and reports progress", async () => {
    const progress = vi.fn();

    const uploaded = await uploadAsset("ws1", png(), progress);

    expect(rpc.assets.createUpload).toHaveBeenCalledWith({
      workspaceId: "ws1",
      filename: "shot.png",
      contentType: "image/png",
      size: 4,
    });
    expect(FakeRequest.sent).toEqual([
      {
        method: "PUT",
        url: "https://storage.example.test/put?sig=1",
        headers: { "Content-Type": "image/png" },
        body: expect.any(File),
      },
    ]);
    expect(progress.mock.calls.map(([fraction]) => fraction)).toEqual([0.5, 1]);
    expect(rpc.assets.finalize).toHaveBeenCalledWith({
      workspaceId: "ws1",
      assetId: "abc123",
    });
    expect(uploaded).toEqual(asset);
  });

  it("names a file without a type as binary", async () => {
    await uploadAsset("ws1", new File([new Uint8Array(4)], "data"), vi.fn());

    expect(rpc.assets.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
  });

  it("refuses a file over 100 MB without asking the server", async () => {
    const huge = {
      name: "huge.bin",
      type: "",
      size: ASSET_MAX_BYTES + 1,
    } as File;

    await expect(uploadAsset("ws1", huge, vi.fn())).rejects.toMatchObject({
      data: { code: "UPLOAD_TOO_LARGE" },
    });
    expect(rpc.assets.createUpload).not.toHaveBeenCalled();
  });

  it("fails when the storage service refuses the bytes, and does not finish the upload", async () => {
    FakeRequest.status = 403;

    await expect(uploadAsset("ws1", png(), vi.fn())).rejects.toThrow();
    expect(rpc.assets.finalize).not.toHaveBeenCalled();
  });
});
