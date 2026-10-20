import { describe, expect, it } from "vite-plus/test";
import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("uses the largest unit that keeps the number readable", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2457600)).toBe("2.3 MB");
    expect(formatBytes(100 * 1024 * 1024)).toBe("100 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });
});
