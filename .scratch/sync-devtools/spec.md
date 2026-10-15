# Sync devtools panel

Status: ready-for-agent

## Problem Statement

Members, users, Workspaces and invitations sync through Electric into TanStack DB collections, but nothing shows what that layer is doing. TanStack DB (`@tanstack/db` 0.13, `@tanstack/react-db` 0.5.8, `@tanstack/electric-db-collection` 0.5.9) ships no devtools panel and emits no devtools events. The TanStack Query devtools see oRPC queries only. When a row does not arrive, a shape returns nothing for the signed-in user, or a mutation hangs on `awaitTxId` or `awaitMatch`, the only tools are the network tab and `console.log`.

The paths that most need checking are also the hardest to reach by hand: a 401 that should sign the user out, a 403 or 404 that should go to Sentry, a txid or match wait that times out, the first load failing, and sign-out clearing every collection.

The devtools dock also leaves useful features of `@tanstack/devtools-vite` switched off.

## Solution

A **Sync** tab in the existing dev-only TanStack devtools dock that shows every synced collection, every shape request and every mutation wait, and can resync collections and inject faults into shape requests.

- The data comes from three hooks that already sit on the path: the `shapeOptions()` factory every collection uses, the `registerSyncedCollection` registry, and the API's shape proxy.
- Faults are injected in the browser, inside a `fetchClient` wrapper, so the API needs no fault routes.
- Everything is dev-only and stripped from production builds.
- The Vite devtools plugin also turns on console piping and go-to-source.

## User Stories

1. As a developer, I want a list of every synced collection with its status and row count, so that I can see at a glance which one is stuck loading or errored.
2. As a developer, I want each collection's shape handle, offset, whether it is live, and how long since it was last up to date, so that I can tell a healthy long-poll from a stalled one.
3. As a developer, I want to open a collection's rows as JSON with a filter box, so that I can check whether a specific row is present.
4. As a developer, I want a timeline of every `/api/shapes/:name` request with offset, `live`, status, duration and message count, so that I can spot fast loops, errors and resets.
5. As a developer, I want each shape request to show the `where` clause and params the proxy resolved for me, so that I can see why a shape returns nothing for this user.
6. As a developer, I want a timeline of every `awaitTxId` and `awaitMatch` wait with the collection, the txid (or "match"), duration, and whether it resolved, timed out or is pending, so that I can see why a mutation hangs.
7. As a developer, I want to resync one collection, so that I can start its sync again without reloading the page.
8. As a developer, I want to run the sign-out cleanup of all synced collections, so that I can check what cleanup does without signing out.
9. As a developer, I want to make the next request to one shape or to any shape answer 401, 403, 404 or 500, so that I can test `handleUnauthorized`, the Sentry report and Electric's retry.
10. As a developer, I want to add latency to shape requests until I turn it off, so that I can watch loading states and make txid and match waits time out.
11. As a developer, I want to make shape requests fail as if offline until I turn it off, so that I can see how the app behaves with no sync.
12. As a developer, I want latency and offline to survive a reload, so that I can test a failing first load.
13. As a developer, I want the request and mutation history to survive sign-out, with a Clear button, so that I can inspect what happened around sign-out and the next sign-in.
14. As a developer, I want browser console output in the terminal, so that Electric errors show up where I am already looking.
15. As a developer, I want to hold the inspect hotkey and click a component to open its source in VS Code, so that I can jump from the UI to the code.
16. As the instance owner, I want none of this in the production bundle or production responses, so that the shipped app and the shape filter stay private.

## Implementation Decisions

### Placement

- The panel is one more `{ name: "Sync", render }` entry in `apps/web/src/app/components/devtools.tsx`.
- The panel code lives in `apps/web/src/app/devtools/sync/`: one component per file, pure helpers and their tests beside them.
- It is styled with Tailwind and coss like the rest of the app. TanStack devtools renders plugin panels into the main document with no shadow DOM, so the app's styles apply there.
- Only the docked panel is supported. If picture-in-picture loses the styles, report it and leave it.
- No `EventClient` and no event-bus configuration. The panel and the app share one window, so the panel reads in-memory stores directly.

### Dev-only and stripped from builds

- Every hook is guarded by `import.meta.env.DEV`.
- Modules imported from production code paths (`shape-options.ts`, `synced-collections.ts`) have no top-level side effects, so the guarded branch and its imports are removed from builds.
- The panel itself is reached only through `devtools.tsx`, which `removeDevtoolsOnBuild` strips.
- Check a production build to confirm no sync-devtools code is left in it.

### Request log: the `fetchClient` wrapper

