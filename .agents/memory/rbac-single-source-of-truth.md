---
name: RBAC single source of truth
description: Why NIDO Users/Roles/Permissions must stay as one module, and how route-level permission gating is wired.
---

This app previously grew duplicate, disconnected surfaces for the same RBAC
concept (a mock "Users" page with hardcoded data, a "Coming Soon" Roles page,
a "Coming Soon" Permissions page, all separate from the real, functional
Roles/Users UI reachable via Configuration). Sidebar links even pointed to a
path (`/roles`) that didn't match any real route.

**Why:** duplicate/stub pages for the same domain concept silently drift out
of sync with the real data store, and users can't tell which one is "real."
The spec for this app explicitly required a single Users module and a single
Roles module.

**How to apply:** before adding a new page for a concept that already has a
management UI elsewhere (search for its data store's CRUD functions first),
prefer extending/redirecting to the existing page over building a second one.
For NIDO, the canonical Users/Roles home is `/configuration/nido-users`.

Route-level RBAC enforcement (beyond hiding sidebar links) was also missing —
a logged-in low-privilege user could navigate directly to a restricted URL.
Fixed via `src/lib/routePermissions.ts` (path-prefix → module key map) plus
`PermissionGate` wrapping the `AppLayout` outlet, which checks
`hasPermission(moduleKey, 'view')` per navigation and renders an Access Denied
page otherwise. Client Portal (`/portal/*`) routes are intentionally excluded
since they use a separate portal permission model.
