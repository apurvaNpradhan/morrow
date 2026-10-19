# Instant first load

Status: ready-for-agent

Tickets: MOR-41. Follow-up: MOR-52 (service-worker precache, decided after the measurements here).

## Problem Statement

Opening Morrow in a new tab or on a new device shows a blank white page until the app's code has downloaded and run. About 1.19 MB of gzipped JavaScript blocks the first render, and more than half of it (the `commands` chunk, 640 KB gzipped) is the Task description editor and its code highlighting, which most page loads never use. Dark is the default theme, so most people see a white flash before the app appears. Text can also change font after it first paints. Nothing is measured today for a cold load, only for warm reloads.

## Solution

The app appears faster and without a flash, with no change to what it does or to sync.

- The page paints at once in the user's theme. When the browser remembers a signed-in user on a wide screen, it also shows an outline of the sidebar in the right place, so the app seems to have opened already.
- The description editor loads only when it is needed. Until then a Task's description shows as plain text, then becomes editable. The editor starts loading when the browser is idle and when someone hovers or focuses a Task, so it is usually ready before a click.
- The main body font starts downloading alongside the JavaScript.
- Library code is split into a few stable groups, so a release re-downloads only the app's own code.
- Cold-load timings are measured before and after each change and posted to the ticket.

## User Stories

1. As a Member opening Morrow in a new tab, I want the page to paint in my theme straight away, so that I do not see a white flash.
2. As a dark-theme Member, I want the loading screen to be dark, so that my eyes are not hit by a bright page.
3. As a light-theme Member, I want the loading screen to be light, so that it matches the app that follows.
4. As a Member who uses the system theme, I want the loading screen to follow my operating system's colour scheme, so that it matches the app.
5. As a returning Member on a wide screen, I want to see the sidebar outline while the app loads, so that the app feels like it has already opened.
6. As a Member who keeps the sidebar closed by default, I want the loading screen to show no sidebar outline, so that the layout does not jump when the app appears.
7. As a Member on a narrow screen, I want the loading screen to show no sidebar outline, so that it matches the mobile layout, where the sidebar is a sheet.
8. As a signed-out visitor, I want the login page to load without a sidebar outline, so that I am not shown an app I cannot use.
9. As a signed-out visitor on a sign-up or invitation page, I want no sidebar outline, so that the page looks right.
10. As a Member, I want the loading screen to disappear once the first page is ready, so that it never covers the real app.
11. As a Member, I want the loading screen to disappear on pages with no sidebar too, so that I am not stuck on it.
12. As a Member, I want no layout jump when the loading screen hands over to the app, so that the page does not flicker.
13. As a Member opening a Task for the first time in a session, I want to read its description at once, so that I am not waiting on the editor to download.
14. As a Member, I want the description to become editable as soon as the editor is ready, so that I can edit without reloading.
15. As a Member who hovers or focuses a Task, I want the editor to start loading, so that it is ready by the time I click.
16. As a Member on a slow connection, I want the board to appear without waiting for the editor code, so that I can start working sooner.
17. As a Member on a slower laptop or phone, I want less JavaScript to parse before the first paint, so that the app starts faster.
18. As a Member, I want text to appear in the final font from the first paint where possible, so that it does not visibly change.
19. As a Member who has the app open across a release, I want only changed files to re-download, so that updates are quick.
20. As a developer, I want a cold-load measurement, so that I can show whether each change helped.
21. As a developer, I want measurements on a fast and a throttled network, so that I can see the effect where it matters most.
22. As a developer, I want the splash colours checked against the stylesheet, so that a theme change cannot silently leave the splash out of date.
23. As a developer, I want a check that the editor and highlighting code stay out of the entry chunks, so that the saving does not quietly disappear.
24. As a maintainer, I want the service-worker decision made after measuring, so that it is justified by numbers.
25. As a Member with a blocked storage setting, I want the app to load normally, so that a missing preference never breaks the page.

## Implementation Decisions

The work lands as five commits, in this order, with a cold-load measurement posted to MOR-41 after each. Vendor groups go last because they rename chunks and would muddy the earlier comparisons.

