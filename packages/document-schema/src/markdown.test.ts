import { describe, expect, it } from "vite-plus/test";
import { jsonToMarkdown, markdownToJSON } from "./markdown";
import { getDocumentSchema } from "./schema";

const schema = getDocumentSchema();

/** One page that holds every node and mark of the schema. */
const SAMPLES: Record<string, string> = {
  paragraph: "A plain paragraph.",
  heading: "## A heading",
  blockquote: "> quoted text",
  bulletList: "- one\n- two",
  orderedList: "1. first\n2. second",
  taskList: "- [ ] open\n- [x] done",
  codeBlock: "```ts\nconst a = 1;\n```",
  horizontalRule: "---",
  hardBreak: "line one  \nline two",
  details:
    "<details>\n<summary>More</summary>\n\nHidden text\n\n- a list\n\n</details>",
  table: "| a   | b   |\n| --- | --- |\n| 1   | 2   |",
  marks: "**bold** *italic* ~~gone~~ `code` [a link](https://example.com)",
  mention: 'Ask [@ id="user1" label="Ada"] today',
  pageLink: "See [[abc123|The plan]] and [[def456]]",
  ticketReference: "Fixes MOR-12 soon",
  assetImage: "Look at ![shot.png](/api/asset/abc123?w=1200&h=800) here",
  attachmentCard: '[report.pdf](/api/asset/def456 "application/pdf 2457600")',
};

const nodeNames = (doc: unknown): string[] => {
  const found: string[] = [];
  const walk = (node: { type?: string; content?: unknown[] }) => {
    if (node.type) found.push(node.type);
    node.content?.forEach((child) => walk(child as typeof node));
  };
  walk(doc as never);
  return found;
};

describe("markdown", () => {
  for (const [name, markdown] of Object.entries(SAMPLES)) {
    it(`round-trips ${name}`, () => {
      const json = markdownToJSON(markdown);
      schema.nodeFromJSON(json).check();
      expect(jsonToMarkdown(json)).toBe(markdown);
      expect(markdownToJSON(jsonToMarkdown(json))).toEqual(json);
    });
  }

  it("is covered by a sample for every node and mark of the schema", () => {
    const used = new Set(
      Object.values(SAMPLES).flatMap((md) => {
        const json = markdownToJSON(md);
        const marks: string[] = [];
        const walk = (node: {
          marks?: { type: string }[];
          content?: unknown[];
        }) => {
          node.marks?.forEach((mark) => marks.push(mark.type));
          node.content?.forEach((child) => walk(child as typeof node));
        };
        walk(json as never);
        return [...nodeNames(json), ...marks];
      }),
    );
    const missing = [
      ...Object.keys(schema.nodes),
      ...Object.keys(schema.marks),
    ].filter((name) => !used.has(name));
    expect(missing).toEqual([]);
  });

  it("does not write block ids", () => {
    const json = markdownToJSON("Hello");
    json.content![0]!.attrs = {
      blockId: "6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001",
    };
    expect(jsonToMarkdown(json)).toBe("Hello");
  });
});
