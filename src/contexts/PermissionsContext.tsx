// ── Permissions Context ───────────────────────────────────────────────────────
// Provides hasPermission() and getModulePermissions() to the whole app.
// Reads the current user's role from AuthContext and evaluates permissions
// from permissionsStore. Reacts live to permission changes fired via events.

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRolePermissions,
  hasPermission as checkPermission,
  isSuperAdmin,
  initDefaultPermissions,
  PERMISSIONS_EVENT,
  type ActionKey,
  type ModulePermissions,
} from '@/lib/permissionsStore';
import { NIDO_ROLES_EVENT, NIDO_USERS_EVENT } from '@/lib/nidoUsersStore';

interface PermissionsContextType {
  /** Check if the current user has a specific permission. Always true for System Owner. */
  hasPermission: (moduleKey: string, action: ActionKey) => boolean;
  /** Check a page-level module first, then fall back to its legacy group. */
  hasRoutePermission: (moduleKey: string, legacyModuleKey: string, action: ActionKey) => boolean;
  /** Get all module permissions for the current user's role. */
  getModulePermissions: (moduleKey: string) => ModulePermissions;
  /** True if the current user is a Super Admin (System Owner). */
  isSuperAdmin: boolean;
  /** Current role name — empty string if not authenticated. */
  roleName: string;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isNidoAdmin } = useAuth();
  const [, setTick] = useState(0);

  // Seed default permissions on first load
  useEffect(() => { initDefaultPermissions(); }, []);

  // Re-evaluate whenever roles/permissions/users change
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener(PERMISSIONS_EVENT, refresh);
    window.addEventListener(NIDO_ROLES_EVENT, refresh);
    window.addEventListener(NIDO_USERS_EVENT, refresh);
    return () => {
      window.removeEventListener(PERMISSIONS_EVENT, refresh);
      window.removeEventListener(NIDO_ROLES_EVENT, refresh);
      window.removeEventListener(NIDO_USERS_EVENT, refresh);
    };
  }, []);

  // Only NIDO admin users participate in RBAC. Client portal users use their own permission system.
  const roleName = (isNidoAdmin && user?.role) ? user.role : '';
  const superAdmin = isNidoAdmin && isSuperAdmin(roleName);

  const hp = useCallback(
    (moduleKey: string, action: ActionKey): boolean => {
      if (!isNidoAdmin) return false;
      return checkPermission(roleName, moduleKey, action);
    },
    [roleName, isNidoAdmin]
  );

  const hrp = useCallback(
    (moduleKey: string, legacyModuleKey: string, action: ActionKey): boolean => {
      if (!isNidoAdmin) return false;
      if (isSuperAdmin(roleName)) return true;
      const rolePermissions = getRolePermissions(roleName);
      if (Object.prototype.hasOwnProperty.call(rolePermissions, moduleKey)) {
        return !!rolePermissions[moduleKey]?.[action];
      }
      return checkPermission(roleName, legacyModuleKey, action);
    },
    [roleName, isNidoAdmin]
  );

  const gmp = useCallback(
    (moduleKey: string): ModulePermissions => {
      if (!isNidoAdmin) return {};
      return getRolePermissions(roleName)[moduleKey] ?? {};
    },
    [roleName, isNidoAdmin]
  );

  return (
    <PermissionsContext.Provider
      value={{ hasPermission: hp, hasRoutePermission: hrp, getModulePermissions: gmp, isSuperAdmin: superAdmin, roleName }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextType {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within <PermissionsProvider>');
  return ctx;
}
