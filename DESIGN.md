---
version: alpha
name: Morrow
description: Morrow's web design system, adopted from the Keyline system. Keyboard-first,
  near-monochrome surfaces, 1px hairlines instead of shadows, Inter with ss03, one inverted
  primary action, and color held back for status and category glyphs. Two equal themes, Dark
  (the signature, the default) and Light, built from the same token names. Values below are
  Dark with the Light equivalent noted inline. Reference the token, never a raw literal.
colors:
  # Grounds. The ladder flips: Dark gets lighter as it rises, Light rises to white and recesses into greys.
  canvas: "#07080a"            # light: #fbfbfc   page / app-window background
  surface: "#0d0d0d"           # light: #ffffff   cards, panels, popovers, palette body
  surface-elevated: "#101111"  # light: #f4f4f5   inputs, tertiary buttons, active pill-tab, toasts
  surface-card: "#121212"      # light: #ececee   selected rows, keycaps, icon tiles, switch track (off)
  surface-deep: "#18191a"      # light: #e4e4e7   rare nested well, code chip
  # Borders
  hairline: "#242728"                       # light: #e4e4e7   every card, input, nav, footer edge
  hairline-soft: "rgba(255,255,255,0.08)"   # light: rgba(17,18,20,0.06)  list separators, overlay borders
  hairline-strong: "rgba(255,255,255,0.16)" # light: rgba(17,18,20,0.16)  field stroke, outline button
  # Text
  ink: "#f4f4f6"       # light: #111214   headlines
  body: "#cdcdcd"      # light: #3d3e42   paragraphs
  charcoal: "#d3d3d4"  # light: #2c2d30   lead paragraphs
  mute: "#9c9c9d"      # light: #68696e   metadata, captions, section labels
  ash: "#6a6b6c"       # light: #9c9da2   placeholders and disabled labels only (below 4.5:1)
  stone: "#434345"     # light: #c9cacd   disabled icons only, never text
  fg: "#ffffff"        # light: #111214   interactive labels, links, row titles
  fg-mute: "rgba(255,255,255,0.72)" # light: rgba(17,18,20,0.68)  secondary text on surfaces
  # Action
  primary: "#ffffff"          # light: #111214   the only filled button color; always the inverse of canvas
  primary-pressed: "#e8e8e8"  # light: #2c2d30
  on-primary: "#000000"       # light: #ffffff
  focus: "#9a9a9a"            # light: #888888   2px ring, 2px offset, 3:1 or more on every surface; focus stays monochrome
  # Accents. Status and category glyphs only, each with a -soft tint behind it
  accent-blue: "#57c1ff"      # light: #0a6fae   soft: rgba(87,193,255,0.15) / rgba(10,111,174,0.10)
  accent-red: "#ff6161"       # light: #bf2d36   soft: rgba(255,97,97,0.15) / rgba(191,45,54,0.10)
  accent-green: "#59d499"     # light: #13774a   soft: rgba(89,212,153,0.15) / rgba(19,119,74,0.10)
  accent-yellow: "#ffc533"    # light: #8f5e00   soft: rgba(255,197,51,0.15) / rgba(143,94,0,0.12)
  key-bg-start: "#121212"     # light: #ffffff   keycap gradient top
  key-bg-end: "#0d0d0d"       # light: #ececee   keycap gradient bottom
