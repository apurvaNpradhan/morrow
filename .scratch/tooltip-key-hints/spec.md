# Key hints in tooltips and menus

Status: ready-for-agent

Blocked by: command-registry merged

## Problem Statement

Hotkeys are discoverable only in the palette and the help dialog. Buttons and menu items that have a hotkey do not show it.

## Solution

A `TooltipLabel` (label + `Kbd` key caps) reads keys from the command registry by hotkey id. Tooltips and menu items for commands with a hotkey show it. The key caps are `aria-hidden`, so accessible names stay just the label.

## User Stories

1. As a Member, I want hovering a toolbar button to show its hotkey, so that I learn shortcuts as I go.
2. As a Member, I want menu items to show their hotkey on the right, in my platform's notation.
3. As a screen-reader user, I want accessible names without key glyphs.
4. As a developer, I want hints to come from the registry, so that a key change updates every hint.

## Implementation Decisions

- One component in the design system: `TooltipLabel({ label, hotkeyId? })`.
  - It formats keys with the registry's display formatter (`display-hotkey.ts`).
  - Key caps are wrapped in `aria-hidden`.
  - There is spacing between label and caps (Kaneo 85d2a849).
- Applied to the sidebar toggle, create task/project, filter, display menu, the sheet header actions and the task menus.
- No hint is shown for a command whose hotkey is disabled for the user.

## Testing Decisions

- A component test asserts the visible caps and the accessible name without them.
- A test asserts that a hint follows the registry declaration.

## Out of Scope

- Rebinding.

## Further Notes

- Grilled 2026-10-17 (Q15). Kaneo 85d2a849 and 23b07b49.