- In dev, `shapeOptions(name)` passes a `fetchClient` that wraps `fetch`.
- For each request, the wrapper records:
  - shape name, request offset and handle, the `live` flag, start time;
  - response status, duration, number of messages;
  - the response headers `electric-handle`, `electric-offset`, `electric-up-to-date` and `electric-cursor`;
  - the dev headers `x-morrow-shape-where` and `x-morrow-shape-params`.
- The message count must not use up the response body that the Electric client reads: clone the response, and count only non-live responses.
- The collections overview gets each shape's handle, offset, live state and last up-to-date time from the request log, because neither the collection nor `electricCollectionOptions` exposes them.

### Fault injection, in the same wrapper

- **Status faults are one-shot.** 401, 403, 404 or 500 apply to the next request to one chosen shape or to any shape, then disarm. The wrapper returns a fake `Response` without calling the network.
- **Latency and offline stay on until turned off.**
  - Latency delays the real request by a set number of milliseconds.
  - Offline rejects with a `TypeError`, which is how `fetch` signals a network failure.
  - Both persist in `sessionStorage`, so a reload keeps them. Every read and write is wrapped in try/catch.
- **No fake 409.** Recovering from an expired shape happens entirely inside `@electric-sql/client`, so a fake 409 would test the fake.

### Mutation log: wrapped waits

- In dev, `registerSyncedCollection` also records the collection in an in-memory list the panel reads.
- If the collection has `utils.awaitTxId` and `utils.awaitMatch`, it wraps both. Each call records the collection id, the txid (or the label "match", since a predicate cannot be shown), the start time, the end time, and the outcome: resolved, timed out or pending.
- No collection file changes.

### Sync controls

- **Resync** a collection: `collection.cleanup()`, then `collection.preload()`.
- **Clean up all**: call `cleanupSyncedCollections()`.

### History

- The request log and the mutation log each keep the last 200 entries, in memory.
- Sign-out does not clear them. The panel has a Clear button.

### Proxy dev headers

- In dev only, `apps/api/src/platform/sync/shape-proxy.ts` adds `x-morrow-shape-where` (the resolved SQL) and `x-morrow-shape-params` (JSON array) to its response.
- Outside dev these headers are never set, so the scoping SQL and the user's email never leave the server in production.

### Vite plugin

- In `apps/web/vite.config.ts`, `devtools()` turns on `consolePiping` (browser to terminal) and `injectSource` (go-to-source in VS Code, the default editor). `devtools()` stays the first plugin.
- API logs do not reach the browser: the API runs as its own `tsx watch` process and the web app has no SSR.
- Load `@tanstack/devtools-vite#devtools-vite-plugin` before editing.

### Skills to load before building

- `@tanstack/devtools-vite#devtools-vite-plugin`
- `@electric-sql/client#electric-shapes` (for `fetchClient`, headers and error semantics)
- `@electric-sql/client#electric-debugging`
- `@tanstack/db#db-core/collection-setup`
- `@tanstack/react-db#react-db`
- the `coss` skill for panel components

## Testing Decisions

Tests check behaviour through public interfaces only and sit beside the code they cover.

- **`fetchClient` wrapper:**
  - It records a request with its headers, status and duration.
  - It leaves the response body readable for the caller.
  - A one-shot status fault answers once and then disarms.
  - Faults aimed at one shape do not affect another.
  - Latency and offline stay on until turned off and are restored from `sessionStorage`.
  - It still works when `sessionStorage` throws.
  - The log is capped at 200 entries.
- **Wait wrappers:** they record a resolved wait, a wait that timed out (the inner function rejects) and a pending wait, and pass through the original result or rejection unchanged.
- **Proxy dev headers:**
  - With `NODE_ENV=development`, the shape proxy response carries the resolved `where` and params.
  - In any other environment it carries neither.
  - The shape proxy has no tests yet. Add `shape-proxy.test.ts` beside it, with `fetch` stubbed so no Electric instance is needed.
- No tests for the panel's React components. They are dev-only views, and tests would only lock in markup.

## Out of Scope

- Editing rows from the panel.
- A fake 409 or a real shape deletion through Electric's API.
- Postgres health in the panel (replication-slot lag, publication membership, `REPLICA IDENTITY FULL`). These belong in migration tests.
- A production or instance-admin sync page.
- `EventClient`, the server event bus, and any cross-process events from the API.
- Picture-in-picture support.
- Device-preference `localStorageCollection`s. They are not registered, so the panel does not list them.
- Waiting for, or packaging for, an official TanStack DB devtools. This panel is meant to be thrown away if upstream ships one.
