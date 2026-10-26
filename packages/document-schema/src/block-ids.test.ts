import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vite-plus/test";
import { assignBlockIds } from "./block-ids";
import { getDocumentSchema } from "./schema";
import { isBlockId } from "./validators";

const KEPT = "6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001";

const doc = (...content: JSONContent[]): JSONContent => ({
  type: "doc",
  content,
});
const paragraph = (blockId?: string, text = "x"): JSONContent => ({
  type: "paragraph",
  ...(blockId !== undefined && { attrs: { blockId } }),
  content: [{ type: "text", text }],
});

function sequence() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const blockIds = (node: JSONContent): string[] => [
  ...(node.attrs?.blockId ? [node.attrs.blockId as string] : []),
  ...(node.content ?? []).flatMap(blockIds),
];

describe("assignBlockIds", () => {
  it("gives an id to every block that has none and keeps the ones it has", () => {
    const result = assignBlockIds(
      doc(paragraph(KEPT), paragraph()),
      sequence(),
    );

    expect(blockIds(result)).toEqual([
      KEPT,
      "00000000-0000-4000-8000-000000000001",
    ]);
  });

  it("gives a repeated id to the later block only", () => {
    const result = assignBlockIds(
      doc(paragraph(KEPT, "a"), paragraph(KEPT, "b")),
      sequence(),
    );

    const [first, second] = blockIds(result);
    expect(first).toBe(KEPT);
    expect(second).not.toBe(KEPT);
  });

  it("replaces an id that is not a UUID", () => {
    const result = assignBlockIds(doc(paragraph("not-a-uuid")), sequence());

    expect(blockIds(result).every(isBlockId)).toBe(true);
  });

  it("reaches blocks inside lists, quotes and tables, and not cells or text", () => {
    const result = assignBlockIds(
      doc({
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph()] }],
      }),
      sequence(),
    );

    expect(blockIds(result)).toHaveLength(3);
    expect(new Set(blockIds(result)).size).toBe(3);
  });

  it("produces a document the schema accepts, and leaves its input alone", () => {
    const input = doc(paragraph(), paragraph());
    const result = assignBlockIds(input);

    getDocumentSchema().nodeFromJSON(result).check();
    expect(input.content![0]!.attrs).toBeUndefined();
  });
});
