// ── Route → Module permission mapping ─────────────────────────────────────────
// Maps admin (NIDO Owner Platform) route path prefixes to the permission module
// key that guards them. Used by <PermissionGate> in AppLayout so every
// protected route is checked against the logged-in user's role permissions —
// not just their authentication status. Client Portal (`/portal/*`) routes are
// out of scope here; they use their own separate portal permission system.
//
// Longest-prefix match wins, so register more specific paths before broader
// ones only if they need a *different* module key than their parent.

export const ROUTE_MODULE_MAP: Array<{ prefix: string; moduleKey: string }> = [
  { prefix: '/dashboard', moduleKey: 'dashboard' },
  { prefix: '/shop', moduleKey: 'shop' },
  { prefix: '/services', moduleKey: 'services' },
  { prefix: '/my-services', moduleKey: 'services' },
  { prefix: '/support', moduleKey: 'support' },
  { prefix: '/clients/roles', moduleKey: 'roles' },
  { prefix: '/clients/users', moduleKey: 'users' },
  { prefix: '/clients', moduleKey: 'clients' },
  { prefix: '/vendors', moduleKey: 'vendors' },
  { prefix: '/orders', moduleKey: 'orders' },
  { prefix: '/vendor-orders', moduleKey: 'orders' },
  { prefix: '/procure', moduleKey: 'orders' },
  { prefix: '/my-renewals', moduleKey: 'orders' },
  { prefix: '/reports', moduleKey: 'reports' },

  { prefix: '/sales/quotes', moduleKey: 'sales' },
  { prefix: '/sales/orders', moduleKey: 'sales' },
  { prefix: '/sales/delivery-challans', moduleKey: 'sales' },
  { prefix: '/sales/payment-receipts', moduleKey: 'sales' },
  { prefix: '/sales/credit-notes', moduleKey: 'sales' },
  { prefix: '/sales/e-way-bills', moduleKey: 'sales' },
  { prefix: '/sales/invoices', moduleKey: 'invoices' },
  { prefix: '/sales/recurring-invoices', moduleKey: 'invoices' },
  { prefix: '/invoices', moduleKey: 'invoices' },
  { prefix: '/recurring-invoices', moduleKey: 'invoices' },
  { prefix: '/delivery-challans', moduleKey: 'sales' },
  { prefix: '/payment-receipts', moduleKey: 'sales' },
  { prefix: '/credit-notes', moduleKey: 'sales' },
  { prefix: '/eway-bills', moduleKey: 'sales' },

  { prefix: '/transactions/purchase/expenses', moduleKey: 'expenses' },
  { prefix: '/transactions/purchase/recurring-expenses', moduleKey: 'expenses' },
  { prefix: '/expenses', moduleKey: 'expenses' },
  { prefix: '/recurring-expenses', moduleKey: 'expenses' },
  { prefix: '/transactions/purchase/purchase-orders', moduleKey: 'purchase_orders' },
  { prefix: '/purchase-orders', moduleKey: 'purchase_orders' },
  { prefix: '/transactions/purchase/bills', moduleKey: 'bills' },
  { prefix: '/transactions/purchase/recurring-bills', moduleKey: 'bills' },
  { prefix: '/bills', moduleKey: 'bills' },
  { prefix: '/transactions/purchase/payments-made', moduleKey: 'purchases' },
  { prefix: '/payments-made', moduleKey: 'purchases' },
  { prefix: '/transactions/purchase/vendor-credits', moduleKey: 'purchases' },
  { prefix: '/vendor-credits', moduleKey: 'purchases' },
  { prefix: '/transactions/purchase', moduleKey: 'purchases' },
  { prefix: '/transactions', moduleKey: 'purchases' },

  { prefix: '/clients/:id/contracts', moduleKey: 'contracts' },
  { prefix: '/contracts', moduleKey: 'contracts' },

  { prefix: '/configuration/master-catalogue', moduleKey: 'master_catalogue' },
  { prefix: '/configuration/nido-users', moduleKey: 'users' },
  { prefix: '/configuration/stock-management', moduleKey: 'configuration' },
  { prefix: '/configuration', moduleKey: 'configuration' },

  { prefix: '/users/departments', moduleKey: 'departments' },
  { prefix: '/departments', moduleKey: 'departments' },
  { prefix: '/users/invitations', moduleKey: 'users' },
  { prefix: '/user-invitations', moduleKey: 'users' },
  { prefix: '/users/audit-trail', moduleKey: 'audit_logs' },
  { prefix: '/audit-logs', moduleKey: 'audit_logs' },
  { prefix: '/reports/audit', moduleKey: 'audit_logs' },
  { prefix: '/users', moduleKey: 'users' },
  { prefix: '/roles', moduleKey: 'roles' },
  { prefix: '/permissions', moduleKey: 'roles' },
];

/**
 * Resolve the permission module key that guards a given admin pathname.
 * Returns null for paths that are intentionally ungated (e.g. /home, /cart,
 * profile pages) — those are accessible to any authenticated NIDO user.
 */
export function getModuleKeyForPath(pathname: string): string | null {
  let best: { prefix: string; moduleKey: string } | null = null;
  for (const entry of ROUTE_MODULE_MAP) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry;
    }
  }
  return best ? best.moduleKey : null;
}
