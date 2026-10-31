/**
 * Platform permission modules.
 *
 * These are the navigable areas of the NIDO platform, kept separate from the
 * legacy broad permission groups in permissionsStore so existing role data
 * continues to work. A selected page module takes precedence over its legacy
 * group for that route.
 */

export interface PlatformModuleOption {
  key: string;
  label: string;
  path: string;
  legacyKey: string;
  description: string;
}

interface ModuleDefinition {
  label: string;
  path: string;
  legacyKey: string;
}

function describeModule(label: string): string {
  const parts = label.split(" › ");
  if (parts.length > 1) {
    const moduleName = parts[parts.length - 1];
    const parentName = parts[parts.length - 2];
    return `Manage ${moduleName.toLowerCase()} access and workflows within ${parentName.toLowerCase()}.`;
  }
  return `View and manage ${label.toLowerCase()} across the NIDO platform.`;
}

const definitions: ModuleDefinition[] = [
  { label: 'Dashboard', path: '/dashboard', legacyKey: 'dashboard' },
  { label: 'Shop', path: '/shop', legacyKey: 'shop' },
  { label: 'Services', path: '/services', legacyKey: 'services' },
  { label: 'Support', path: '/support', legacyKey: 'support' },
  { label: 'Clients', path: '/clients', legacyKey: 'clients' },
  { label: 'Clients › Add Client', path: '/clients/add', legacyKey: 'clients' },
  { label: 'Clients › Contracts', path: '/contracts', legacyKey: 'contracts' },
  { label: 'Clients › Contracts', path: '/clients/:id/contracts', legacyKey: 'contracts' },
  { label: 'Clients › Roles', path: '/clients/roles', legacyKey: 'roles' },
  { label: 'Clients › Users', path: '/clients/users', legacyKey: 'users' },
  { label: 'Clients › Orders', path: '/clients/orders', legacyKey: 'clients' },
  { label: 'Clients › Services', path: '/clients/services', legacyKey: 'clients' },
  { label: 'Clients › Catalog', path: '/clients/catalog', legacyKey: 'clients' },
  { label: 'Clients › Activity', path: '/clients/activity', legacyKey: 'clients' },
  { label: 'Clients › Configuration', path: '/clients/configuration', legacyKey: 'clients' },
  { label: 'Clients › Documents', path: '/clients/documents', legacyKey: 'clients' },
  { label: 'Vendors', path: '/vendors', legacyKey: 'vendors' },
  { label: 'Vendors › Orders', path: '/vendors/orders', legacyKey: 'vendors' },
  { label: 'Vendors › Dashboard', path: '/vendors/dashboard', legacyKey: 'vendors' },
  { label: 'Vendors › Categories', path: '/vendors/categories', legacyKey: 'vendors' },
  { label: 'Vendors › Onboarding', path: '/vendors/onboarding', legacyKey: 'vendors' },
  { label: 'My Requests › Orders', path: '/orders', legacyKey: 'orders' },
  { label: 'My Requests › Services', path: '/my-services', legacyKey: 'services' },
  { label: 'My Requests › My Renewals', path: '/my-renewals', legacyKey: 'orders' },
  { label: 'Reports', path: '/reports', legacyKey: 'reports' },
  { label: 'Reports › Executive', path: '/reports/executive', legacyKey: 'reports' },
  { label: 'Reports › Sales', path: '/reports/sales', legacyKey: 'reports' },
  { label: 'Reports › Procurement', path: '/reports/procurement', legacyKey: 'reports' },
  { label: 'Reports › Vendors', path: '/reports/vendors', legacyKey: 'reports' },
  { label: 'Reports › Clients', path: '/reports/clients', legacyKey: 'reports' },
  { label: 'Reports › Inventory', path: '/reports/inventory', legacyKey: 'reports' },
  { label: 'Reports › Finance', path: '/reports/finance', legacyKey: 'reports' },
  { label: 'Reports › Support', path: '/reports/support', legacyKey: 'reports' },
  { label: 'Reports › SLA', path: '/reports/sla', legacyKey: 'reports' },
  { label: 'Reports › Approvals', path: '/reports/approvals', legacyKey: 'reports' },
  { label: 'Reports › Tax', path: '/reports/tax', legacyKey: 'reports' },
  { label: 'Reports › Audit Trail', path: '/reports/audit', legacyKey: 'audit_logs' },

  { label: 'Transactions', path: '/transactions', legacyKey: 'purchases' },
  { label: 'Transactions › Sales', path: '/transactions/sales', legacyKey: 'sales' },
  { label: 'Transactions › Sales › Quotes', path: '/sales/quotes', legacyKey: 'sales' },
  { label: 'Transactions › Sales › Sales Orders', path: '/sales/orders', legacyKey: 'sales' },
  { label: 'Transactions › Sales › Invoices', path: '/invoices', legacyKey: 'invoices' },
  { label: 'Transactions › Sales › Recurring Invoices', path: '/recurring-invoices', legacyKey: 'invoices' },
  { label: 'Transactions › Sales › Delivery Challans', path: '/delivery-challans', legacyKey: 'sales' },
  { label: 'Transactions › Sales › Payment Receipts', path: '/payment-receipts', legacyKey: 'sales' },
  { label: 'Transactions › Sales › Credit Notes', path: '/credit-notes', legacyKey: 'sales' },
  { label: 'Transactions › Sales › e-Way Bills', path: '/eway-bills', legacyKey: 'sales' },
  { label: 'Transactions › Purchases', path: '/transactions/purchase', legacyKey: 'purchases' },
  { label: 'Transactions › Purchases › Expenses', path: '/expenses', legacyKey: 'expenses' },
  { label: 'Transactions › Purchases › Recurring Expenses', path: '/recurring-expenses', legacyKey: 'expenses' },
  { label: 'Transactions › Purchases › Purchase Orders', path: '/purchase-orders', legacyKey: 'purchase_orders' },
  { label: 'Transactions › Purchases › Bills', path: '/bills', legacyKey: 'bills' },
  { label: 'Transactions › Purchases › Payments Made', path: '/payments-made', legacyKey: 'purchases' },
  { label: 'Transactions › Purchases › Vendor Credits', path: '/vendor-credits', legacyKey: 'purchases' },

  { label: 'Configuration', path: '/configuration', legacyKey: 'configuration' },
  { label: 'Configuration › General Settings', path: '/configuration/general-settings', legacyKey: 'configuration' },
  { label: 'Configuration › Nido Users › Roles & Users', path: '/configuration/nido-users', legacyKey: 'users' },
  { label: 'Configuration › Email Settings', path: '/configuration/email-settings', legacyKey: 'configuration' },
  { label: 'Configuration › Email Templates', path: '/configuration/email-templates', legacyKey: 'configuration' },
  { label: 'Configuration › Email Logs', path: '/configuration/email-logs', legacyKey: 'configuration' },
  { label: 'Configuration › Order Statuses', path: '/configuration/order-statuses', legacyKey: 'configuration' },
  { label: 'Configuration › Locations', path: '/configuration/locations', legacyKey: 'configuration' },
  { label: 'Configuration › Notifications', path: '/configuration/notifications', legacyKey: 'notifications' },
  { label: 'Configuration › Approval Workflows', path: '/configuration/workflows', legacyKey: 'approvals' },
  { label: 'Configuration › Pricing & Discounts', path: '/configuration/pricing', legacyKey: 'configuration' },
  { label: 'Configuration › Tax Settings', path: '/configuration/tax-settings', legacyKey: 'configuration' },
  { label: 'Configuration › SLA Settings', path: '/configuration/sla-settings', legacyKey: 'configuration' },
  { label: 'Configuration › Stock Management', path: '/configuration/stock-management', legacyKey: 'configuration' },
  { label: 'Configuration › Master Catalogue', path: '/configuration/master-catalogue', legacyKey: 'master_catalogue' },
  { label: 'Configuration › Integrations', path: '/integrations', legacyKey: 'configuration' },
  { label: 'User Management › Users', path: '/users', legacyKey: 'users' },
  { label: 'User Management › Departments', path: '/departments', legacyKey: 'departments' },
  { label: 'User Management › Invitations', path: '/user-invitations', legacyKey: 'users' },
  { label: 'User Management › Audit Trail', path: '/audit-logs', legacyKey: 'audit_logs' },
];

