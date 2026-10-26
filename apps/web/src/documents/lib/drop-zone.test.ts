import { describe, expect, it } from "vite-plus/test";
import { dropZoneAt } from "./drop-zone";

const row = { top: 100, height: 28 };

describe("dropZoneAt", () => {
  it("drops before a row from its top quarter", () => {
    expect(dropZoneAt(101, row)).toBe("before");
  });

  it("drops inside a row from its middle", () => {
    expect(dropZoneAt(114, row)).toBe("inside");
  });

  it("drops after a row from its bottom quarter", () => {
    expect(dropZoneAt(127, row)).toBe("after");
  });
});
