import { expect, it } from "vite-plus/test";
import {
  getWorkspaceDescription,
  normalizeWorkspaceValues,
} from "./workspace-form-values";

it("trims the name and treats a missing description as empty", () => {
  expect(normalizeWorkspaceValues({ name: "  Acme  " })).toEqual({
    name: "Acme",
    description: "",
  });
});

it("reads the description column before metadata", () => {
  expect(
    getWorkspaceDescription({
      description: "Column",
      metadata: { description: "Meta" },
    }),
  ).toBe("Column");
  expect(getWorkspaceDescription({ metadata: { description: "Meta" } })).toBe(
    "Meta",
  );
  expect(getWorkspaceDescription(null)).toBe("");
});
