export type RoleTemplateKey = 'admin' | 'manager' | 'user';

export const ROLE_TEMPLATES = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: ['read', 'write', 'delete', 'manage_users'],
  },
  manager: {
    name: 'Manager',
    description: 'Limited administrative access',
    permissions: ['read', 'write', 'manage_users'],
  },
  user: {
    name: 'User',
    description: 'Basic user access',
    permissions: ['read'],
  },
};

export const AVAILABLE_MODULES = [
  'invoicing',
  'procurement',
  'inventory',
  'accounting',
  'reporting',
  'settings',
];

export function generatePermissionMatrix(role: RoleTemplateKey) {
  const template = ROLE_TEMPLATES[role];
  return AVAILABLE_MODULES.reduce((acc, module) => {
    acc[module] = template.permissions.includes('write');
    return acc;
  }, {} as Record<string, boolean>);
}
