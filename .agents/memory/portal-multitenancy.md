---
name: Multi-tenant Client Portal Architecture
description: How the NIDO Client Portal is layered on top of the Admin Platform — user types, routing, user registry, provisioning.
---

## Architecture

The Client Portal is NOT a separate app. It shares the same React app, routes, and AppLayout. Differentiation is entirely by `userType`.

## Portal Client Profile Resolution

Portal users may authenticate under a user-specific storage scope while their client profile was created under the NIDO owner scope. Portal screens must resolve the requested client by its exact `user.clientId` across the available client records, without exposing a list of other clients.

**Why:** otherwise a valid portal user can authenticate successfully but the dashboard, checkout address, and order detail screens cannot find the client profile and appear blank or show “Client not found.”

**How to apply:** use a client-scoped lookup for portal profile reads; keep admin client lists account-scoped and never broaden portal reads to return all client records.

## User Types (`src/contexts/AuthContext.tsx`)

`User.userType: 'nido_admin' | 'client_admin' | 'client_user'`

- `nido_admin` — existing owner/admin. Back-compat: old sessions without `userType` get `nido_admin`.
- `client_admin` — provisioned client admin, can manage their portal users/roles
- `client_user` — regular client user

`User.clientId` and `User.clientName` are set for client portal users.

## Portal User Registry (`src/lib/portalUserStore.ts`)

localStorage key: `nido_portal_users` — array of `PortalUser` objects (plain-text password for demo).
Functions: `getPortalUsers`, `savePortalUsers`, `addPortalUser`, `updatePortalUser`, `deletePortalUser`, `findPortalUser`, `getPortalUsersByClient`, `isClientProvisioned`, `provisionClientPortal`.

## Login Routing (`src/pages/LoginPage.tsx`)

1. Hardcoded check for `owner@nidotech.com` / `Owner@123` → `nido_admin` → `/dashboard`
2. Lookup in `portalUserStore` → `client_admin`/`client_user` → `/portal/dashboard`

## Route Guards (`src/App.tsx`)

- `ProtectedRoute` — basic auth check (any logged-in user)
- `AdminOnlyRoute` — blocks client portal users, redirects them to `/portal/dashboard`
- `ClientPortalRoute` — blocks NIDO admins, redirects them to `/dashboard`

## Sidebar (`src/components/layout/Sidebar.tsx`)

Reads `isClientPortalUser` from `useAuth()`. Shows `clientNavigationItems` (portal nav) or `adminNavigationItems` (full admin nav). Sign-out button is wired to `logout()` + navigate to `/login`. Profile section shows actual user name/role from context.

## Portal Routes

All under the existing `AppLayout` wrapper, prefixed `/portal/`:
- `/portal/dashboard` → `ClientPortalDashboard`
- `/portal/catalog` → `ShopPage` (reused)
- `/portal/orders` → `MyOrderPage` (reused)
- `/portal/services` → `ServicesPage` (reused)
- `/portal/invoices` → `InvoicePage` (reused)
- `/portal/contracts` → `ClientContractsPage` (reused)
- `/portal/reports` → `AuditTrailPage` (reused)
- `/portal/notifications` → `NotificationsPage` (reused)
- `/portal/support` → `SupportPage` (reused)
- `/portal/profile` → `UserProfilePage` (reused)
- `/portal/users` → `ClientPortalUsersPage` (new)
- `/portal/roles` → `ClientPortalRolesPage` (new)
- `/portal/addresses` → `ClientPortalAddressesPage` (new)

## Portal Shopping Route Contract

The portal catalog page is `/portal/catalog`; only the transactional shopping flow uses `/portal/shop/*`: cart, checkout, payment, review, product detail, and order confirmation. Breadcrumbs and “Continue Shopping” links must target `/portal/catalog`, not `/portal/shop`.

**Why:** `/portal/shop` is not the catalog route. Sending users there causes an unmatched route or a guard redirect to the dashboard, which makes the portal appear to lose its current page.

**How to apply:** derive separate catalog, product, cart, checkout, payment, review, and confirmation paths in shared shopping components. Keep admin equivalents under `/shop` and `/shop/*`.

## Client Provisioning (`src/pages/ClientsPage.tsx`)

Dropdown action "Provision Client Portal" on each client row calls `provisionClientPortal(clientId, clientName)`:
- Generates email `admin@{slug}.portal`, password `Admin@{4-digit}!`
- Stores in `nido_portal_users`
- Dialog shows credentials with copy buttons

## Role Persistence

Client portal roles stored in localStorage: `nido_portal_roles_{clientId}`.

## Client Detail Live Data

Client detail tabs use `clientDataStore` records filtered by `clientId`; the detail page passes the ID into Orders, Services, Contracts, Activity, and Documents and listens for `nidoClientDataUpdated` for same-app synchronization. Contracts persist their editable state and document uploads persist browser data URLs.

Contract downloads must generate a PDF from the currently hydrated contract state, not from demo or static content, so edits made in the contract detail view are included.

New clients must not inherit seeded contract terms; the contract screen should initialize empty and hydrate only from a saved client contract, while header metadata comes from the selected client's record.

## Why

Spec requires single codebase, unlimited clients, full isolation. localStorage is the prototype backend — swap for real DB (Task #2) once MongoDB is connected. All client-scoped data flows through `user.clientId` from the session; never from the frontend directly.

## Order Details page: portal vs owner view

`src/pages/OrderDetailsPage.tsx` is shared by both `/orders/:id` (owner) and `/portal/orders/:id` (portal) — gate portal-only restrictions with `isClientPortalUser` from `useAuth()`, not a route prop. Portal view: no PO Number/Select Vendor columns, no Vendor Selected Summary tab, no Assignment card, no Update-Master-Status control, no Documents & Notes section, Sub Orders/Items action menu collapsed to a single "Cancel Item" button, Requestor/Client card shows the logged-in portal user (`useAuth().user`) instead of `order.requester`.

**Why:** any derived state that should be visible on both platforms must live on the shared `MyOrder` record (via `MyOrdersContext`) or a localStorage key read by both, not component-local `useState` — a prior bug had "Update Master Status" write only to local state, so portal never saw owner status changes. Fixed by writing status directly onto the order via `setOrders`.

**How to apply:** for any new field that both owner and portal must see change "immediately," persist it to localStorage under a key both views read (per-order keys already exist: `nido_pos_`, `nido_vendors_`, `nido_refnumbers_`, `nido_subitems_`, `nido_notes_`) and add a `window.addEventListener('storage', ...)` listener so open tabs pick up changes without reload — `MyOrdersContext` already does this for the main orders array.
