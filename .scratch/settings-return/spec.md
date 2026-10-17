# Leave Settings to where you came from

Status: ready-for-agent

## Problem Statement

Pressing Esc in Settings, or using the sidebar's leave control, always goes to the workspace Home (`useLeaveSettings` navigates to `/$slug`). It should return to the page the user was on before opening Settings: a project board with its filters, a list, members, and so on.

## Solution

A small in-memory store holds the last app location (pathname + search) that is neither a Settings page nor a full-page task. One router listener updates it after each resolved navigation. Every exit from Settings reads it through `useLeaveSettings`, and falls back to `/$slug` when the stored location is unusable. The full-page task (see `task-full-page`) uses the same store.

## User Stories

1. As a Member, I want Esc in Settings to return me to the board I opened Settings from, with its filters, so that I continue where I was.
2. As a Member, I want the sidebar's leave control to behave the same as Esc, so that every exit agrees.
3. As a Member who opened Settings by a direct link or reloaded it, I want leaving to go to the workspace Home, so that I land somewhere sensible.
4. As a Member whose previous project was deleted while I was in Settings, I want leaving to go to Home, not to a "not found" page.
5. As a Member who renamed the workspace slug in Settings, I want leaving to go to the Home of the new slug.
6. As a Member who moved between several Settings pages, I want leaving to skip them all and return to the page before Settings.

## Implementation Decisions

- Store: a module-level `@tanstack/store` (or a plain module variable with a getter) in `apps/web/src/app/navigation/`, holding `{ pathname, search } | null`. In memory only. No sessionStorage, no history-length trick.
- Listener: one `router.subscribe("onResolved", …)` registered once at app start. It records the location unless the pathname is under `/$slug/settings` or is a full-page task (`/$slug/tasks/$ticketId` opened cold).
- `useLeaveSettings` reads the store and uses it only if all of the following hold:
  - (a) there is a stored location;
  - (b) its first segment equals the current workspace slug;
  - (c) if it is a project route (`/$slug/projects/$key/…`), that key is still in the synced projects collection.
  Otherwise it navigates to `/$slug`. It never rewrites stored paths.
- The sidebar's leave control, `useLeaveSettingsOnEscape` and the palette all go through `useLeaveSettings`. `shouldLeaveOnEscape` is unchanged.
- The store and the validity check are pure helpers beside the hook, and they are tested.

## Testing Decisions

- Drive the rendered router (memory history):
  - open a project board with a filter, then go to Settings, press Esc → board with the same search;
  - open Settings by direct link, press Esc → `/$slug`;
  - go board → Settings, delete the project from the collection, press Esc → `/$slug`.
- A unit test for the validity check covers the three fallback cases and the slug rename.
- Prior art: `should-leave-on-escape.test.ts`, `$slug.test.tsx`.

## Out of Scope

- Remembering locations across reloads.
- A general "back" stack.

## Further Notes

- Grilled 2026-10-17 (Q1, Q2).
