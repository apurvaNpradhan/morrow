import type { LabelRow } from "@morrow/sync-schemas";
import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { labelCollection } from "../collections/label-collection";
import { sortLabels } from "../lib/label-order";

/** A Workspace's labels in their order, and by id. */
export function useLabels(workspaceId: string) {
  const { data } = useLiveSuspenseQuery({
    query: (q) =>
      q
        .from({ label: labelCollection })
        .where(({ label }) => eq(label.workspaceId, workspaceId)),
  });
  return useMemo(() => {
    const labels = sortLabels(data);
    return {
      labels,
      labelById: new Map<string, LabelRow>(
        labels.map((label) => [label.id, label]),
      ),
    };
  }, [data]);
}
