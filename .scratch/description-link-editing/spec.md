# Edit links inline in the task description

Status: ready-for-agent

## Problem Statement

The description editor (`task-description-editor.tsx`, TipTap StarterKit v3, which includes Link) renders links but offers no way to add, edit or remove one other than pasting.

## Solution

Port Kaneo 9431c144. The editor's bubble toolbar gets a link button that turns the toolbar into a URL field:

- Enter applies, Esc cancels;
- an existing link shows edit and remove;
- bare domains get `https://`, and email addresses become `mailto:`;
- the toolbar anchors to the selection start;
- links use a themed, legible colour.

## User Stories

1. As a Member, I want to select text and add a link from the toolbar, so that I do not paste raw URLs.
2. As a Member, I want to edit or remove an existing link in place.
3. As a Member, I want `example.com` to become `https://example.com` and `a@b.co` to become `mailto:a@b.co`.
4. As a Member, I want Esc in the URL field to cancel only the link edit, not close the sheet.
5. As a Member, I want links in the description to be readable in light and dark themes.

## Implementation Decisions

- New files beside the editor: `bubble-link-editor.tsx`, `normalize-link-href.ts` (pure, tested) and `selection-start-anchor.ts`.
- `normalize-link-href` allows only http, https and mailto. Anything else is rejected, and the field shows an error.
- Esc in the field stops propagation, so the sheet and full page do not leave (consistent with `shouldLeaveOnEscape`).
- Link colour comes from a design-system token, not a hard-coded value.

## Testing Decisions

- Unit tests for `normalize-link-href`: bare domain, path, email, `javascript:`, whitespace.
- Component test: select text → add link → Enter → anchor present; edit; remove; Esc cancels and the sheet stays open.

## Out of Scope

- Link previews and unfurling.
- Links in comments (follow-up if the comment composer shares the editor).

## Further Notes

- Grilled 2026-10-17 (Q15).
- Kaneo files: `editor/bubble-link-editor.tsx`, `normalize-link-href.ts`, `selection-start-anchor.ts`.
