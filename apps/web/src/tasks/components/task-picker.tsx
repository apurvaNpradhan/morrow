import { useState } from "react";
import { type TaskHit, useTaskSearch } from "../queries/use-task-search";
import { ColumnMarker } from "./column-marker";
import { FilterOptionList } from "./filter-option-list";

const MAX_SHOWN = 20;

/**
 * A search box over the Workspace's tasks. `choose` leaves out the tasks that
 * may not be picked; `local` are tasks already in memory, matched by title or
 * ticket id as you type, ahead of the server's answer.
 */
export function TaskPicker({
  workspaceId,
  label,
  local = [],
  choose,
  onPick,
}: {
  workspaceId: string;
  label: string;
  local?: readonly TaskHit[];
  choose: (hits: TaskHit[]) => TaskHit[];
  onPick: (task: TaskHit) => void;
}) {
  const [text, setText] = useState("");
  const remote = useTaskSearch(workspaceId, text);

  const needle = text.toLowerCase();
  const nearby = local.filter(
    (hit) =>
      needle === "" ||
      hit.title.toLowerCase().includes(needle) ||
      hit.ticketId.toLowerCase().includes(needle),
  );
  const seen = new Set(nearby.map((hit) => hit.id));
  const hits = choose([
    ...nearby,
    ...remote.filter((hit) => !seen.has(hit.id)),
  ]).slice(0, MAX_SHOWN);

  return (
    <FilterOptionList
      label={label}
      onSearch={setText}
      options={hits.map((hit) => ({
        value: hit.id,
        label: `${hit.ticketId} ${hit.title}`,
        glyph: <ColumnMarker column={{ category: hit.category }} />,
      }))}
      onPick={(id) => {
        const hit = hits.find((candidate) => candidate.id === id);
        if (hit) onPick(hit);
      }}
    />
  );
}
