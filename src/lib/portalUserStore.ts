export type PortalUserType = 'client_admin' | 'client_user';

export interface PortalUser {
  id: string;
  email: string;
  password: string; // plain-text for demo; replace with hashing when backend is live
  phone?: string;
  name: string;
  userType: PortalUserType;
  clientId: string;
  clientName: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
  provisionReason?: string;
  provisionedAt?: string;
  details?: Record<string, unknown>;
}

const STORE_KEY = 'nido_portal_users';
const ROLE_STORE_PREFIX = 'nido_portal_roles_';
const ROLE_MODULES_MIGRATION_PREFIX = 'nido_portal_role_modules_migrated_';
const LEGACY_ROLE_SEED_CLEANUP_PREFIX = 'nido_portal_role_seed_cleanup_';

export interface PortalRolePermission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve?: boolean;
  export?: boolean;
  import?: boolean;
  manage?: boolean;
  configure?: boolean;
}

export interface PortalRole {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  permissions: PortalRolePermission[];
}

export const PORTAL_MODULE_CATALOG = [
  { name: 'Dashboard', description: 'Client portal overview and account activity.' },
  { name: 'Catalog', description: 'Browse and manage the products available to this client.' },
  { name: 'Orders', description: 'Create, review, and track client orders.' },
  { name: 'Approvals', description: 'Review and approve requests assigned for client approval.' },
  { name: 'Services', description: 'View and manage active client services.' },
  { name: 'Invoices', description: 'View invoices, balances, and payment status.' },
  { name: 'Reports', description: 'View client purchasing and spend reports.' },
  { name: 'Notifications', description: 'View important account and order notifications.' },
  { name: 'Addresses', description: 'Manage delivery and billing addresses.' },
  { name: 'Contracts', description: 'View current client contracts and terms.' },
  { name: 'Support', description: 'Create and track client support requests.' },
  { name: 'My Profile', description: 'View and manage the signed-in client user profile.' },
] as const;

export const PORTAL_MODULES = PORTAL_MODULE_CATALOG.map(module => module.name);

export function getPortalModuleDescription(module: string): string {
  return PORTAL_MODULE_CATALOG.find(item => item.name === module)?.description
    || 'Client portal module.';
}

const PORTAL_PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
  'import',
  'manage',
  'configure',
] as const;

// Historical seed definitions are retained only so the migration can remove
// untouched demo rows safely. They are never used to create runtime roles.
const LEGACY_ROLE_SEED_BLUEPRINTS: Array<{
  id: string;
  name: string;
  description: string;
  view: string[];
  create?: string[];
  edit?: string[];
}> = [
  {
    id: 'r1',
    name: 'Client Admin',
    description: 'Full access to all portal modules',
    view: [...PORTAL_MODULES],
    create: [...PORTAL_MODULES],
    edit: [...PORTAL_MODULES],
  },
  {
    id: 'r2',
    name: 'Procurement Manager',
    description: 'Can manage orders and catalog',
    view: [...PORTAL_MODULES],
    create: ['Catalog', 'Orders'],
    edit: ['Catalog', 'Orders'],
  },
  {
    id: 'r3',
    name: 'Purchase Executive',
    description: 'Can place and track orders',
    view: ['Dashboard', 'Catalog', 'Orders', 'Notifications'],
    create: ['Orders'],
    edit: ['Orders'],
  },
  {
    id: 'r4',
    name: 'Finance',
    description: 'Access to invoices and reports',
    view: ['Dashboard', 'Invoices', 'Reports'],
  },
  {
    id: 'r5',
    name: 'Store Manager',
    description: 'Manages catalog and services',
    view: ['Dashboard', 'Catalog', 'Services', 'Orders'],
    create: ['Catalog', 'Services'],
    edit: ['Catalog', 'Services'],
  },
  {
    id: 'r6',
    name: 'Approver',
    description: 'Reviews and approves orders',
    view: ['Dashboard', 'Orders', 'Services'],
    edit: ['Orders'],
  },
  {
    id: 'r7',
    name: 'Employee',
    description: 'Browse catalog and submit requests',
    view: ['Dashboard', 'Catalog', 'Orders', 'Services', 'Notifications'],
    create: ['Orders'],
  },
  {
    id: 'r8',
    name: 'Viewer',
    description: 'Read-only access across all modules',
    view: [...PORTAL_MODULES],
  },
];

