import { describe, expect, it } from "vite-plus/test";
import { filterSlashCommands } from "./slash-commands";

const labelsFor = (query: string) =>
  filterSlashCommands(query).map((command) => command.label);

describe("filterSlashCommands", () => {
  it("lists every block in menu order for an empty query", () => {
    expect(labelsFor("")).toEqual([
      "Text",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Bulleted list",
      "Numbered list",
      "Checklist",
      "Quote",
      "Code block",
      "Divider",
      "Attach file",
      "Table",
    ]);
  });

  it("matches the label ignoring case", () => {
    expect(labelsFor("HEAD")).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
  });

  it("matches the search words as well as the label", () => {
    expect(labelsFor("checkbox")).toEqual(["Checklist"]);
    expect(labelsFor("h2")).toEqual(["Heading 2"]);
  });

  it("finds the attach command by what it does", () => {
    expect(labelsFor("upload")).toEqual(["Attach file"]);
    expect(labelsFor("pdf")).toEqual(["Attach file"]);
  });

  it("ignores spaces around the query", () => {
    expect(labelsFor("  divider ")).toEqual(["Divider"]);
  });

  it("returns nothing when no label or word contains the query", () => {
    expect(labelsFor("zzz")).toEqual([]);
  });
});
