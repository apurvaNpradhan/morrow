# Command registry and hotkeys

Status: ready-for-agent

## Problem Statement

Morrow's keyboard layer is a 359-line hand-rolled provider with three registries (plain, sequential, modifier) in React state, and a keydown listener re-bound on every registration. Around it:

- Every shortcut is declared three times: registered with a handler, listed in the command palette, and listed in the help dialog. They drift.
- The palette's `Ctrl+K` is hardcoded `Ctrl`, so it never fires on macOS (Cmd+K).
- The help dialog and the "create workspace" flow are opened by dispatching a fake `KeyboardEvent("?")` on `document`.
- While the palette is open, a 3-character buffer runs commands as you type, so typing `w c` into the search box creates a workspace instead of searching.
- The palette has six commands (Members, create workspace, three themes, shortcuts help) although the app now has projects, members, roles, workspaces, account settings, admin pages, invitations and sign-out.

The owner wants a Linear-style command menu built on TanStack Hotkeys, with one source of truth for commands and keys.

## Solution

A single command registry. Hotkeys (ids, keys, group) are declared once with TanStack Hotkeys' `defineAppHotkeys`. A command list (label, action, optional permission requirement) refers to hotkey ids. The command palette renders the commands, the help dialog is generated from the declared hotkeys, and the hotkeys are bound from the same registry. Overlays (palette, help, create workspace, create project) open through a small shared store, not synthetic events.

Keys: `Mod+K` palette, `Mod+B` sidebar, `?` help, `c` create project, `g h/p/m/s/a` go to Home/Projects/Members/Workspace settings/Account settings, `w c` create workspace, `w s` switch workspace. All are ignored while typing in an input, textarea or contenteditable, except `Mod+K`.

The palette default view shows Navigate, Create, View and Account groups. Typing adds live Projects and Workspaces groups. Commands the user lacks permission for are hidden and their hotkeys disabled.

## User Stories

1. As a Member, I want `Cmd+K` to open the palette on macOS and `Ctrl+K` elsewhere, so that the shortcut matches my platform.
2. As a Member, I want `Mod+K` to work while I am typing in a field, so that I can always reach the palette.
3. As a Member, I want `Mod+K` to close an open palette, so that the same key toggles it.
4. As a Member, I want typing in the palette to only search, so that letters never trigger commands.
5. As a Member, I want Enter to run the highlighted command, so that I can use the palette without a mouse.
6. As a Member, I want the palette to show each command's keys on the right, in my platform's notation, so that I learn the shortcuts.
7. As a Member, I want a short default list of Navigate, Create, View and Account commands, so that the palette is scannable.
8. As a Member, I want `g h` to go to the workspace Home, so that I can navigate without the mouse.
9. As a Member, I want `g p` to go to Projects, so that I can reach my projects quickly.
10. As a Member, I want `g m` to go to Members, so that I can see who is in the workspace.
11. As a Member, I want `g s` to open workspace settings, so that I can configure the workspace.
12. As a Member, I want `g a` to open my account settings, so that I can edit my profile and preferences.
13. As a Member, I want `c` to open the create-project dialog, so that creating a project is one key.
14. As a Member, I want `w c` to open create-workspace and `w s` to open the workspace switcher, so that I can manage workspaces by keyboard.
15. As a Member, I want `Mod+B` to toggle the sidebar on the main layout and in settings, so that I control my screen space.
16. As a Member, I want `?` to open the keyboard shortcuts help, so that I can look up keys.
17. As a Member, I want the help dialog to list every shortcut grouped by Navigate, Create, View and General, so that I can find them.
18. As a Member, I want to search the help dialog, so that I can find one shortcut fast.
19. As a Member, I want the help dialog to show keys in my platform's notation, so that the display matches what I press.
20. As a Member, I want to type a project name or key in the palette and jump to that project, so that I can switch projects quickly.
21. As a Member, I want to type a workspace name and switch to it from the palette, so that I can move between workspaces.
22. As a Member, I want project and workspace results to appear only once I type, so that the palette opens instantly.
23. As a Member, I want to create a project, create a workspace, invite a member, and sign out from the palette, so that common actions are one search away.
24. As a Member, I want to change theme (light, dark, system) and toggle the sidebar from the palette, so that view settings are reachable.
25. As a Member without the permission to create projects or invite members, I want those commands hidden, so that I am not offered actions I cannot take.
26. As a Member without that permission, I want pressing `c` to do nothing, so that hotkeys obey the same rules as the palette.
27. As an instance admin, I want Admin: Users and Admin: Workspaces in the palette, so that I can reach administration pages.
28. As a non-admin, I want admin commands never to appear, so that the palette is not cluttered.
29. As a Member, I want hotkeys to be inert while I type in a field, so that typing `c` never opens a dialog.
30. As a Member, I want Escape in settings to still leave settings, and only when no overlay is open, so that its existing behaviour is unchanged.
31. As a Member, I want only one overlay open at a time, so that opening one closes the other.
32. As a developer, I want each shortcut declared in exactly one place, so that palette, help and handlers cannot drift.
33. As a developer, I want a test that fails when two hotkeys conflict, so that I notice clashes when adding commands.
34. As a developer, I want the old provider and its duplicated shortcut lists deleted, so that there is one keyboard system.
35. As a developer, I want hotkey ids typed, so that commands cannot reference a hotkey that does not exist.