function legacySeedPermissions(
  role: (typeof LEGACY_ROLE_SEED_BLUEPRINTS)[number],
): PortalRolePermission[] {
  const assignedModules = new Set([...role.view, ...(role.create ?? []), ...(role.edit ?? [])]);
  if (assignedModules.has('Orders')) assignedModules.add('Approvals');
  if (assignedModules.has('Dashboard')) assignedModules.add('My Profile');

  return [...assignedModules].map(module => {
    const sourceModule = module === 'Approvals'
      ? 'Orders'
      : module === 'My Profile'
        ? 'Dashboard'
        : module;
    return createPortalRolePermission(module, {
      view: role.view.includes(sourceModule),
      create: role.create?.includes(sourceModule) ?? false,
      edit: role.edit?.includes(sourceModule) ?? false,
      approve: role.name === 'Approver' && ['Orders', 'Approvals'].includes(module),
    });
  });
}

function hasUnchangedLegacySeed(role: PortalRole): boolean {
  const seed = LEGACY_ROLE_SEED_BLUEPRINTS.find(candidate => candidate.id === role.id);
  if (
    !seed ||
    role.name !== seed.name ||
    role.description !== seed.description ||
    role.status !== 'active'
  ) return false;

  const signature = (permissions: PortalRolePermission[]) => permissions
    .map(permission => {
      const normalized = createPortalRolePermission(permission.module, permission);
      return JSON.stringify([
        normalized.module,
        ...PORTAL_PERMISSION_ACTIONS.map(action => normalized[action]),
      ]);
    })
    .sort()
    .join('|');

  return signature(role.permissions) === signature(legacySeedPermissions(seed));
}

export function createPortalRolePermission(
  module: string,
  permission?: Partial<PortalRolePermission>,
): PortalRolePermission {
  return {
    module,
    view: Boolean(permission?.view),
    create: Boolean(permission?.create),
    edit: Boolean(permission?.edit),
    delete: Boolean(permission?.delete),
    approve: Boolean(permission?.approve),
    export: Boolean(permission?.export),
    import: Boolean(permission?.import),
    manage: Boolean(permission?.manage),
    configure: Boolean(permission?.configure),
  };
}

