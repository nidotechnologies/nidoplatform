# NIDO Procurement Platform

A modern procurement management frontend built with React, TypeScript, and Vite.

## How to run

The app starts automatically via the **Start application** workflow, which runs:

```bash
npm run dev:full
```

The full-stack dev server listens on port **5000** and is accessible in the Replit preview pane.

## Replit import notes

This repository is already configured for Replit. To keep a fresh import
lightweight:

1. Install the locked dependencies with `pnpm install --frozen-lockfile` (do not
   regenerate the lockfile or migrate the project to another package manager).
2. Run the existing **Start application** workflow; it uses
   `npm run dev:full` on port 5000.
3. Do not add database or email secrets unless the email features are needed.
   The main application works without them.
4. Avoid asking an Agent to rebuild or broadly analyze the imported project
   when the goal is only to run it. Ask for specific changes instead.

The committed `pnpm-lock.yaml`, `.replit` workflow, and this setup guide are
the source of truth for the imported project.

## Tech stack

- React 18 + TypeScript
- Vite (bundler)
- React Router v6
- Tailwind CSS + Radix UI (shadcn/ui)
- Recharts (charts), jsPDF (PDF export), Framer Motion (animations)

## Project structure

```
src/
├── components/
│   ├── layout/      # Sidebar, top bar, navigation
│   ├── ui/          # Reusable shadcn/ui components
│   └── shared/      # Shared utilities
├── pages/           # One component per route
├── contexts/        # React contexts
├── store/           # Global state
└── App.tsx          # Root component + routing
```

## Design system

The full font/color/spacing/component spec lives in **STYLE_GUIDE.md**, sourced
from `attached_assets/Font_and_styles_for_Nido_Tech_1783617058230.docx`. All new
UI (current and future) must follow it — use the `.text-*` typography utilities
and Tailwind color tokens defined in `src/index.css` / `tailwind.config.js`
rather than hardcoding fonts, sizes, or hex colors.

## User preferences

- Keep the existing project structure and dark-themed UI.
- Follow STYLE_GUIDE.md (Inter/Poppins fonts, enterprise blue palette, 8pt spacing) for all UI work, now and in future.
- Keep future project imports credit-light: inspect only the README and essential project configuration first, then ask what I want done. Do not use extra agents, broad analysis, redesign work, screenshots, tests, or builds during import. Only install dependencies, restart the existing workflow, or verify the preview when I explicitly ask to run/setup the project; otherwise leave it untouched.

## Tax Engine

A centralised Tax Engine (`src/lib/taxEngine.ts`) is the single source of truth for all tax calculations. Every module that does price calculations must derive tax through this engine — never hardcode rates elsewhere.

- **Route:** `/configuration/tax-settings` (7 tabs: Vendor Tax, Client Tax, Service Tax, Tax Categories, HSN/SAC, Category Mapping, Audit Log)
- **Config page:** `src/pages/TaxSettingsPage.tsx`
- **Tab components:** `src/components/configuration/tax/`
- **Store + calculation API:** `src/lib/taxEngine.ts`
- **Price engine integration:** `src/lib/priceEngineStore.ts` calls `getEffectiveVendorTaxPct()` and `getEffectiveTaxPctForCategory()` from the Tax Engine for every landed cost and client price calculation
- All settings are persisted in `localStorage` and take effect immediately for new transactions via `taxEngineUpdated` custom events
- Every save is recorded in the Tax Audit Log

## RBAC / NIDO Users & Roles

There is a single, canonical Users & Roles module at `/configuration/nido-users`
(tabs: Roles / Users, e.g. `?tab=users`). Sidebar "Users" and "Roles" links, and
the legacy `/users/management`, `/users/roles`, `/roles`, `/permissions` routes
all point here — do not add a second Users or Roles page; extend this one.

- `src/lib/nidoUsersStore.ts` — users/roles CRUD, auth, login history, lock/unlock.
- `src/lib/permissionsStore.ts` — module × action permission matrix (`MODULES`,
  `ACTIONS`, `hasPermission`), keyed by role name, Super Admin (`System Owner`)
  bypasses all checks. Every built-in role must have a `DEFAULTS` entry here —
  a role with no permissions record is denied everything (including dashboard).
- `src/lib/routePermissions.ts` + `src/components/layout/PermissionGate.tsx` —
  every admin route (not `/portal/*`) is checked against `hasPermission(moduleKey, 'view')`
  before rendering; unauthorized access shows `AccessDeniedPage`.

## Client user-management audit status

The client-user-management audit was completed without changing the existing
authentication or data architecture. The current project is a frontend/localStorage
prototype: `src/lib/portalUserStore.ts`, `src/lib/clientStore.ts`,
`src/contexts/OrdersContext.tsx`, and `src/lib/purchaseOrderStore.ts` do not have
server-side persistence or tenant authorization. The backend currently provides
email and quote routes only; `server/migrate.js` has no user, client, session,
invitation, permission, or audit-log schema.

Existing portal user, role, and address pages are now reachable at:

- `/portal/users`
- `/portal/roles`
- `/portal/addresses`

Remaining production corrections must be continued as a separate, explicit task:
add secure server-side authentication, password handling, client-user APIs,
invitation/password-reset flows, status enforcement, audit logging, and backend
client isolation. Do not create a second authentication or user-management
system; extend the existing files and preserve the current portal and procurement
flows.

For future imports, treat this section and the uploaded NIDO permanent rules as
the handoff. Inspect only the relevant files for the requested continuation;
do not repeat a broad project audit or reinstall dependencies unless explicitly
requested.
