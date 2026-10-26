import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { documentCollection } from "../collections/document-collection";
import { indexPages } from "../lib/document-tree";

/** A Workspace's pages, indexed for the tree. */
export function useDocuments(workspaceId: string) {
  const { data } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ document: documentCollection })
        .where(({ document }) => eq(document.workspaceId, workspaceId)),
  });
  return useMemo(() => indexPages(data), [data]);
}