function normalizePortalRoles(value: unknown): PortalRole[] {
  if (!Array.isArray(value)) return [];

  return value.map((candidate, index) => {
    const role = candidate && typeof candidate === 'object'
      ? candidate as Partial<PortalRole>
      : {};
    const storedPermissions = Array.isArray(role.permissions) ? role.permissions : [];
    const permissionByModule = new Map(
      storedPermissions
        .filter((permission): permission is PortalRolePermission => (
          Boolean(permission) &&
          typeof permission === 'object' &&
          typeof permission.module === 'string'
        ))
        .map(permission => [permission.module, permission]),
    );

    return {
      id: String(role.id || `portal-role-${index + 1}`),
      name: String(role.name || `Role ${index + 1}`),
      description: String(role.description || ''),
      status: String(role.status || 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
      permissions: [...permissionByModule.entries()]
        .filter(([module]) => module.trim().length > 0)
        .map(([module, permission]) => createPortalRolePermission(module, permission)),
    };
  });
}

export function getPortalRoles(clientId: string): PortalRole[] {
  const roleStorageKey = `${ROLE_STORE_PREFIX}${clientId}`;
  const migrationKey = `${ROLE_MODULES_MIGRATION_PREFIX}${clientId}`;
  const seedCleanupKey = `${LEGACY_ROLE_SEED_CLEANUP_PREFIX}${clientId}`;
  try {
    const raw = localStorage.getItem(roleStorageKey);
    if (!raw) {
      localStorage.setItem(roleStorageKey, JSON.stringify([]));
      localStorage.setItem(migrationKey, '1');
      localStorage.setItem(seedCleanupKey, '1');
      return [];
    }
    let normalized = normalizePortalRoles(JSON.parse(raw));

    // Old role records contained every module, including empty rows generated
    // by normalization. Keep real grants, while converting the former shared
    // sidebar permissions into independent Approvals and My Profile modules.
    if (localStorage.getItem(migrationKey) !== '1') {
      const knownModules = new Set<string>(PORTAL_MODULES);
      normalized = normalized.map(role => {
        const permissionByModule = new Map(role.permissions.map(permission => [permission.module, permission]));
        const legacyAliases = [
          ['Orders', 'Approvals'],
          ['Dashboard', 'My Profile'],
        ] as const;
        for (const [sourceModule, targetModule] of legacyAliases) {
          if (!permissionByModule.has(targetModule)) {
            const sourcePermission = permissionByModule.get(sourceModule);
            if (sourcePermission) {
              permissionByModule.set(targetModule, createPortalRolePermission(targetModule, sourcePermission));
            }
          }
        }

        const permissions = [...permissionByModule.values()].filter(permission => {
          const hasGrant = PORTAL_PERMISSION_ACTIONS.some(action => permission[action]);
          return hasGrant || !knownModules.has(permission.module);
        });
        return { ...role, permissions };
      });
      localStorage.setItem(migrationKey, '1');
    }

    // Remove only untouched, unassigned demo roles from older versions.
    // Edited roles and roles used by real client users are preserved.
    if (localStorage.getItem(seedCleanupKey) !== '1') {
      const assignedRoleNames = new Set(getPortalUsersByClient(clientId).map(user => user.role));
      normalized = normalized.filter(role =>
        !hasUnchangedLegacySeed(role) || assignedRoleNames.has(role.name),
      );
      localStorage.setItem(seedCleanupKey, '1');
    }

    localStorage.setItem(roleStorageKey, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function savePortalRoles(clientId: string, roles: PortalRole[]): void {
  const normalized = normalizePortalRoles(roles);
  localStorage.setItem(`${ROLE_STORE_PREFIX}${clientId}`, JSON.stringify(normalized));
  localStorage.setItem(`${ROLE_MODULES_MIGRATION_PREFIX}${clientId}`, '1');
  localStorage.setItem(`${LEGACY_ROLE_SEED_CLEANUP_PREFIX}${clientId}`, '1');
  window.dispatchEvent(new Event('nidoPortalRolesUpdated'));
}

const PORTAL_ROUTE_MODULES: Array<{ path: string; module: string }> = [
  { path: '/portal/catalog', module: 'Catalog' },
  { path: '/portal/orders', module: 'Orders' },
  { path: '/portal/approvals', module: 'Approvals' },
  { path: '/portal/invoices', module: 'Invoices' },
  { path: '/portal/my-services', module: 'Services' },
  { path: '/portal/services', module: 'Services' },
  { path: '/portal/support', module: 'Support' },
  { path: '/portal/contracts', module: 'Contracts' },
  { path: '/portal/reports', module: 'Reports' },
  { path: '/portal/notifications', module: 'Notifications' },
  { path: '/portal/addresses', module: 'Addresses' },
  { path: '/portal/dashboard', module: 'Dashboard' },
  { path: '/portal/profile', module: 'My Profile' },
];

export function getPortalModuleForPath(pathname: string): string | null {
  const normalized = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const match = PORTAL_ROUTE_MODULES
    .filter(route => normalized === route.path || normalized.startsWith(`${route.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  return match?.module ?? null;
}

export function getPortalRoleNames(clientId: string): string[] {
  return getPortalRoles(clientId).filter(role => role.status === 'active').map(role => role.name);
}

export function isPortalRoleActive(clientId: string, roleName: string): boolean {
  return getPortalRoles(clientId).some(role => role.name === roleName && role.status === 'active');
}

export function getUsersWithInvalidPortalRoles(clientId: string): PortalUser[] {
  const validRoles = new Set(getPortalRoleNames(clientId));
  return getPortalUsersByClient(clientId).filter(user => !validRoles.has(user.role));
}

export function hasPortalPermission(
  clientId: string,
  roleName: string,
  module: string,
  action: keyof Omit<PortalRolePermission, 'module'> = 'view',
): boolean {
  const role = getPortalRoles(clientId).find(item => item.name === roleName);
  if (!role || role.status !== 'active') return false;
  return !!role?.permissions.find(permission => permission.module === module)?.[action];
}

export function getPortalUsers(): PortalUser[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize records created by older versions of the portal user screen.
    // In particular, login must not fail because an email was saved with
    // accidental whitespace or status used a different casing.
    const normalizedUsers = parsed.map((user: Partial<PortalUser>) => ({
      ...user,
      email: String(user.email ?? '').trim(),
      name: String(user.name ?? '').trim(),
      status: String(user.status ?? 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
    })) as PortalUser[];
    // Do not silently move a user away from an inactive or missing role here.
    // Keeping the original assignment makes the access problem visible to an
    // administrator and lets authentication fail closed.
    return normalizedUsers;
  } catch {
    return [];
  }
}

export function savePortalUsers(users: PortalUser[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
  window.dispatchEvent(new Event('nidoPortalUsersUpdated'));
}

export function addPortalUser(user: PortalUser): void {
  const users = getPortalUsers();
  const idx = users.findIndex(u => u.id === user.id);
  const normalizedUser = { ...user, role: String(user.role || '').trim() };
  if (idx > -1) {
    users[idx] = normalizedUser;
  } else {
    users.push(normalizedUser);
  }
  savePortalUsers(users);
}

export function updatePortalUser(id: string, updates: Partial<PortalUser>): void {
  const users = getPortalUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx > -1) {
    const next = { ...users[idx], ...updates };
    if (updates.role) {
      const roleExists = getPortalRoles(next.clientId).some(role => role.name === updates.role);
      if (!roleExists) next.role = users[idx].role;
    }
    users[idx] = next;
    savePortalUsers(users);
  }
}

export function deletePortalUser(id: string): void {
  const users = getPortalUsers().filter(u => u.id !== id);
  savePortalUsers(users);
}

export function findPortalUser(email: string, password: string): PortalUser | null {
  const users = getPortalUsers();
  const normalizedEmail = email.trim().toLowerCase();
  return (
    users.find(
      u =>
        u.email.trim().toLowerCase() === normalizedEmail &&
        u.password === password &&
        String(u.status).toLowerCase() === 'active' &&
        isPortalRoleActive(u.clientId, u.role)
    ) ?? null
  );
}

export function getPortalUsersByClient(clientId: string): PortalUser[] {
  return getPortalUsers().filter(u => u.clientId === clientId);
}

export function isClientProvisioned(clientId: string): boolean {
  return getPortalUsers().some(u => u.clientId === clientId && u.userType === 'client_admin');
}

/** Generate a slug-safe segment from a client name */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
}

/** Generate a random 4-digit suffix */
function randomSuffix(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export interface ProvisionResult {
  email: string;
  password: string;
  userId: string;
}

/** Generates credentials without granting portal access. */
export function generatePortalCredentials(
  clientId: string,
  clientName: string
): ProvisionResult {
  const slug = toSlug(clientName) || 'client';
  return {
    email: `admin@${slug}.portal`,
    password: `Admin@${randomSuffix()}!`,
    userId: `portal-${clientId}-admin`,
  };
}

/** Activates the prepared credentials after an owner confirms portal access. */
export function activateClientPortal(
  clientId: string,
  clientName: string,
  credentials: ProvisionResult,
  reason = ''
): void {
  const roles = getPortalRoles(clientId);
  if (!roles.some(role => role.name === 'Client Admin')) {
    const fullAccess = Object.fromEntries(PORTAL_PERMISSION_ACTIONS.map(action => [action, true]));
    savePortalRoles(clientId, [
      ...roles,
      {
        id: `client-role-admin-${clientId}`,
        name: 'Client Admin',
        description: 'Administrator access for this client portal.',
        status: 'active',
        permissions: PORTAL_MODULES.map(module => createPortalRolePermission(module, fullAccess)),
      },
    ]);
  }

  const existing = getPortalUsers().find(
    (user) => user.clientId === clientId && user.userType === 'client_admin'
  );
  const user: PortalUser = {
    id: existing?.id || credentials.userId,
    email: credentials.email,
    password: credentials.password,
    name: `${clientName} Admin`,
    userType: 'client_admin',
    clientId,
    clientName,
    role: 'Client Admin',
    status: 'active',
    createdAt: existing?.createdAt || new Date().toISOString(),
    provisionReason: reason.trim() || undefined,
    provisionedAt: new Date().toISOString(),
  };
  addPortalUser(user);
}

/**
 * Provisions a Client Admin for the given client.
 * Returns the generated credentials.
 * If the client already has an admin, returns the existing admin's email
 * with a new reset password.
 */
export function provisionClientPortal(
  clientId: string,
  clientName: string
): ProvisionResult {
  const credentials = generatePortalCredentials(clientId, clientName);
  activateClientPortal(clientId, clientName, credentials);
  return credentials;
}

/** Creates an active portal login for an owner-managed client user. */
export function provisionPortalUser(
  clientId: string,
  clientName: string,
  details: {
    email: string;
    name: string;
    role?: string;
    status?: 'active' | 'inactive';
    phone?: string;
    details?: Record<string, unknown>;
  },
): ProvisionResult {
  const email = details.email.trim().toLowerCase();
  const password = `User@${randomSuffix()}!`;
  const existing = getPortalUsers().find(
    user => user.clientId === clientId && user.email.trim().toLowerCase() === email,
  );
  const userId = existing?.id || `portal-${clientId}-${Date.now()}`;
  const availableRoles = getPortalRoles(clientId).filter(item => item.status === 'active');
  const requestedRole = details.role?.trim() || existing?.role || '';
  const role = availableRoles.find(item => item.name === requestedRole)?.name;
  if (!role) {
    throw new Error('Create and activate a client role before provisioning a portal user.');
  }
  addPortalUser({
    id: userId,
    email,
    password,
    phone: details.phone ?? existing?.phone ?? '',
    name: details.name.trim(),
    userType: existing?.userType || 'client_user',
    clientId,
    clientName,
    role,
    status: details.status || 'active',
    createdAt: existing?.createdAt || new Date().toISOString(),
    provisionedAt: new Date().toISOString(),
    details: details.details ?? existing?.details,
  });
  return { email, password, userId };
}
