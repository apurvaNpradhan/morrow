import { getDocumentSchema, type WorkspaceRefs } from "@morrow/document-schema";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { describe, expect, it } from "vite-plus/test";
import { DOCUMENT_FRAGMENT } from "./empty-document";
import { inspectUpdate } from "./inspect-update";

const schema = getDocumentSchema();
const BLOCK = "6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c001";
const refs: WorkspaceRefs = {
  memberIds: new Set(["member1"]),
  documentIds: new Set(["page1"]),
};
const lookup = async () => refs;

const text = (value: string, marks?: object[]) => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: object[]) => ({
  type: "paragraph",
  attrs: { blockId: BLOCK },
  content,
});

function updateOf(...blocks: object[]) {
  const doc = prosemirrorJSONToYDoc(
    schema,
    { type: "doc", content: blocks },
    DOCUMENT_FRAGMENT,
  );
  return { doc, update: Y.encodeStateAsUpdate(doc) };
}

/** The update a local edit makes to a document that already exists. */
function edit(doc: Y.Doc, change: (fragment: Y.XmlFragment) => void) {
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array) => updates.push(update));
  doc.transact(() => change(doc.getXmlFragment(DOCUMENT_FRAGMENT)));
  return updates[0]!;
}

describe("inspectUpdate", () => {
  it("passes a page that uses every kind of node and mark", async () => {
    const { update } = updateOf(
      { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
      paragraph(
        text("bold", [{ type: "bold" }]),
        text(" and "),
        text("a link", [
          { type: "link", attrs: { href: "https://example.com" } },
        ]),
        { type: "assetImage", attrs: { src: "/api/asset/abc123", alt: "x" } },
        { type: "ticketReference", attrs: { ticketId: "MOR-12" } },
        { type: "mention", attrs: { id: "member1", label: "Ada" } },
        { type: "pageLink", attrs: { docId: "page1", title: "Plan" } },
      ),
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("item"))] }],
      },
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [paragraph(text("done"))],
          },
        ],
      },
      { type: "codeBlock", attrs: { language: "ts" }, content: [text("a")] },
      {
        type: "attachmentCard",
        attrs: {
          id: "def456",
          filename: "r.pdf",
          mimeType: "application/pdf",
          size: 10,
        },
      },
    );

    const findings = await inspectUpdate(update, lookup);

    expect(findings.problem).toBeNull();
    expect(findings.inserts).toBe(true);
    expect(findings.needsRefs).toBe(true);
  });

  it("reports the client ids that wrote the update", async () => {
    const { doc, update } = updateOf(paragraph(text("hi")));

    const findings = await inspectUpdate(update, lookup);

    expect([...findings.clientIds]).toEqual([doc.clientID]);
  });

  it("passes typing in an existing page", async () => {
    const { doc } = updateOf(paragraph(text("hi")));
    const typing = edit(doc, (fragment) => {
      const block = fragment.get(0) as Y.XmlElement;
      (block.get(0) as Y.XmlText).insert(2, " there");
    });

    expect((await inspectUpdate(typing, lookup)).problem).toBeNull();
  });

  it("says a pure delete inserts nothing", async () => {
    const { doc } = updateOf(paragraph(text("hello")));
    const deletion = edit(doc, (fragment) => {
      const block = fragment.get(0) as Y.XmlElement;
      (block.get(0) as Y.XmlText).delete(0, 3);
    });

    const findings = await inspectUpdate(deletion, lookup);

    expect(findings.problem).toBeNull();
    expect(findings.inserts).toBe(false);
  });

  it("refuses an element the schema does not have", async () => {
    const doc = new Y.Doc();
    const update = edit(doc, (fragment) =>
      fragment.insert(0, [new Y.XmlElement("script")]),
    );

    expect((await inspectUpdate(update, lookup)).problem).toMatch(
      /Unknown node script/,
    );
  });

  it("refuses a mark the schema does not have", async () => {
    const doc = new Y.Doc();
    const update = edit(doc, (fragment) => {
      const block = new Y.XmlElement("paragraph");
      const run = new Y.XmlText();
      fragment.insert(0, [block]);
      block.insert(0, [run]);
      run.insert(0, "x", { blink: {} });
    });

    expect((await inspectUpdate(update, lookup)).problem).toMatch(
      /Unknown mark blink/,
    );
  });

  it("refuses an image from another server and a script link", async () => {
    const foreign = updateOf(
      paragraph({
        type: "assetImage",
        attrs: { src: "https://evil.example.com/p.png", alt: "" },
      }),
    );
    const script = updateOf(
      paragraph(
        text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
      ),
    );

    expect((await inspectUpdate(foreign.update, lookup)).problem).toMatch(
      /image source/,
    );
    expect((await inspectUpdate(script.update, lookup)).problem).toMatch(
      /link/,
    );
  });

  it("refuses a block id that is not a UUID on a new block, and accepts a new one on an existing block", async () => {
    const created = updateOf({
      type: "paragraph",
      attrs: { blockId: "../../x" },
      content: [text("a")],
    });
    const { doc } = updateOf(paragraph(text("a")));
    const fine = edit(doc, (fragment) =>
      (fragment.get(0) as Y.XmlElement).setAttribute(
        "blockId",
        "6f1c1f0e-8f0b-4a53-9a4e-0a55b0a1c002",
      ),
    );

    expect((await inspectUpdate(created.update, lookup)).problem).toMatch(
      /UUID/,
    );
    expect((await inspectUpdate(fine, lookup)).problem).toBeNull();
  });

  it("refuses a mention or page link outside the Workspace", async () => {
    const mention = updateOf(
      paragraph({ type: "mention", attrs: { id: "stranger", label: "X" } }),
    );
    const link = updateOf(
      paragraph({ type: "pageLink", attrs: { docId: "elsewhere", title: "" } }),
    );

    expect((await inspectUpdate(mention.update, lookup)).problem).toMatch(
      /mention/,
    );
    expect((await inspectUpdate(link.update, lookup)).problem).toMatch(
      /page link/,
    );
  });

  it("does not look up the Workspace unless the update needs it", async () => {
    const { update } = updateOf(paragraph(text("plain")));
    let looked = 0;

    await inspectUpdate(update, async () => {
      looked += 1;
      return refs;
    });

    expect(looked).toBe(0);
  });

  it("refuses an attribute the node does not have", async () => {
    const doc = new Y.Doc();
    const update = edit(doc, (fragment) => {
      const block = new Y.XmlElement("paragraph");
      block.setAttribute("onclick", "x");
      fragment.insert(0, [block]);
    });

    expect((await inspectUpdate(update, lookup)).problem).toMatch(
      /Unknown attribute onclick/,
    );
  });

  it("refuses an existing image being pointed at another server", async () => {
    const { doc } = updateOf(
      paragraph({
        type: "assetImage",
        attrs: { src: "/api/asset/abc", alt: "" },
      }),
    );
    const retarget = edit(doc, (fragment) => {
      const image = (fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
      image.setAttribute("src", "https://evil.example.com/pixel.png");
    });
    const harmless = edit(doc, (fragment) => {
      const image = (fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
      image.setAttribute("alt", "A screenshot: the login page");
    });

    expect((await inspectUpdate(retarget, lookup)).problem).toMatch(
      /outside the Workspace/,
    );
    expect((await inspectUpdate(harmless, lookup)).problem).toBeNull();
  });

  it("refuses a first-time attribute that points somewhere on a node that exists", async () => {
    const { doc } = updateOf(
      paragraph({ type: "assetImage", attrs: { src: "/api/asset/abc" } }),
    );
    const first = edit(doc, (fragment) => {
      const image = (fragment.get(0) as Y.XmlElement).get(0) as Y.XmlElement;
      image.removeAttribute("alt");
      image.setAttribute("alt", "x");
      image.setAttribute("filename", "x");
    });

    expect((await inspectUpdate(first, lookup)).problem).toMatch(
      /cannot change/,
    );
  });

  it("refuses content outside the page's fragment and types the page does not use", async () => {
    const root = new Y.Doc();
    const outside = edit(root, () => root.getMap("evil").set("a", 1));
    const nested = edit(new Y.Doc(), (fragment) => {
      const block = new Y.XmlElement("paragraph");
      fragment.insert(0, [block]);
      block.setAttribute("x", new Y.Map() as never);
    });
    const embed = edit(new Y.Doc(), (fragment) => {
      const block = new Y.XmlElement("paragraph");
      const run = new Y.XmlText();
      fragment.insert(0, [block]);
      block.insert(0, [run]);
      run.insertEmbed(0, { image: "x" });
    });

    expect((await inspectUpdate(outside, lookup)).problem).toMatch(/outside/);
    expect((await inspectUpdate(nested, lookup)).problem).not.toBeNull();
    expect((await inspectUpdate(embed, lookup)).problem).toMatch(/Unsupported/);
  });

  it("refuses bytes that are not an update", async () => {
    expect(
      (await inspectUpdate(Uint8Array.of(255, 255, 255, 1), lookup)).problem,
    ).not.toBeNull();
  });
});
