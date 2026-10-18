import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DescriptionCharacterCount } from "./description-character-count";

afterEach(cleanup);

describe("DescriptionCharacterCount", () => {
  it("is hidden below 90% of the limit", () => {
    render(<DescriptionCharacterCount count={89_999} limit={100_000} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the count and limit from 90% of the limit", () => {
    render(<DescriptionCharacterCount count={90_000} limit={100_000} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("90,000 / 100,000");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.className).not.toContain("text-red-600");
  });

  it("turns red over the limit", () => {
    render(<DescriptionCharacterCount count={100_001} limit={100_000} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("100,001 / 100,000");
    expect(status.className).toContain("text-red-600");
    expect(status.className).toContain("dark:text-red-400");
  });
});
