# Card press feedback

Status: ready-for-agent

## Problem Statement

Task cards give no feedback when pressed. Taps on a card's chips (priority, assignee, due date in `task-chip.tsx`) can also press or start dragging the card, because chips stop only click and keydown.

## Solution

Pointer-driven press feedback on the card itself, ported from Kaneo ba0dab7c and 62a19adf:

- a slight scale while pressing the card itself;
- chips stop the press;
- no effect while dragging or with reduced motion.

## User Stories

1. As a Member, I want a card to scale down slightly while I press it, so that it feels responsive.
2. As a Member, I want tapping a chip to open its menu without pressing or dragging the card.
3. As a Member dragging a card, I want no press effect during the drag.
4. As a Member with reduced motion, I want no scaling.

## Implementation Decisions

- **Press state:** a `data-pressed` attribute set on `pointerdown` on the card element itself, and cleared on `pointerup`, `pointercancel`, `pointerleave` and drag start. Not `:active`, which also fires when children are pressed.
- **Style:** `scale(0.98)`, 100 ms ease-out, under `motion-safe` only.
- **Chips:** `task-chip.tsx` stops `pointerdown` and `touchstart` propagation, in addition to click and keydown, so the card's press and the dnd sensors never see them.
- Applied in `task-card.tsx` / `sortable-task-card.tsx`. List rows get no scale.

## Testing Decisions

- A component test:
  - pointerdown on the card sets `data-pressed`, and pointerup clears it;
  - pointerdown on a chip does not set it and does not start a drag (sensor stubbed).

## Out of Scope

- Long-press menus on touch.

## Further Notes

- Grilled 2026-10-17 (Q16, Q20).
