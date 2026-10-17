# Navigate without waiting on the session

Status: ready-for-agent

## Problem Statement

`_authenticated.tsx`'s `beforeLoad` awaits `loadSession()`, which is `queryClient.fetchQuery` with `staleTime: 30_000` (`apps/web/src/auth/lib/session.ts`). After 30 s, the next navigation waits on a network round trip to `getSession` before anything renders.

## Solution

`loadSession` returns the cached session immediately when one exists. If the cache is stale, it refreshes in the background. It still awaits the network when there is no cached session (cold load, after `forgetSession`).

## User Stories

1. As a Member, I want moving between pages to never wait on a session check, so that navigation feels instant.
2. As a Member who signed out elsewhere, I want the next API call's 401 to send me to sign-in, so that a revoked session cannot linger.

## Implementation Decisions

- Implement with `queryClient.getQueryData` / `getQueryState` plus a non-awaited `refetchQueries`, or `ensureQueryData` with `revalidateIfStale: true`; whichever the installed TanStack Query supports.
- A background refresh that returns no session, or a user change, triggers the same handling as a 401: `forgetSession` and redirect to sign-in.
- `forgetSession` callers are unchanged.

## Testing Decisions

- In `_authenticated.test.tsx`:
  - with a cached stale session, navigation resolves without awaiting `getSession` (stub a pending promise);
  - with no cache, it awaits;
  - a background refresh returning null redirects to sign-in.

## Out of Scope

- Hover prefetch of tasks; Electric already keeps task data local.

## Further Notes

- Grilled 2026-10-17 (Q19). Kaneo 42f16821 (`lib/cached-session.ts`).
