# Morrow context

Morrow is a personal workspace platform run as a single instance (the owner's Dokploy box) with open sign-up. See `docs/adr/0001-morrow-core.md` and `docs/adr/0002-personal-instance.md`.

## Glossary

- **Workspace** — the unit users create, share and are members of. Has a slug, members, roles and activity.
- **Member** — a user's membership in a workspace, with a role (static owner; viewer, member, admin editable per workspace).
- **Invitation** — a pending offer to join a workspace.
- **Admin** — a user whose verified session email is in `ADMIN_EMAILS`. Not stored in the database. Admins are exempt from the workspace limit.
- **Registration** — sign-up by email OTP, Google or GitHub. Closed by `REGISTRATION_OPEN=false`.
- **Vertical** — a folder named by what its code does, with the same name in API and web (`workspace`, `members`, …). It has one public `index.ts`; other verticals import only that.
- **Procedure** — an oRPC endpoint. Context comes from the Better Auth session: base, authenticated, workspace (permission-checked), admin.
