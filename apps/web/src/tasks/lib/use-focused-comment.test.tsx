import { act, cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { FLASH_MS, useFocusedComment } from "./use-focused-comment";

let search: { comment?: string } = {};
vi.mock("@tanstack/react-router", () => ({ useSearch: () => search }));

const scrollIntoView = vi.fn();

function List({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const flashing = useFocusedComment(ref, ids);
  return (
    <ol ref={ref}>
      {ids.map((id) => (
        <li key={id} data-comment-id={id}>
          {id}
        </li>
      ))}
      <output>{flashing ?? "none"}</output>
    </ol>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  search = {};
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  scrollIntoView.mockReset();
});

describe("useFocusedComment", () => {
  it("scrolls to the asked-for comment and marks it for a moment", () => {
    search = { comment: "c2" };
    render(<List ids={["c1", "c2", "c3"]} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      screen.getByText("c2", { selector: "li" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("c2");
    act(() => vi.advanceTimersByTime(FLASH_MS));
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });

  it("waits for the comment to arrive", () => {
    search = { comment: "c2" };
    const { rerender } = render(<List ids={["c1"]} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<List ids={["c1", "c2"]} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a comment in the address, or for an unknown one", () => {
    render(<List ids={["c1"]} />);
    cleanup();
    search = { comment: "gone" };
    render(<List ids={["c1"]} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });

  it("does not scroll again when other comments change", () => {
    search = { comment: "c1" };
    const { rerender } = render(<List ids={["c1"]} />);
    rerender(<List ids={["c1", "c2"]} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