typography:
  font-sans: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"  # always with "calt","kern","liga","ss03"
  font-mono: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
  display-xl:     { fontSize: 64px, lineHeight: 1.1,  fontWeight: 600, letterSpacing: 0 }      # hero only, once
  display-lg:     { fontSize: 56px, lineHeight: 1.17, fontWeight: 500, letterSpacing: 0.2px }
  heading-xl:     { fontSize: 24px, lineHeight: 1.6,  fontWeight: 500, letterSpacing: 0.2px }
  heading-lg:     { fontSize: 22px, lineHeight: 1.15, fontWeight: 500, letterSpacing: 0 }
  heading-md:     { fontSize: 20px, lineHeight: 1.4,  fontWeight: 500, letterSpacing: 0.2px }  # card / settings group title
  heading-sm:     { fontSize: 18px, lineHeight: 1.4,  fontWeight: 500, letterSpacing: 0.2px }  # window / dialog title
  body-lg:        { fontSize: 18px, lineHeight: 1.6,  fontWeight: 400 }
  body-md:        { fontSize: 16px, lineHeight: 1.6,  fontWeight: 400 }                        # list rows
  body-strong:    { fontSize: 16px, lineHeight: 1.4,  fontWeight: 500, letterSpacing: 0.2px }
  body-sm:        { fontSize: 14px, lineHeight: 1.6,  fontWeight: 400 }                        # default app copy
  body-sm-strong: { fontSize: 14px, lineHeight: 1.6,  fontWeight: 500, letterSpacing: 0.2px }
  caption-md:     { fontSize: 13px, lineHeight: 1.4,  fontWeight: 400, letterSpacing: 0.1px }  # metadata
  caption-sm:     { fontSize: 12px, lineHeight: 1.5,  fontWeight: 400, letterSpacing: 0.4px }  # badges, section labels
  button-md:      { fontSize: 14px, lineHeight: 1.6,  fontWeight: 500, letterSpacing: 0.2px }
  code-sm:        { fontFamily: font-mono, fontSize: 13px, lineHeight: 1.5, fontWeight: 400 }
spacing:
  2xs: 2px
  xs: 4px
  sm: 8px        # base unit
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  section: 96px
rounded:
  # Keyline names. --radius is 0.5rem; Tailwind's rounded-* map onto these as noted.
  none: 0px      # full-bleed structure
  xs: 4px        # keycaps, badges, code chips            (rounded, rounded-sm)
  sm: 6px        # rows, menu items                       (rounded-md)
  md: 8px        # buttons, inputs, list cards, tiles     (rounded-lg)
  lg: 10px       # cards, dialogs, settings panels        (rounded-2xl)
  xl: 16px       # command palette window                 (rounded-[1rem])
  full: 9999px   # pill tabs, switches, avatars
shadow:
  overlay: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.6)"  # light: 0 0 0 1px rgba(17,18,20,0.04), 0 16px 40px rgba(17,18,20,0.14)
size:
  control: 36px
  control-sm: 28px
  control-lg: 44px
  content: 1240px
---

# Morrow

A keyboard-first workspace where the product's chrome is quiet and near-monochrome. This file is
the design contract for `apps/web`: a guide for people and an agent-readable summary of the
tokens. It adopts the Keyline system and keeps Morrow's own name.

## Where it lives

| What | Where |
| --- | --- |
| Tokens (`:root` and `.dark`), `@theme inline` mapping | `apps/web/src/index.css` |
| Components | `apps/web/src/design-system/ui/`, added with `pnpm dlx shadcn@latest add @coss/<name>` |
| Registry and aliases | `apps/web/components.json` (`base-nova`, Tailwind v4, `@coss` registry) |
| Component conventions | the `coss` skill and https://coss.com/ui/docs/styling |

The CSS is the runtime source of truth; this file is its serialization. Keep them in sync.

## Mapping Keyline onto our token names

Components keep the coss token names; Keyline supplies the values. Do not rename tokens in
components.

| Keyline | Web (coss) |
| --- | --- |
| `canvas` | `background`, `sidebar` |
| `surface` | `card`, `popover` |
| `surface-elevated` | `secondary`, `muted` |
| `surface-card` | `accent`, `sidebar-accent` |
| `hairline` | `border`, `sidebar-border` |
| `hairline-soft` | `hairline-soft` |
| `hairline-strong` | `input` |
| `ink` / `fg` | `foreground`, `*-foreground` on surfaces |
| `mute` | `muted-foreground`, `sidebar-foreground` |
| `primary` / `on-primary` | `primary` / `primary-foreground` |
| `focus` | `ring` |
| `accent-red` | `destructive`, `destructive-foreground` |
| `accent-blue` / `-green` / `-yellow` | `info` / `success` / `warning` (and their `-foreground`) |
| `key-bg-start` / `key-bg-end` | `key-start` / `key-end` |
| `shadow-overlay` | `shadow-overlay` |