function normalizePath(path: string): string {
  const cleaned = path.split(/[?#]/)[0].replace(/\/+$/, '');
  return cleaned || '/';
}

export function getPlatformModuleKey(path: string): string {
  const normalized = normalizePath(path);
  const suffix = normalized === '/' ? 'root' : normalized.slice(1).replace(/[^a-zA-Z0-9]+/g, '_');
  return `platform_${suffix.toLowerCase()}`;
}

export const PLATFORM_MODULE_OPTIONS: PlatformModuleOption[] = definitions.map(definition => ({
  ...definition,
  key: getPlatformModuleKey(definition.path),
  description: describeModule(definition.label),
}));

/** Modules available for manual role assignment from the Add Module picker. */
// Keep this list identical to the platform catalog. User-management pages are
// real protected modules and must not disappear from the role editor.
const seenRoleModuleKeys = new Set<string>();
const seenRoleModuleLabels = new Set<string>();
export const ROLE_PERMISSION_MODULE_OPTIONS = PLATFORM_MODULE_OPTIONS.filter(module => {
  const key = module.key.toLowerCase();
  const label = module.label.trim().toLowerCase();
  if (seenRoleModuleKeys.has(key) || seenRoleModuleLabels.has(label)) return false;
  seenRoleModuleKeys.add(key);
  seenRoleModuleLabels.add(label);
  return true;
});

/**
 * Finds the most specific platform page for a pathname. This makes nested
 * pages such as /sales/quotes/create inherit the permission selected for
 * "Transactions › Sales › Quotes".
 */
export function getPlatformModuleForPath(pathname: string): PlatformModuleOption | null {
  const current = normalizePath(pathname);
  let best: PlatformModuleOption | null = null;
  for (const module of PLATFORM_MODULE_OPTIONS) {
    const modulePath = normalizePath(module.path);
    const currentParts = current.split('/');
    const moduleParts = modulePath.split('/');
    const matchesTemplate = currentParts.length >= moduleParts.length &&
      moduleParts.every((part, index) => part.startsWith(':') || part === currentParts[index]);
    if (matchesTemplate) {
      if (!best || modulePath.length > normalizePath(best.path).length) best = module;
    }
  }
  return best;
}
