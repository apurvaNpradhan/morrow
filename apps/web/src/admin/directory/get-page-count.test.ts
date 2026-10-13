import { expect, it } from "vite-plus/test";
import { getPageCount } from "./get-page-count";

it("always reports at least one page", () => {
  expect(getPageCount(0, 20)).toBe(1);
});

it("rounds partial pages up", () => {
  expect(getPageCount(20, 20)).toBe(1);
  expect(getPageCount(21, 20)).toBe(2);
});