Keyline tokens with no CSS variable yet: `body`, `charcoal`, `ash`, `stone`, `fg-mute`,
`surface-deep`, `primary-pressed` and the accent `-soft` tints. Use `foreground` or
`muted-foreground`, optionally with an opacity step, until one of them is needed often enough to
earn a token.

## Themes

- Dark is the signature and the default (the device preference defaults to `dark`); Light is
  equal, not an afterthought. `system` follows the OS with `prefers-color-scheme`, and the manual
  choice always wins.
- **The ladder flips direction.** Dark gets lighter as it rises (`canvas` to `surface-card`);
  Light rises to white (`surface`) and recesses into greys for wells, inputs and selection. Name
  the role and both themes come out right.
- `primary` is always the inverse of `canvas`: a white button in Dark, a black one in Light.
- Accents are lightened for Dark and deepened for Light so accent text passes 4.5:1 everywhere.

## Color

- **Grounds:** pages and app windows sit on `background`. Cards, panels, popovers and the palette
  are `card` / `popover`. Inputs, tertiary buttons, active pill-tabs and toasts are
  `secondary` / `muted`. Selected rows, keycaps and icon tiles are `accent`.
- **Borders:** every card, input, nav and footer edge is 1px `border`. `hairline-soft` for list
  separators and translucent overlays, `input` (`hairline-strong`) for field strokes and the
  outline button.
- **Text:** headlines and interactive labels `foreground`; metadata, captions and section labels
  `muted-foreground`.
- **Action:** `primary` is the only filled button color.
- **Accents** (`info`, `destructive`, `success`, `warning`): status icons in toasts, toned
  badges, category glyphs in icon tiles, and `destructive` for field errors and irreversible
  actions. Never on body text, links or surfaces. Status always pairs the color with a word or
  icon, never color alone.
- **Focus:** a 2px solid `ring` at 2px offset on every interactive element. Inputs also brighten
  their border.
- Use the semantic Tailwind classes (`bg-card`, `text-muted-foreground`, `border-input`). Never
  hardcode a hex value or a raw `neutral-*` shade in a component.

## Typography

- One family, Inter, always with `font-feature-settings: "calt", "kern", "liga", "ss03"` on
  `body`; the alternate `g` is part of the voice.
- Mono (JetBrains Mono) is for code, IDs, slugs and shortcut strings (`code-sm`).
- **App screens:** window and dialog titles `heading-sm`, card and settings group titles
  `heading-md`, default copy `body-sm`, list rows `body-md`, metadata `caption-md`, section
  labels `caption-sm` in `muted-foreground`. Never use `display-*` inside the app.
- **Marketing and auth pages:** headline `display-xl` (once), section heads `display-lg`, body
  `body-md`.
- Letter-spacing stays slightly positive (0.1 to 0.4px) at small sizes; never track display type
  tighter than 0, so headings do not use `tracking-tight`.
- No more than two weights in one view: 400 and 500, with 600 for the page heading.

## Spacing and layout

- 8px base with 2, 4 and 12px steps for inline gaps.
- **App:** window padding 16px; group gaps 24px; list rows pack 2px apart inside an 8px inset.
- **Pages:** content max 1240px with 24px gutters.
- Cards pad 24px, or 16px for compact panels. Never pad cards 32px or more.
- Control heights: 36px buttons and fields, 28px toolbars and pill-tabs, 44px search bars and the
  command palette query row.

## Elevation and shape

