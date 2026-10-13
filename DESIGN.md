---
version: alpha
name: Morrow
description: Morrow's web design system. coss UI components on Base UI, a near-neutral
  grayscale ramp, hairline borders, tight radii, and color held back to a single role
  (destructive red). Tokens invert between Light and Dark; values below are Light with
  the Dark equivalent noted inline. Reference the token, never a raw literal.
colors:
  background: "#ffffff"          # dark: #0a0a0a   page and app root
  foreground: "#111111"          # dark: #ededed   primary text and icons
  card: "#ffffff"                # dark: #0f0f0f   cards, dialogs
  card-foreground: "#111111"     # dark: #ededed
  popover: "#ffffff"             # dark: #141414   menus, popovers, surfaces stacked on cards
  popover-foreground: "#111111"  # dark: #ededed
  primary: "#0a0a0a"             # dark: #ffffff   solid fill for the one key action
  primary-foreground: "#ffffff"  # dark: #0a0a0a
  secondary: "#fafafa"           # dark: #141414   quiet fills
  secondary-foreground: "#0a0a0a"# dark: #ededed
  muted: "#fafafa"               # dark: #141414
  muted-foreground: "#666666"    # dark: #9a9a9a   secondary text, metadata
  accent: "#f5f5f5"              # dark: #1a1a1a   hover and selected surface
  accent-foreground: "#0a0a0a"   # dark: #ededed
  destructive: "#b4261a"         # dark: #e0726a   errors and destructive actions
  destructive-foreground: "#8f1d14" # dark: #ec9a94 text on tinted destructive surfaces
  info: "#3b6ea5"                # dark: #6b9bd1   foreground: #2c5282 / #8fb4de
  success: "#2f7d52"             # dark: #4fb083   foreground: #25643f / #7cc9a3
  warning: "#b4690e"             # dark: #d9883a   foreground: #8a500a / #e8a860
  chart: ["#3b6ea5", "#2f7d52", "#b4690e", "#7a5aa6", "#666666"] # dark: #6b9bd1 #4fb083 #d9883a #a38acb #9a9a9a
  border: "#eaeaea"              # dark: #1f1f1f   default hairline
  input: "#d4d4d4"               # dark: #333333   field stroke
  ring: "#888888"                # dark: #777777   focus
  sidebar: "#ffffff"             # dark: #0a0a0a   app chrome
  sidebar-foreground: "#666666"  # dark: #9a9a9a
  sidebar-border: "#eaeaea"      # dark: #1f1f1f
  sidebar-accent: "#f5f5f5"      # dark: #141414   selected nav item
typography:
  font-sans: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
  font-heading: "var(--font-sans)"
  font-mono: "Geist Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
  heading: { fontFamily: font-heading, fontWeight: 600, tracking: tight }
  body:    { fontFamily: font-sans, fontSize: 14-16px, fontWeight: 400 }
  label:   { fontFamily: font-sans, fontSize: 13-14px, fontWeight: 500 }
  mono:    { fontFamily: font-mono, fontSize: 11-13px, fontWeight: 400 }
  sec-label: { fontFamily: font-mono, fontSize: 11px, fontWeight: 500, tracking: 0.08em, transform: uppercase, color: muted-foreground }
spacing:
  base: 4px            # 4, 8, 12, 16, 24, 32, 40
rounded:
  # --radius: 0.5rem. Tailwind maps sm/md/lg/xl to radius -4px / -2px / 0 / +4px.
  sm: 4px    # inline controls
  md: 6px    # buttons and inputs
  lg: 8px    # cards and menus
  xl: 12px   # large or overlay surfaces
  full: 9999px
---

# Morrow

A workspace platform where the content stands out and the chrome disappears. This file is the
design contract for `apps/web`: a guide for people and an agent-readable summary of the tokens.

## Where it lives

