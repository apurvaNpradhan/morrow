import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  describeStorageError,
  headUploadedObject,
} from "./head-uploaded-object";

function statusError(status: number) {
  return Object.assign(new Error("denied"), {
    $metadata: { httpStatusCode: status },
  });
}

afterEach(() => vi.useRealTimers());

describe("headUploadedObject", () => {
  it("retries while the store answers 403", async () => {
    vi.useFakeTimers();
    const send = vi
      .fn()
      .mockRejectedValueOnce(statusError(403))
      .mockResolvedValue({ ContentLength: 3 });
    const result = headUploadedObject(
      { send },
      "bucket",
      "key",
      new AbortController().signal,
    );
    await vi.advanceTimersByTimeAsync(250);
    expect(await result).toEqual({ ContentLength: 3 });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("fails at once on 404", async () => {
    const send = vi.fn().mockRejectedValue(statusError(404));
    await expect(
      headUploadedObject(
        { send },
        "bucket",
        "key",
        new AbortController().signal,
      ),
    ).rejects.toThrow("denied");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("describeStorageError", () => {
  it("keeps name, status and code but never the message", () => {
    const error = Object.assign(new Error("https://secret?sig=1"), {
      name: "AccessDenied",
      Code: "AccessDenied",
      $metadata: { httpStatusCode: 403 },
    });
    expect(describeStorageError(error)).toEqual({
      name: "AccessDenied",
      status: 403,
      code: "AccessDenied",
    });
  });
});
