import type { AnyExtension } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import { DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import {
  BulletList,
  ListItem,
  OrderedList,
  TaskItem,
  TaskList,
} from "@tiptap/extension-list";
import Mention from "@tiptap/extension-mention";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import Text from "@tiptap/extension-text";
import { AssetImage } from "./asset-image";
import { AttachmentCard } from "./attachment-card";
import { BlockIds } from "./block-ids";
import { Details } from "./details";
import { PageLink } from "./page-link";
import { TicketReference } from "./ticket-reference";
import { isAllowedHref } from "./validators";

/**
 * Every node and mark a page or description may hold, with nothing that edits:
 * no keymaps beyond the nodes' own, no undo, no placeholder. The browser adds
 * its views and behaviours on top (see `descriptionExtensions` in the web app), the API
 * reads the same list headlessly. A change here changes the schema, and
 * `schema-fingerprint.test.ts` asks for a `DOCUMENT_SCHEMA_VERSION` bump.
 */
export const documentExtensions: AnyExtension[] = [
  Document,
  Paragraph,
  Text,
  Heading,
  Blockquote,
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  TaskItem.configure({ nested: true }),
  CodeBlock,
  HorizontalRule,
  HardBreak,
  Details.configure({ persist: false }),
  DetailsSummary,
  DetailsContent,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  Bold,
  Italic,
  Strike,
  Code,
  Link.configure({
    openOnClick: "whenNotEditable",
    autolink: true,
    // Only what the validators accept; no `javascript:` from a paste.
    isAllowedUri: (url) => isAllowedHref(url),
    HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
  }),
  Mention,
  PageLink,
  TicketReference,
  AssetImage,
  AttachmentCard,
  BlockIds,
];
