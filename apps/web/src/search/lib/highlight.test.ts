import { SNIPPET_MARK_END, SNIPPET_MARK_START } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { splitByMarks, splitByWords } from "./highlight";

describe("splitByWords", () => {
  it("marks every occurrence of every typed word, in any letter case", () => {
    expect(splitByWords("Fix login bug in Login", "login bug")).toEqual([
      { text: "Fix ", match: false },
      { text: "login", match: true },
      { text: " ", match: false },
      { text: "bug", match: true },
      { text: " in ", match: false },
      { text: "Login", match: true },
    ]);
  });

  it("marks a match at the very start or end of the text", () => {
    expect(splitByWords("Billing app", "billing")).toEqual([
      { text: "Billing", match: true },
      { text: " app", match: false },
    ]);
    expect(splitByWords("my app", "app")).toEqual([
      { text: "my ", match: false },
      { text: "app", match: true },
    ]);
  });

  it("returns the text whole when nothing matches or there are no words", () => {
    expect(splitByWords("Nothing", "zzz")).toEqual([
      { text: "Nothing", match: false },
    ]);
    expect(splitByWords("Nothing", " ?! ")).toEqual([
      { text: "Nothing", match: false },
    ]);
  });

  it("takes regular expression characters in the query literally", () => {
    expect(splitByWords("a (b) c", "(b")).toEqual([
      { text: "a (", match: false },
      { text: "b", match: true },
      { text: ") c", match: false },
    ]);
  });
});

describe("splitByMarks", () => {
  it("splits at the server's markers", () => {
    expect(
      splitByMarks(`the ${SNIPPET_MARK_START}refund${SNIPPET_MARK_END} flow`),
    ).toEqual([
      { text: "the ", match: false },
      { text: "refund", match: true },
      { text: " flow", match: false },
    ]);
  });

  it("returns plain text whole", () => {
    expect(splitByMarks("plain")).toEqual([{ text: "plain", match: false }]);
  });
});
