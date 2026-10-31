// ── NIDO Platform RBAC — Permission Engine ────────────────────────────────────
// Stores role → module → action permission matrix in localStorage.
// Super Administrator ("System Owner") always bypasses all checks.
// Permissions are stored/keyed by role NAME (matches NidoUser.role).

export const MODULES = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'shop',            label: 'Shop' },
  { key: 'services',        label: 'Services' },
  { key: 'support',         label: 'Support' },
  { key: 'clients',         label: 'Clients' },
  { key: 'vendors',         label: 'Vendors' },
  { key: 'orders',          label: 'Orders' },
  { key: 'reports',         label: 'Reports' },
  { key: 'sales',           label: 'Sales' },
  { key: 'purchases',       label: 'Purchases' },
  { key: 'expenses',        label: 'Expenses' },
  { key: 'purchase_orders', label: 'Purchase Orders' },
  { key: 'bills',           label: 'Bills' },
  { key: 'invoices',        label: 'Invoices' },
  { key: 'contracts',       label: 'Contracts' },
  { key: 'approvals',       label: 'Approvals' },
  { key: 'master_catalogue',label: 'Master Catalogue' },
  { key: 'users',           label: 'Users' },
  { key: 'roles',           label: 'Roles' },
  { key: 'departments',     label: 'Departments' },
  { key: 'audit_logs',      label: 'Audit Logs' },
  { key: 'notifications',   label: 'Notifications' },
  { key: 'configuration',   label: 'Configuration' },
  { key: 'client_user_impersonation', label: 'Client User Impersonation' },
] as const;

export type ModuleKey = typeof MODULES[number]['key'];

// ── Custom (user-defined) modules ─────────────────────────────────────────────

export interface CustomModule { key: string; label: string; }
const CUSTOM_MODULES_KEY = 'nido_custom_modules';
export const CUSTOM_MODULES_EVENT = 'nidoCustomModulesUpdated';

export function getCustomModules(): CustomModule[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODULES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomModules(modules: CustomModule[]): void {
  localStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(modules));
  window.dispatchEvent(new Event(CUSTOM_MODULES_EVENT));
}

/** Add a new custom module. Returns false if the key already exists. */
export function addCustomModule(label: string): CustomModule | null {
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const existing = [...MODULES.map(m => m.key), ...getCustomModules().map(m => m.key)];
  if (existing.includes(key)) return null;
  const mod: CustomModule = { key, label };
  saveCustomModules([...getCustomModules(), mod]);
  return mod;
}

/** Delete a custom module by key. */
export function deleteCustomModule(key: string): void {
  saveCustomModules(getCustomModules().filter(m => m.key !== key));
}

/** All modules — built-in + custom — as a flat array for use in the matrix. */
export function getAllModules(): { key: string; label: string; custom?: boolean }[] {
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  return [
    ...MODULES.map(m => ({ ...m })),
    ...getCustomModules().map(m => ({ ...m, custom: true })),
  ].filter(module => {
    const key = module.key.trim().toLowerCase();
    const label = module.label.trim().toLowerCase();
    if (seenKeys.has(key) || seenLabels.has(label)) return false;
    seenKeys.add(key);
    seenLabels.add(label);
    return true;
  });
}

export const ACTIONS = [
  { key: 'view',      label: 'View' },
  { key: 'create',    label: 'Create' },
  { key: 'edit',      label: 'Edit' },
  { key: 'delete',    label: 'Delete' },
  { key: 'approve',   label: 'Approve' },
  { key: 'export',    label: 'Export' },
  { key: 'import',    label: 'Import' },
  { key: 'manage',    label: 'Manage' },
  { key: 'configure', label: 'Configure' },
] as const;

export type ActionKey = typeof ACTIONS[number]['key'];
export type ModulePermissions = Partial<Record<ActionKey, boolean>>;
export type RolePermissionMap = Record<string, Record<string, ModulePermissions>>;

const PERMISSIONS_KEY = 'nido_role_permissions';
export const PERMISSIONS_EVENT = 'nidoPermissionsUpdated';

// ── Super admin bypass ────────────────────────────────────────────────────────
export const SUPER_ADMIN_ROLE = 'System Owner';

export function isSuperAdmin(roleName: string): boolean {
  return roleName === SUPER_ADMIN_ROLE;
}

// ── Permission shorthand helpers ──────────────────────────────────────────────
const ALL:  ModulePermissions = { view:true, create:true, edit:true, delete:true, approve:true, export:true, import:true, manage:true, configure:true };
const NONE: ModulePermissions = {};
const VIEW: ModulePermissions = { view:true };
const READ_EXP: ModulePermissions = { view:true, export:true };
const CRUD: ModulePermissions = { view:true, create:true, edit:true, delete:true };
const CRUD_APR: ModulePermissions = { view:true, create:true, edit:true, delete:true, approve:true, export:true };
const MGR: ModulePermissions = { view:true, create:true, edit:true, delete:true, approve:true, export:true, import:true, manage:true };

