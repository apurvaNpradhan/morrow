import {
  attributeProblem,
  getDocumentSchema,
  isBlockId,
  type WorkspaceRefs,
} from "@morrow/document-schema";
import * as Y from "yjs";
import { DOCUMENT_FRAGMENT } from "./empty-document";

/** What the write check found in a Yjs update. */
export type UpdateFindings = {
  /** The Yjs client ids that wrote structs in the update; deletes are not counted. */
  clientIds: Set<number>;
  /** Whether the update adds content (a delete set alone does not). */
  inserts: boolean;
  /** Why the update must be refused, or null when it passes. */
  problem: string | null;
  /** Whether the update names mentions or page links, which need the Workspace's members and pages. */
  needsRefs: boolean;
};

const schema = getDocumentSchema();
const NODE_NAMES = new Set(
  Object.keys(schema.nodes).filter((name) => name !== "doc" && name !== "text"),
);
const MARK_NAMES = new Set(Object.keys(schema.marks));
const ATTRIBUTE_NAMES = new Set(
  Object.values(schema.nodes).flatMap((type) =>
    Object.keys(type.spec.attrs ?? {}),
  ),
);
const attributesOf = (name: string) =>
  new Set(Object.keys(schema.nodes[name]?.spec.attrs ?? {}));

const MAX_ATTRIBUTE_TEXT = 4_000;

/** y-tiptap writes a mark that may overlap itself as `name--hash`. */
const markName = (key: string) => key.replace(/--[A-Za-z0-9+/=_-]*$/, "");

function plainValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length <= MAX_ATTRIBUTE_TEXT;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) {
    return value.length <= 64 && value.every((item) => plainValue(item));
  }
  return false;
}

/** Text that a browser would fetch or run if it ended up in an `src` or `href`. */
const LOADS_ELSEWHERE =
  /^\s*(?:https?:|ftp:|javascript:|data:|vbscript:|blob:|file:|\/\/)/i;

const idKey = (client: number, clock: number) => `${client}:${clock}`;

/** The attributes an update sets, by the element they belong to. */
type ElementAttributes = { name: string; attrs: Record<string, unknown> };

/**
 * Decodes a Yjs update and checks it against the page schema without any page
 * state: every struct must be an XML element or text of a known name inside
 * the `default` fragment, text with known marks, or an attribute with a plain
 * value; elements keep to their schema attributes; and the attributes that
 * point outside the page (asset sources, links, mentions, page links, ids)
 * pass the package's validators. An attribute of an element that is not in this
 * update can only be a block id, which is a UUID.
 *
 * `refs` is read only when the update holds a mention or a page link.
 */
export async function inspectUpdate(
  update: Uint8Array,
  refs: () => Promise<WorkspaceRefs>,
): Promise<UpdateFindings> {
  const findings: UpdateFindings = {
    clientIds: new Set(),
    inserts: false,
    problem: null,
    needsRefs: false,
  };
  const refuse = (problem: string) => {
    findings.problem ??= problem;
    return findings;
  };

  let decoded: ReturnType<typeof Y.decodeUpdate>;
  try {
    decoded = Y.decodeUpdate(update);
  } catch {
    return refuse("The update cannot be decoded");
  }

  const elements = new Map<string, ElementAttributes>();
  const orphanAttributes: { name: string; value: unknown }[] = [];
  const marks: { name: string; value: unknown }[] = [];

  for (const struct of decoded.structs) {
    findings.clientIds.add(struct.id.client);
    if (!(struct instanceof Y.Item)) continue;
    const { content } = struct;
    if (content instanceof Y.ContentDeleted) continue;
    findings.inserts = true;

    if (
      typeof struct.parent === "string" &&
      struct.parent !== DOCUMENT_FRAGMENT
    ) {
      return refuse("Content outside the page");
    }

    if (content instanceof Y.ContentString) continue;
    if (content instanceof Y.ContentFormat) {
      if (!MARK_NAMES.has(markName(content.key))) {
        return refuse(`Unknown mark ${content.key}`);
      }
      marks.push({ name: markName(content.key), value: content.value });
      continue;
    }
    if (content instanceof Y.ContentType) {
      const { type } = content;
      if (type instanceof Y.XmlText) continue;
      if (type instanceof Y.XmlElement) {
        if (!NODE_NAMES.has(type.nodeName)) {
          return refuse(`Unknown node ${type.nodeName}`);
        }
        elements.set(idKey(struct.id.client, struct.id.clock), {
          name: type.nodeName,
          attrs: {},
        });
        continue;
      }
      return refuse("Unsupported content");
    }
    if (content instanceof Y.ContentAny && content.arr.length === 1) {
      const value = content.arr[0];
      if (!plainValue(value)) return refuse("Unsupported attribute value");
      if (struct.parentSub === null) {
        // Replacing an attribute that exists is encoded against the old value
        // and names neither the node nor the attribute, so only the value is
        // checked: no text that loads from elsewhere.
        if (typeof value === "string" && LOADS_ELSEWHERE.test(value)) {
          return refuse("An attribute points outside the Workspace");
        }
        continue;
      }
      const owner =
        struct.parent instanceof Y.ID
          ? elements.get(idKey(struct.parent.client, struct.parent.clock))
          : undefined;
      if (owner) owner.attrs[struct.parentSub] = value;
      else orphanAttributes.push({ name: struct.parentSub, value });
      continue;
    }
    return refuse("Unsupported content");
  }

  for (const element of elements.values()) {
    const allowed = attributesOf(element.name);
    for (const name of Object.keys(element.attrs)) {
      if (!allowed.has(name)) {
        return refuse(`Unknown attribute ${name} on ${element.name}`);
      }
    }
  }
  for (const { name, value } of orphanAttributes) {
    if (!ATTRIBUTE_NAMES.has(name)) return refuse(`Unknown attribute ${name}`);
    // Only a block id may change on a node the update does not create.
    if (name === "blockId") {
      if (value !== null && value !== undefined && !isBlockId(value)) {
        return refuse("blockId is not a UUID");
      }
    } else if (SENSITIVE_ATTRIBUTES.has(name)) {
      return refuse(`Attribute ${name} cannot change after the node exists`);
    }
  }

  const needsRefs = [...elements.values()].some(
    ({ name }) => name === "mention" || name === "pageLink",
  );
  findings.needsRefs = needsRefs;
  const workspaceRefs = needsRefs ? await refs() : EMPTY_REFS;
  for (const element of elements.values()) {
    const problem = attributeProblem(
      element.name,
      element.attrs,
      workspaceRefs,
    );
    if (problem) return refuse(problem);
  }
  for (const mark of marks) {
    if (mark.value === null || mark.value === undefined) continue;
    if (typeof mark.value !== "object" || Array.isArray(mark.value)) {
      return refuse(`Mark ${mark.name} has no attributes`);
    }
    const attrs = mark.value as Record<string, unknown>;
    if (!Object.values(attrs).every((value) => plainValue(value))) {
      return refuse(`Unsupported attribute on mark ${mark.name}`);
    }
    const problem = attributeProblem(mark.name, attrs, workspaceRefs);
    if (problem) return refuse(problem);
  }
  return findings;
}

const EMPTY_REFS: WorkspaceRefs = {
  memberIds: new Set(),
  documentIds: new Set(),
};

/** Attributes that point outside the page or name something in it; set when a node is created. */
const SENSITIVE_ATTRIBUTES = new Set([
  "src",
  "id",
  "docId",
  "ticketId",
  "filename",
  "mimeType",
  "size",
  "title",
  "label",
]);
