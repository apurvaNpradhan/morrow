import { formatForDisplay, useAppHotkeys } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { closeOverlay, type Command as AppCommand } from "@/app/commands";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/design-system/ui/command";
import { Kbd, KbdGroup } from "@/design-system/ui/kbd";
import { useNavProjects } from "@/projects";
import { openSearch } from "@/search";
import { useTicketLookup } from "@/tasks";
import { useActiveWorkspace, useMyWorkspaces } from "@/workspace";

type PaletteItem = {
  value: string;
  label: string;
  /** What the query matches against; defaults to the label. */
  search?: string;
  shortcut?: string;
  /** Secondary text, for example a project key. */
  hint?: string;
  onRun: () => void;
};

type PaletteGroup = { value: string; label: string; items: PaletteItem[] };

const COMMAND_GROUPS = [
  "task",
  "navigate",
  "create",
  "view",
  "account",
] as const;

/** The palette's search box and list. Mounted only while the palette is open. */
export function PaletteContent({ commands }: { commands: AppCommand[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hotkeys = useAppHotkeys();
  const { data: workspace } = useActiveWorkspace();
  const projects = useNavProjects(workspace?.id);
  const workspaces = useMyWorkspaces();
  const [query, setQuery] = useState("");
  const ticket = useTicketLookup(workspace?.id, query);

  const groups = useMemo<PaletteGroup[]>(() => {
    const run = (action: () => void) => () => {
      closeOverlay("palette");
      action();
    };

    const result = COMMAND_GROUPS.flatMap((group): PaletteGroup[] => {
      const items = commands.flatMap((command): PaletteItem[] =>
        command.group === group
          ? [
              {
                value: command.id,
                label: command.label,
                shortcut: command.hotkey
                  ? formatForDisplay(hotkeys[command.hotkey].hotkey ?? "")
                  : undefined,
                onRun: run(command.run),
              },
            ]
          : [],
      );
      return items.length > 0
        ? [
            {
              value: group,
              label: t(`navigation:commandPalette.groups.${group}`),
              items,
            },
          ]
        : [];
    });

    if (query.trim()) {
      if (workspace && ticket) {
        const id = query.trim().toUpperCase();
        result.push({
          value: "tasks",
          label: t("navigation:commandPalette.groups.tasks"),
          items: [
            {
              value: `task:${id}`,
              label: t("navigation:commandPalette.openTicket", { id }),
              // The title is what a person remembers; the id is what they typed.
              search: `${query} ${ticket.task.title}`,
              hint: ticket.task.title,
              onRun: run(() =>
                navigate({
                  to: "/$slug/tasks/$ticketId",
                  params: { slug: workspace.slug, ticketId: id },
                }),
              ),
            },
          ],
        });
      }
      if (workspace) {
        result.push({
          value: "projects",
          label: t("navigation:commandPalette.groups.projects"),
          items: projects.map((project) => ({
            value: `project:${project.key}`,
            label: project.name,
            search: `${project.name} ${project.key}`,
            hint: project.key,
            onRun: run(() =>
              navigate({
                to: "/$slug/projects/$key",
                params: { slug: workspace.slug, key: project.key },
              }),
            ),
          })),
        });
      }
      result.push({
        value: "workspaces",
        label: t("navigation:commandPalette.groups.workspaces"),
        items: workspaces.map((other) => ({
          value: `workspace:${other.slug}`,
          label: other.name,
          onRun: run(() =>
            navigate({ to: "/$slug", params: { slug: other.slug } }),
          ),
        })),
      });
    }
    if (query.trim()) {
      result.push({
        value: "search",
        label: t("navigation:search.button"),
        items: [
          {
            value: "search:handoff",
            label: t("navigation:commandPalette.searchFor", {
              query: query.trim(),
            }),
            // Always listed, whatever else matched: the way to the full search.
            search: query,
            onRun: () => openSearch(query.trim()),
          },
        ],
      });
    }
    return result.filter((group) => group.items.length > 0);
  }, [
    commands,
    hotkeys,
    navigate,
    projects,
    query,
    t,
    ticket,
    workspace,
    workspaces,
  ]);

  return (
    <Command
      items={groups}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(item: unknown) => {
        const { search, label } = item as PaletteItem;
        return search ?? label;
      }}
    >
      <CommandInput
        placeholder={t("navigation:commandPalette.inputPlaceholder")}
      />
      <CommandPanel>
        <CommandEmpty>{t("navigation:commandPalette.empty")}</CommandEmpty>
        <CommandList>
          {(group: PaletteGroup, groupIndex: number) => (
            <Fragment key={group.value}>
              <CommandGroup items={group.items}>
                <CommandGroupLabel>{group.label}</CommandGroupLabel>
                <CommandCollection>
                  {(item: PaletteItem) => (
                    <CommandItem
                      key={item.value}
                      value={item}
                      onClick={item.onRun}
                      className="px-3"
                    >
                      <span className="flex-1">{item.label}</span>
                      {item.hint && (
                        <span className="text-muted-foreground text-xs">
                          {item.hint}
                        </span>
                      )}
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  )}
                </CommandCollection>
              </CommandGroup>
              {groupIndex < groups.length - 1 && <CommandSeparator />}
            </Fragment>
          )}
        </CommandList>
      </CommandPanel>
      <CommandFooter>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <KbdGroup>
              <Kbd>
                <ArrowUpIcon />
              </Kbd>
              <Kbd>
                <ArrowDownIcon />
              </Kbd>
            </KbdGroup>
            <span>{t("navigation:commandPalette.footer.navigate")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Kbd>
              <CornerDownLeftIcon />
            </Kbd>
            <span>{t("navigation:commandPalette.footer.open")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Kbd>Esc</Kbd>
          <span>{t("navigation:commandPalette.footer.close")}</span>
        </div>
      </CommandFooter>
    </Command>
  );
}
