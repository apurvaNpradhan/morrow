# Toast dedupe with shake

Status: ready-for-agent

## Problem Statement

Repeating an action that toasts (a failed save, "Link copied") stacks identical toasts. `design-system/toast.ts` adds a new toast each time.

## Solution

When a toast with the same type and title is already showing, `addToast` does not add another. It shakes the existing toast once and restarts its timer.

## User Stories

1. As a Member, I want pressing "Copy link" five times to show one toast, so that the screen stays clean.
2. As a Member, I want the repeated toast to shake, so that I can see my action registered.
3. As a Member with reduced motion, I want no shake, only the timer restart.

## Implementation Decisions

- The match key is `type + title` (description included if present), not the call site.
- `toast.ts` keeps a map from key to open toast id, cleared when the toast closes.
- On a duplicate it updates the existing toast so that its timeout restarts (`toastManager.update` or close-and-re-add, whichever Base UI supports without a visible flicker), and sets a `data-shake` attribute that is removed on `animationend`.
- **Shake:** a CSS keyframe of about 300 ms with a few px horizontal translate, in `ui/toast.tsx` styles, disabled under `prefers-reduced-motion`.
- Toasts with an action button dedupe the same way.

## Testing Decisions

- A unit test of `toast.ts` with `toastManager` stubbed:
  - a duplicate does not add;
  - a different type or title adds;
  - a key is reusable after close.
- A component test: a duplicate sets `data-shake`.

## Out of Scope

- Toast icon changes (Kaneo 4c89504d; comes with the bulk bar).

## Further Notes

- Grilled 2026-10-17 (Q16, Q21). Kaneo 93f328d7.