| What | Where |
| --- | --- |
| Tokens (`:root` and `.dark`), `@theme inline` mapping | `apps/web/src/index.css` |
| Components | `apps/web/src/components/ui/`, added with `pnpm dlx shadcn@latest add @coss/<name>` |
| Registry and aliases | `apps/web/components.json` (`base-nova`, Tailwind v4, `@coss` registry) |
| Component conventions | the `coss` skill and https://coss.com/ui/docs/styling |

The CSS is the runtime source of truth; this file is its serialization. Keep them in sync.

## Principles

- **Grayscale carries hierarchy.** Tone and hairline borders rank information. There is no brand
  hue. `destructive` is the only hue in the palette, reserved for errors and irreversible actions.
  `info`, `success` and `warning` are muted, low-saturation status tokens (steel blue, green,
  amber) for status components (alerts, toasts, badges) only, always paired with text or an
  icon, never color alone. Charts use the same muted hues (`chart-1` to `chart-5`).
- **Hairlines over shadows.** Separate surfaces with a 1px `border` and a tonal step. Floating
  surfaces (menus, dialogs) may add one diffuse shadow. In Dark, lift with a lighter surface
  (`card` to `popover`), not a heavier shadow.
- **One primary action per view.** `primary` is near-black (white in Dark) and marks the single
  most important action.
- **Mono is the voice of metadata.** IDs, counts, slugs, keyboard shortcuts and section labels
  use `font-mono`; section labels are uppercase and tracked (`sec-label`).
- **Tight radii.** 6px buttons and inputs, 8px cards and menus, 12px overlays, pills only for
  badges, avatars and dots. Do not mix rounded and sharp corners in one view.

## Using the tokens

- Pick a surface by what an element is: `background` is the page, `card` and `popover` sit on
  top of it, `sidebar` is persistent chrome, `secondary`/`muted`/`accent` are quiet fills and
  hover or selected states, never page backgrounds.
- Text: `foreground` for primary, `muted-foreground` for secondary and metadata.
- Use the semantic Tailwind classes (`bg-card`, `text-muted-foreground`, `border-input`). Never
  hardcode a hex value or a raw `neutral-*` shade in a component.
- Hold WCAG AA contrast (4.5:1 for body text).

## Components

- Built on Base UI through coss. Compose overlays with `render` (not `asChild`) and state on
  `data-*` attributes (`data-slot`, `data-variant`, `data-size`, and Base UI's `data-open`,
  `data-checked`, `data-pressed`).
- Variants use `class-variance-authority`; classes merge with `cn` from `@/lib/cn`.
- Every interactive element shows a focus ring on `:focus-visible` using `ring`; disabled drops
  to reduced opacity.
- Icons come from `lucide-react`. Use them for functional affordances (chevrons, checks, close);
  do not add decorative icon chips or monogram placeholders.
- The `#root` wrapper has `isolation: isolate` and `body` is `position: relative`, which Base UI
  needs so portaled popups stack correctly on iOS Safari 26+.

## Motion

Motion clarifies a change; it is never decoration. About 150ms for state changes, 200ms for
popovers and tooltips, 300ms for overlays, using the `--ease-out` token. Press feedback is a
small scale on primary actions. Honor `prefers-reduced-motion`; `index.css` already neutralizes
movement on the overlay `data-slot`s.

## Voice and content

- Title Case for labels, buttons, titles and tabs; sentence case for body, helper text, toasts.
- Name actions with a verb and a noun (`Invite Member`, `Revoke Invitation`), not `OK` or `Confirm`.
- Errors say what happened and what to do next.
- Toasts name the specific thing that changed, drop the trailing period, never say
  "successfully": `Member invited`.
- Empty states point to the first action.
- In-progress states use the present participle with an ellipsis: `Saving...`.
- All copy lives in static i18n keys (`i18n/en-US.json`).

## Do's and Don'ts

- Do rank information with the gray ramp and hairlines, not color.
- Do reach for an existing `ui/` component, or add one from the `@coss` registry, before
  building a custom one.
- Don't introduce a brand hue or a second accent; extend the neutral scale instead.
- Don't use `card` or `popover` as a page background, or `muted`/`accent` as a general fill.
- Don't use more than two font weights in one view (400 and 500; 600 for headings).
