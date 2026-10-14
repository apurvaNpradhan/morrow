# Morrow context

Morrow is a personal workspace platform run as a single instance (the owner's Dokploy box) with open sign-up. Sync is described in `docs/adr/0001-electric-tanstack-db-sync.md` and `docs/adr/0002-sync-invitations-and-workspaces.md`.

## Glossary

- **Workspace** — the unit users create, share and are members of. Has a slug, members, roles and activity.
- **Member** — a user's membership in a workspace, with a role (static owner; viewer, member, admin editable per workspace). Every role can read its workspace; being a member means being able to see it.
- **Invitation** — a pending offer to join a workspace. Only pending ones are synced; an accepted or cancelled one leaves the browser.
- **Project** — a named container of work inside a Workspace, with a key, an icon, an optional background and its own Columns. Every Member sees every Project. Can be archived; an archived Project is read-only until restored or deleted.
- **Project key** — 2–6 upper-case letters and digits, starting with a letter. Unique per Workspace; the URL segment of a Project and the prefix of its future ticket ids.
- **Column** — one step of a Project's workflow. Belongs to one Column category, has a name and a colour, and is ordered by a fractional-index position. Every Project keeps at least one `unstarted` and one `done` Column.
- **Column category** — what a Column means: `backlog`, `unstarted`, `started`, `done` or `canceled`. Fixed; Projects choose the names, not the categories.
- **Admin** — a user whose verified session email is in `ADMIN_EMAILS`. Not stored in the database. Admins are exempt from the workspace limit and reach other workspaces through the administration pages, not the workspace URL.
- **Registration** — sign-up by email OTP, Google or GitHub. Closed by `REGISTRATION_OPEN=false`.
- **Vertical** — a folder named by what its code does, with the same name in API and web (`workspace`, `members`, …). It has one public `index.ts`; other verticals import only that.
- **Procedure** — an oRPC endpoint. Context comes from the Better Auth session: base, authenticated, workspace (permission-checked), admin.
- **Shape** — a server-defined, read-only stream of one table's rows for one user, served at `/api/shapes/:name`. The server fixes the table, columns and filter; the browser only names the shape.
- **Synced collection** — a TanStack DB collection fed by a Shape, living in the browser tab. Reads are live; writes go through Procedures. Cleared at sign-out.
- **Device preference** — a setting that belongs to the browser, not the user (theme, compact mode, sidebar default). Stored locally, synced between tabs, kept after sign-out.