## Implementation Decisions

- Library: `@tanstack/react-hotkeys` (0.14.0) and its `@tanstack/hotkeys` dependency, pinned to the exact version, no caret. It ships no Intent skill, so the library's own types and README are the reference.
- One new area for the keyboard layer owns: the hotkey declaration (`defineAppHotkeys`, registered with the library's `Register` interface so ids are typed), the command list, the overlay store and the hotkey-binding component. It exports a small public surface: a provider to mount once, the command palette's data, the help dialog's data and `openDialog`.
- Hotkey declaration: ids are dotted by group (for example `go.projects`, `create.project`). `meta.group` is one of Navigate, Create, View, General. Display names are not in `meta`; they are looked up by id from i18n.
- Commands: a command has an id, a group, an optional hotkey id, an optional `requires` (permission resource and action, evaluated with the existing workspace-permission hook), an optional admin-only flag, and a `run` function. Labels come from i18n by command id.
- Binding: one component, mounted under the providers, binds every command hotkey with the library hooks and runs the command. It sets `enabled` from the same availability check the palette uses, so hidden commands have inert hotkeys. `ignoreInputs` is on for all hotkeys except `Mod+K`.
- Sequences use the library's sequence support (`g` then a letter, `w` then a letter) with its default timeout.
- Overlay store: a small `@tanstack/store` holding which overlay is open (`palette | help | createWorkspace | createProject | none`). Opening one closes any other. The palette, help dialog, create-workspace modal and create-project dialog read it; commands call `openDialog`. Fake `KeyboardEvent` dispatching is removed.
- `w s` opens the workspace switcher; the switcher keeps owning its own popover and is opened through the same store.
- Palette: groups Navigate, Create, View, Account. With a non-empty query it adds Projects and Workspaces groups, backed by the synced collections, and name matches rank first. There is no Suggestions group and no chord matching inside the palette. The footer keeps navigate/open/close hints.
- Help dialog: keeps search and category sections, now built from the declared hotkeys' groups, with keys formatted by the library's display formatter. The existing key-sequence display component stays.
- Settings Escape handling is unchanged and is not part of the registry.
- No rebinding UI and no custom hotkeys storage. The declaration leaves that possible later.
- Deleted when nothing references them: the old provider and `useRegisterShortcuts`, the shortcuts constants file, the raw keydown listeners in the palette and help dialog, the TipTap comment, and the i18n keys the new labels replace. New keys: command labels by id and palette group names, in the `navigation` namespace.
- Registrations in the sidebar, settings sidebar and workspace switcher that used the old provider are replaced by the single binding component.
- Delivery: a new branch `feat/command-registry` from the current HEAD. Only files for this work are staged; the unrelated uncommitted work stays untouched.

## Testing Decisions

- A good test drives the rendered app surface: press real keys, open the palette, type, and assert what the user sees or which overlay opens. It does not assert on the registry's internals.
- The one seam is the rendered command layer: the palette and help dialog with the real hotkey provider, the overlay store and the permission hook stubbed at its query boundary. Hotkeys are exercised with real `KeyboardEvent`s on `document`.
- Cases: `Mod+K` toggles the palette (also from inside an input); letters typed in the palette search and run nothing; `c`, `g p` and `w c` fire outside inputs and not inside them; a command lacking permission is absent from the palette and its hotkey is inert; typing a project name adds the Projects group and Enter navigates; only one overlay is open at a time; the help dialog lists the declared hotkeys.
- A registry-level test asserts every hotkey id is unique and that the library's conflict check reports none.
- Prior art: `use-keyboard-shortcuts.test.tsx` (hotkey events with providers), `members-table.test.tsx` (rendering with data), `use-workspace-permission.test.tsx` (permission stubbing), `should-leave-on-escape.test.ts`.
- `use-keyboard-shortcuts.test.tsx` is migrated to the new seam and deleted with the provider.
- After implementation, check Mod+K and one chord in the real app.

## Out of Scope

- User-rebindable hotkeys and a keyboard settings page.
- Contextual commands that depend on the current page (project settings, add column, copy link); the command shape supports a later availability condition, but none are added now.
- Recent items, command history and fuzzy-ranking beyond name matches first.
- Roles and admin hotkeys (`g r`, `g d`); those commands are palette-only.
- Task, issue, search and notification commands (none of those exist).
- Changes to the settings Escape behaviour.

## Further Notes

- Decisions were grilled in a session on 2026-10-15 (Q1–Q18).
- The palette placeholder text should drop "apps". Match the new content.
- A hotkey library that is pre-1.0 is accepted for a single-origin personal instance; pin it and revisit on upgrade.
