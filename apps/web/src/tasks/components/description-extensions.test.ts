import {
  documentExtensions,
  getDocumentSchema,
  schemaSpec,
} from "@morrow/document-schema";
import { describe, expect, it } from "vite-plus/test";
import {
  descriptionExtensions,
  documentExtensionsWithViews,
} from "./description-extensions";

describe("the browser's extension lists", () => {
  it("give the schema the server reads, views and all", () => {
    expect(
      schemaSpec(getDocumentSchema(documentExtensionsWithViews())),
    ).toEqual(schemaSpec(getDocumentSchema(documentExtensions)));
  });

  it("give descriptions the same schema minus what only pages use", () => {
    const names = (specs: ReturnType<typeof schemaSpec>) =>
      specs.nodes.map((node) => node.name);
    const description = schemaSpec(
      getDocumentSchema(descriptionExtensions("")),
    );
    const full = schemaSpec(getDocumentSchema(documentExtensions));

    expect(
      names(full)
        .filter((n) => !names(description).includes(n))
        .sort(),
    ).toEqual([
      "details",
      "detailsContent",
      "detailsSummary",
      "mention",
      "pageLink",
    ]);
    for (const node of description.nodes) {
      expect(full.nodes.find((n) => n.name === node.name)).toMatchObject({
        content: node.content,
        group: node.group,
      });
    }
  });
});
