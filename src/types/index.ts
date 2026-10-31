export interface GeneralSettings {
  companyName: string;
  email: string;
  phone: string;
  address: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface ModulePermission {
  module: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export const MODULES = [
  'invoicing',
  'procurement',
  'inventory',
  'accounting',
  'reporting',
  'settings',
];

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