1. **Cold measurement.** The existing reload measurement script gets a cold mode: fresh browser cache, signed in. It records first paint and time to the first Task card on the large demo Workspace, unthrottled and with a "Fast 4G" profile. It is run by hand and prints medians, as it does now. The baseline is posted to the ticket.
2. **Lazy description editor.** The Tiptap, ProseMirror and lowlight code moves out of the entry chunks into a chunk loaded on demand. While it loads, the description is shown as plain read-only text. The chunk is requested when the browser is idle after first paint and when a Task is hovered or focused. The `auth` and `set-theme` chunks are audited for the same kind of leak and any found are fixed in the same commit.
3. **Inline splash.**
   - A splash element is a sibling of the app root, fixed over the page. It is not inside the root, because the app only renders into an empty root.
   - Inline CSS in the HTML paints it. A small inline script reads the theme and the sidebar-open preference from the stored device preferences, which are kept as one row under a keyed wrapper in local storage. The system theme resolves from the operating system's colour scheme.
   - The sidebar outline shows only when all of these hold: the owner stamp is in local storage (the same signal used to seed the session), the path is not an auth route, the viewport is at least the `md` breakpoint, and the sidebar-open preference is on. Otherwise only the themed background paints.
   - The outline is 15rem wide, matching the app sidebar's own override (not the 16rem default in the sidebar component). There is no stored sidebar width, so none is read.
   - The splash is removed on the router's first resolved navigation, which covers every route in one place.
   - Only the background, sidebar and border colours, for light and dark, are copied into the inline CSS.
   - Storage reads are wrapped so blocked or malformed storage falls back to the dark default and the themed background only.
   - The previously written sidebar cookie is never read by the app, so the splash ignores it.
4. **Font preload.** A build step adds a preload link (`as="font"`, `type="font/woff2"`, `crossorigin`) for the hashed Inter latin variable file only. Other subsets and Geist Mono load on demand. The font package already sets `font-display: swap`.
5. **Vendor groups.** A few stable groups: React and React DOM, Tiptap and ProseMirror, Electric and TanStack DB, Sentry, and Base UI. This is a build-configuration change only.

Nothing changes in sync, the API, the database or the service layer.

## Testing Decisions

A good test checks what a user or the build output shows, not how the code is arranged inside. Four seams, highest first:

1. **Built output (the one new seam).** One test runs a real production build and inspects the built HTML and files. It checks that:
   - the splash colours match the stylesheet's colours for light and dark;
   - the splash is a sibling of the app root;
   - the font preload link names a file that exists;
   - the entry chunks do not contain Tiptap, ProseMirror or lowlight.
2. **First navigation through the router.** A component test using the existing router test setup checks that the splash is removed after the first resolved navigation, and that the sidebar outline shows only under the four conditions above.
3. **Task description.** A component test using the existing Vitest setup checks that the description is readable before the editor chunk resolves, then becomes editable after.
4. **Cold-load measurement.** Run by hand, not a CI gate. Its numbers are posted to MOR-41 and not asserted.

Prior art: the existing component tests beside `commands`, the router-based tests under the web app, and the manual reload measurement script in the end-to-end folder. Vendor groups have no test of their own; the built-output test covers them by checking that the entry stays small.

## Out of Scope

- A service worker or any precache (MOR-52, decided after these measurements).
- A JavaScript size budget that fails the build; add it once the post-editor number is known.
- A remembered or user-set sidebar width; none exists.
- One chunk per npm package.
- Server-side rendering, and any change to sync, the data cache (MOR-2), the API or the database.
- Preloading Geist Mono or the non-Latin font subsets.

## Further Notes

- Baseline from a fresh build: 47 `modulepreload` links already emitted; about 1.19 MB gzipped on the critical path; `commands` 2.0 MB raw (640 KB gzipped), `auth` 620 KB raw, `set-theme` 267 KB raw; the OPFS worker is 1.7 MB raw and loaded separately.
- `/assets/*` is already served `immutable`, so warm reloads take JavaScript from the HTTP cache; the main gains are on cold loads and after releases.
- Reference: performance.dev, "How is Linear so fast", section "Making the first load feel instant".
