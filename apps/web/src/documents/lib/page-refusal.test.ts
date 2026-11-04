import { describe, expect, it } from "vite-plus/test";
import { isRetryable, refusalOf, retryAfterMs } from "./page-refusal";

describe("refusalOf", () => {
  it("reads the code from a fetch error's body", () => {
    const error = Object.assign(new Error("Bad Request"), {
      status: 400,
      json: { code: "INVALID_UPDATE", message: "unknown node" },
    });
    expect(refusalOf(error)).toEqual({ code: "INVALID_UPDATE", status: 400 });
  });

  it("reads the code from a stream error's details", () => {
    const error = Object.assign(new Error("conflict"), {
      status: 409,
      details: '{"code":"SCHEMA_MISMATCH","message":"newer"}',
    });
    expect(refusalOf(error)).toEqual({ code: "SCHEMA_MISMATCH", status: 409 });
  });

  it("takes the status from a plain error's message", () => {
    const error = new Error(
      'Failed to create document: 404 {"code":"DOCUMENT_NOT_FOUND"}',
    );
    expect(refusalOf(error)).toEqual({
      code: "DOCUMENT_NOT_FOUND",
      status: 404,
    });
  });

  it("has no status for a dropped connection", () => {
    expect(refusalOf(new TypeError("Failed to fetch"))).toEqual({
      code: null,
      status: null,
    });
  });
});

describe("isRetryable", () => {
  it("retries a dropped connection, a 5xx and the rate limit", () => {
    expect(isRetryable({ code: null, status: null })).toBe(true);
    expect(isRetryable({ code: null, status: 503 })).toBe(true);
    expect(isRetryable({ code: "RATE_LIMITED", status: 429 })).toBe(true);
  });

  it("retries the code-less 400 the stream gives to the retry of a rate-limited write", () => {
    expect(isRetryable({ code: null, status: 400 })).toBe(true);
  });

  it("ends the session on a code-less answer that waiting will not change", () => {
    expect(isRetryable({ code: null, status: 401 })).toBe(false);
    expect(isRetryable({ code: null, status: 403 })).toBe(false);
    expect(isRetryable({ code: null, status: 413 })).toBe(false);
  });

  it("ends the session on every other refusal", () => {
    for (const code of [
      "FORBIDDEN",
      "DOCUMENT_ARCHIVED",
      "DOCUMENT_TOO_LARGE",
      "SCHEMA_MISMATCH",
      "INVALID_UPDATE",
    ] as const) {
      expect(isRetryable({ code, status: 400 })).toBe(false);
    }
  });
});

describe("retryAfterMs", () => {
  it("reads the seconds a refused write is told to wait", () => {
    const limited = (retryAfter?: string) =>
      Object.assign(new Error("slow down"), {
        status: 429,
        headers: retryAfter === undefined ? {} : { "retry-after": retryAfter },
      });

    expect(retryAfterMs(limited("3"))).toBe(3000);
    expect(retryAfterMs(limited())).toBe(0);
    expect(retryAfterMs(limited("soon"))).toBe(0);
    expect(retryAfterMs(new TypeError("Failed to fetch"))).toBe(0);
  });
});
