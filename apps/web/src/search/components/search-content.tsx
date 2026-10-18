import { useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { closeOverlay } from "@/app/commands";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/design-system/ui/command";
import { useLabels } from "@/labels";
import { useWorkspaceMembers } from "@/members";
import {
  useProjectColumnsWithoutSuspense,
  useProjectsWithoutSuspense,
} from "@/projects";
import { useTicketLookup } from "@/tasks";
import {
  buildSearchGroups,
  type SearchGroup,
  type SearchItem,
} from "../lib/search-groups";
import { getSearchSeed } from "../lib/search-seed";
import { useDebouncedValue } from "../lib/use-debounced-value";
import {
  MIN_SERVER_QUERY_LENGTH,
  useWorkspaceSearch,
} from "../queries/use-workspace-search";
import { SearchRow } from "./search-row";

/** How long typing must pause before the server is asked. */
const SERVER_DEBOUNCE_MS = 150;

/** The search box and results. Mounted only while the dialog is open. */
export function SearchContent({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("navigation");
  const navigate = useNavigate();
  const [query, setQuery] = useState(getSearchSeed);
  const text = query.trim();
  const settled = useDebouncedValue(text, SERVER_DEBOUNCE_MS);

  const remote = useWorkspaceSearch(workspace.id, settled);
  const ticketTask = useTicketLookup(workspace.id, text);
  const ticketColumns = useProjectColumnsWithoutSuspense(
    ticketTask?.task.projectId,
  );
  const projects = useProjectsWithoutSuspense(workspace.id);
  const { labels } = useLabels(workspace.id);
  const members = useWorkspaceMembers(workspace.id);

  const serverWanted = settled.length >= MIN_SERVER_QUERY_LENGTH;
  const groups = useMemo<SearchGroup[]>(
    () =>
      text === ""
        ? []
        : buildSearchGroups({
            slug: workspace.slug,
            query: text,
            remote: serverWanted ? remote.data : undefined,
            ticket: ticketTask && {
              id: ticketTask.task.id,
              ticketId: `${ticketTask.projectKey}-${ticketTask.task.number}`,
              title: ticketTask.task.title,
              category:
                ticketColumns.find(
                  (column) => column.id === ticketTask.task.columnId,
                )?.category ?? "unstarted",
            },
            projects,
            labels,
            members,
          }),
    [
      text,
      workspace.slug,
      serverWanted,
      remote.data,
      ticketTask,
      ticketColumns,
      projects,
      labels,
      members,
    ],
  );

  function open(item: SearchItem) {
    closeOverlay("search");
    void navigate(item.to as never);
  }

  const emptyMessage =
    text === ""
      ? t("search.hint")
      : remote.isFetching
        ? t("search.searching")
        : t("search.empty", { query: text });

  return (
    // The server's answer already is the filter: the list must not narrow it further.
    <Command
      items={groups}
      filter={null}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(item: unknown) => (item as SearchItem).value}
    >
      <CommandInput placeholder={t("search.placeholder")} />
      <CommandPanel>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandList>
          {(group: SearchGroup, groupIndex: number) => (
            <Fragment key={group.value}>
              <CommandGroup items={group.items}>
                <CommandGroupLabel>
                  {t(`search.groups.${group.value}`)}
                </CommandGroupLabel>
                <CommandCollection>
                  {(item: SearchItem) => (
                    <CommandItem
                      key={item.value}
                      value={item}
                      onClick={() => open(item)}
                      className="gap-2 px-3"
                    >
                      <SearchRow item={item} query={text} />
                    </CommandItem>
                  )}
                </CommandCollection>
              </CommandGroup>
              {groupIndex < groups.length - 1 && <CommandSeparator />}
            </Fragment>
          )}
        </CommandList>
      </CommandPanel>
    </Command>
  );
}
