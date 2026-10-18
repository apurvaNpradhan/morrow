import { describe, expect, it } from "vite-plus/test";
import { ticketReferenceTokenizer } from "./ticket-reference-markdown";

const { start, tokenize } = ticketReferenceTokenizer;
const find = (src: string) => (start as (src: string) => number)(src);
const read = (src: string) => tokenize(src, [], {} as never)?.ticketId;

describe("ticketReferenceTokenizer", () => {
  it("finds a ticket id in running text", () => {
    expect(find("see MOR-12 now")).toBe(4);
    expect(read("MOR-12 now")).toBe("MOR-12");
  });

  it("reads only uppercase keys of two to six characters with a number", () => {
    expect(find("see mor-12")).toBe(-1);
    expect(find("the M-1 key")).toBe(-1);
    expect(find("ABCDEFG-1")).toBe(-1);
    expect(find("MOR-0")).toBe(-1);
    expect(read("MOR-1234567890")).toBeUndefined();
    expect(read("MOR-12a")).toBeUndefined();
  });

  it("leaves ids inside words, paths and keys alone", () => {
    expect(find("xMOR-12")).toBe(-1);
    expect(find("foo-MOR-12")).toBe(-1);
    expect(find("https://example.com/MOR-12")).toBe(-1);
    expect(find("_MOR-12")).toBe(-1);
  });

  it("keeps the id as written and uses it as the token's id", () => {
    expect(tokenize("MOR-12)", [], {} as never)).toEqual({
      type: "ticketReference",
      raw: "MOR-12",
      ticketId: "MOR-12",
    });
  });
});