- Depth is the surface ladder plus hairlines. Cards, frames, inputs and buttons cast no shadow.
- The only shadow is `shadow-overlay`, for things that float over content: the command palette,
  toasts, popover menus, selects, tooltips, dialogs and sheets. Switch and menu-checkbox thumbs
  keep their small shadow, which is part of the control.
- Radii follow the `rounded` map in the frontmatter. `rounded-full` is for pill-tabs, switches,
  avatars and dots. Do not mix rounded and sharp corners in one view.

## Components

Restyle the existing `ui/` components rather than adding parallel ones.

| Need | Use |
| --- | --- |
| Button (primary, secondary, outline, ghost) | `ui/button.tsx`; one primary per window or sheet |
| Keycap | `ui/kbd.tsx`, with the `key-start` to `key-end` gradient and a hairline |
| Text field | `ui/input.tsx`, `ui/input-group.tsx`, `ui/textarea.tsx` |
| Pill tabs | segmented filters (Base UI tabs) |
| Switch | `ui/switch.tsx`, in settings rows inside a compact card |
| Badge | `ui/badge.tsx`, accent text on a soft tint |
| Toast | `ui/toast.tsx`, past-tense confirmation with a status icon |
| Command palette | `ui/command.tsx` (Ctrl/Cmd K); sidebar items as command rows |
| Card | `ui/card.tsx` |

- Built on Base UI through coss. Compose overlays with `render` (not `asChild`) and state on
  `data-*` attributes (`data-slot`, `data-variant`, `data-size`, and Base UI's `data-open`,
  `data-checked`, `data-pressed`).
- Variants use `class-variance-authority`; classes merge with `cn` from `@/design-system/cn`.
- Every interactive element shows a focus ring on `:focus-visible`; disabled drops to reduced
  opacity.
- The `#root` wrapper has `isolation: isolate` and `body` is `position: relative`, which Base UI
  needs so portaled popups stack correctly on iOS Safari 26+.

## Iconography

- Icons come from `lucide-react`: 16px, 1.5px stroke, round caps, `currentColor`. Use them for
  functional affordances (chevrons, checks, close); no decorative icon chips or monogram
  placeholders.
- Keyboard shortcuts are keycaps, never icons. No emoji as decoration.

## Motion

- State changes ease out over 120 to 160ms (hover, press, switch) using `--ease-out`. Popovers
  and tooltips take about 200ms, overlays 300ms at most. The palette opens with a fade and a 4px
  rise; toasts slide up 8px.
- Press feedback is a small scale on primary actions.
- Honor `prefers-reduced-motion`: drop movement, keep opacity. `index.css` already neutralizes
  movement on the overlay `data-slot`s.

## Voice and content

- Write like a fast tool talks: short, concrete, verb first. "Search files", "Invite member".
- Sentence case for everything: buttons, headings, menu items, tabs.
- Address the reader as *you*.
- Name keys with keycaps: "Press Cmd K", never "press command plus K".
- Toasts confirm in past tense and name the specific thing that changed ("Member invited"), drop
  the trailing period, and never say "successfully". Errors say what failed and what to do
  ("Sync failed. Check your connection.").
- Empty states point to the first action.
- Loading states show skeletons, not "Loading..." text. Text is for a button that is busy
  ("Saving...").
- No emoji in UI chrome, no exclamation marks, no superlatives.
- All copy lives in static i18n keys (`packages/i18n/en-US.json`).

## Do's and Don'ts

- Do keep one continuous ground per page; no alternating section colors.
- Do let one `primary` button lead each window or sheet.
- Do rank information with the surface ladder and hairlines, not color.
- Do reach for an existing `ui/` component, or add one from the `@coss` registry, before
  building a custom one.
- Don't add drop shadows to cards, tint the primary button, or use accents on chrome.
- Don't introduce a brand hue or a second accent.
- Don't use `card` or `popover` as a page background, or `accent` as a general fill.
- Don't ship Inter without `ss03`.