// ── Default permissions seeded for built-in roles ─────────────────────────────
const DEFAULTS: Record<string, Record<string, ModulePermissions>> = {
  'System Admin': {
    dashboard:ALL, shop:ALL, services:ALL, support:ALL, clients:ALL,
    vendors:ALL, orders:ALL, reports:ALL, sales:ALL, purchases:ALL,
    expenses:ALL, purchase_orders:ALL, bills:ALL, invoices:ALL,
    contracts:ALL, approvals:ALL, master_catalogue:ALL,
    users:MGR, roles:{ view:true, manage:true },
    departments:ALL, audit_logs:READ_EXP,
    notifications:ALL, configuration:{ view:true, manage:true, configure:true },
    client_user_impersonation:ALL,
  },
  // Keep the policy explicit: managers can be granted this permission from
  // the Roles UI, but it is off by default. Procurement and other roles are
  // denied unless an administrator deliberately changes their role matrix.
  'Procurement Manager': {
    dashboard:VIEW, shop:CRUD, services:CRUD, support:VIEW,
    clients:VIEW, vendors:{ view:true, create:true, edit:true },
    orders:CRUD_APR, reports:READ_EXP, sales:VIEW, purchases:CRUD_APR,
    expenses:CRUD, purchase_orders:CRUD_APR, bills:VIEW, invoices:VIEW,
    contracts:VIEW, approvals:CRUD_APR, master_catalogue:VIEW,
    users:VIEW, roles:NONE, departments:VIEW,
    audit_logs:NONE, notifications:VIEW, configuration:VIEW,
    client_user_impersonation:NONE,
  },
  'Accounts Payable': {
    dashboard:VIEW, shop:VIEW, services:VIEW, support:VIEW,
    clients:VIEW, vendors:VIEW, orders:VIEW, reports:READ_EXP,
    sales:CRUD_APR, purchases:CRUD_APR, expenses:CRUD_APR,
    purchase_orders:CRUD_APR, bills:CRUD_APR, invoices:CRUD_APR,
    contracts:VIEW, approvals:CRUD_APR, master_catalogue:VIEW,
    users:NONE, roles:NONE, departments:NONE,
    audit_logs:VIEW, notifications:VIEW, configuration:NONE,
  },
  'Vendor Admin': {
    dashboard:VIEW, shop:VIEW, services:VIEW, support:VIEW,
    clients:NONE, vendors:{ view:true, edit:true },
    orders:VIEW, reports:VIEW, sales:NONE, purchases:NONE,
    expenses:NONE, purchase_orders:VIEW, bills:NONE, invoices:NONE,
    contracts:VIEW, approvals:NONE, master_catalogue:VIEW,
    users:NONE, roles:NONE, departments:NONE,
    audit_logs:NONE, notifications:VIEW, configuration:NONE,
  },
  'Finance': {
    dashboard:VIEW, shop:VIEW, services:VIEW, support:VIEW,
    clients:VIEW, vendors:VIEW, orders:VIEW, reports:READ_EXP,
    sales:CRUD_APR, purchases:CRUD_APR, expenses:CRUD_APR,
    purchase_orders:CRUD_APR, bills:CRUD_APR, invoices:CRUD_APR,
    contracts:VIEW, approvals:CRUD_APR, master_catalogue:VIEW,
    users:NONE, roles:NONE, departments:NONE,
    audit_logs:READ_EXP, notifications:VIEW, configuration:NONE,
  },
  'Operations Manager': {
    dashboard:VIEW, shop:CRUD, services:CRUD, support:CRUD,
    clients:{ view:true, create:true, edit:true }, vendors:{ view:true, create:true, edit:true },
    orders:CRUD_APR, reports:READ_EXP, sales:VIEW, purchases:VIEW,
    expenses:VIEW, purchase_orders:VIEW, bills:VIEW, invoices:VIEW,
    contracts:{ view:true, create:true, edit:true }, approvals:CRUD_APR, master_catalogue:VIEW,
    users:VIEW, roles:NONE, departments:VIEW,
    audit_logs:NONE, notifications:VIEW, configuration:VIEW,
  },
  'Viewer': {
    dashboard:VIEW, shop:VIEW, services:VIEW, support:VIEW,
    clients:VIEW, vendors:VIEW, orders:VIEW, reports:VIEW,
    sales:VIEW, purchases:VIEW, expenses:VIEW, purchase_orders:VIEW,
    bills:VIEW, invoices:VIEW, contracts:VIEW, approvals:VIEW,
    master_catalogue:VIEW, users:NONE, roles:NONE, departments:VIEW,
    audit_logs:NONE, notifications:VIEW, configuration:NONE,
  },
};

// ── Core functions ────────────────────────────────────────────────────────────

export function getAllRolePermissions(): RolePermissionMap {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Returns a complete module→action map for a given role name. */
export function getRolePermissions(roleName: string): Record<string, ModulePermissions> {
  if (isSuperAdmin(roleName)) {
    return Object.fromEntries(MODULES.map(m => [m.key, ALL]));
  }
  const stored = getAllRolePermissions();
  // Keep the permission policy available for a fresh browser without writing
  // seeded/mock rows to storage. Explicit role edits in the Roles UI continue
  // to override these defaults.
  const existing = stored[roleName] ?? DEFAULTS[roleName] ?? {};
  return Object.fromEntries(
    Object.entries(existing).map(([moduleKey, permissions]) => [
      moduleKey,
      { ...permissions },
    ]),
  );
}

export function saveRolePermissions(roleName: string, perms: Record<string, ModulePermissions>): void {
  const all = getAllRolePermissions();
  all[roleName] = perms;
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(PERMISSIONS_EVENT));
}

export function hasPermission(roleName: string, moduleKey: string, action: ActionKey): boolean {
  if (!roleName) return false;
  if (isSuperAdmin(roleName)) return true;
  return !!getRolePermissions(roleName)[moduleKey]?.[action];
}

/** Compatibility hook retained for existing callers; permissions are live-only. */
export function initDefaultPermissions(): void {
  // No seeded/mock permission rows are created.
}
