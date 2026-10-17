# Task copy actions, including branch name

Status: ready-for-agent

Blocked by: command-registry merged

## Problem Statement

There is no way to get a git branch name for a task. The other copy actions are scattered:

- the sheet header has copy ID and copy as Markdown (`task-sheet-header.tsx`);
- the task menu has only Copy link;
- the palette has none.

## Solution

A pure `branchName(ticketId, title)` helper and five copy commands in the registry: branch name, ID, title, link, Markdown. The task menu, the right-click menu and the palette show them as one Copy group. Only copy branch name gets a hotkey.

## User Stories

1. As a Member, I want "Copy branch name" to give me `mor-12-external-links-on-a-task`, so that I can start a branch that matches the task.
2. As a Member, I want copy ID, title, link and Markdown in the same group, in the task menu, the right-click menu and the palette, so that copying works the same everywhere.
3. As a Member, I want `Mod+Shift+.` to copy the focused or open task's branch name.
4. As a Member, I want a short toast saying what was copied.

## Implementation Decisions

- **`branchName`** in `apps/web/src/tasks/lib/branch-name.ts`, with its test beside it:
  - prefix is the lowercased ticket id (`mor-12`);
  - title is lowercased and normalised (NFKD, combining marks removed), with runs of anything outside `a-z0-9` replaced by a single `-`, and leading/trailing `-` trimmed;
  - the whole name is capped at 60 characters, cutting at the last `-` before the cap, with no trailing `-`;
  - an empty title slug gives just `mor-12`.
  - The result is always a valid git ref (no `..`, `~^:?*[\`, spaces, or trailing `.`/`.lock`), and the test asserts this.
- **Commands:** `task.copyBranch`, `task.copyId`, `task.copyTitle`, `task.copyLink`, `task.copyMarkdown`.
  - Available when a task is open or focused.
  - They reuse `taskUrl`, `taskAsMarkdown` and the existing `copy` action in `use-task-actions.ts`.
  - The sheet header's existing items use the same commands.
- **Hotkey:** `task.copyBranch` = `Mod+Shift+.`, added to the registry's conflict test.
- **Menus:** a Copy group, either a submenu or a separator block, in `task-context-menu.tsx` and the task more menu.

## Testing Decisions

- **Unit tests for `branchName`:**
  - plain title;
  - punctuation and emoji;
  - accents;
  - all-symbol title;
  - an over-long title cut at a word boundary;
  - git-ref validity across a set of nasty titles.
- **Component test:** the context menu shows the five items; choosing one writes the expected text (clipboard stubbed).
- **Hotkey test:** with a task focused, the hotkey copies the branch name.

## Out of Scope

- Git provider integrations, and branches linked to tasks.
- A configurable branch pattern.

## Further Notes

- Grilled 2026-10-17 (Q13, Q14).
- Kaneo `branch-name.ts` caps the title part at 50 characters and can leave a trailing dash; this spec avoids that.
