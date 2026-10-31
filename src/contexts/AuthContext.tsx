'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import {
  getImpersonationSession,
  startImpersonation as createImpersonationSession,
  endImpersonation as clearImpersonationSession,
  IMPERSONATION_EVENT,
  type ImpersonationSession,
} from '@/lib/impersonationStore';
import { getRoles, getUsers, NIDO_ROLES_EVENT, NIDO_USERS_EVENT } from '@/lib/nidoUsersStore';
import { getPortalUsersByClient, isPortalRoleActive } from '@/lib/portalUserStore';

export type UserType = 'nido_admin' | 'client_admin' | 'client_user';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  userType: UserType;
  clientId?: string;
  clientName?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  /** The identity that authenticated, never the impersonated effective user. */
  currentAuthenticatedUser: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isNidoAdmin: boolean;
  isClientPortalUser: boolean;
  originalUser: User | null;
  effectiveUser: User | null;
  isImpersonating: boolean;
  impersonationSession: ImpersonationSession | null;
  startImpersonation: (target: User) => boolean;
  endImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonationSession, setImpersonationSession] = useState<ImpersonationSession | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('nido_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Back-compat: old sessions without userType default to nido_admin
        if (!parsedUser.userType) parsedUser.userType = 'nido_admin';
        setUser(parsedUser);
        setIsAuthenticated(true);
        const activeImpersonation = getImpersonationSession();
        setImpersonationSession(activeImpersonation);
        if (activeImpersonation) setUser(activeImpersonation.impersonatedUser);
      } catch {
        localStorage.removeItem('nido_user');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const validateSession = () => {
      setUser(current => {
        if (!current || impersonationSession) return current;
        if (current.userType !== 'nido_admin') {
          const portalUser = current.clientId
            ? getPortalUsersByClient(current.clientId).find(candidate => candidate.id === current.id)
            : null;
          if (!portalUser || portalUser.status !== 'active' || !isPortalRoleActive(portalUser.clientId, portalUser.role)) {
            setIsAuthenticated(false);
            localStorage.removeItem('nido_user');
            return null;
          }
          return current;
        }
        const stored = getUsers().find(candidate => candidate.id === current.id);
        const role = stored ? getRoles().find(candidate => candidate.name === stored.role) : null;
        if (!stored || stored.status !== 'Active' || !role || role.status !== 'Active') {
          setIsAuthenticated(false);
          localStorage.removeItem('nido_user');
          return null;
        }
        return {
          ...current,
          name: stored.name,
          email: stored.email,
          role: stored.role,
        };
      });
    };
    window.addEventListener(NIDO_ROLES_EVENT, validateSession);
    window.addEventListener(NIDO_USERS_EVENT, validateSession);
    return () => {
      window.removeEventListener(NIDO_ROLES_EVENT, validateSession);
      window.removeEventListener(NIDO_USERS_EVENT, validateSession);
    };
  }, [impersonationSession]);

  useEffect(() => {
    const refresh = () => {
      const active = getImpersonationSession();
      setImpersonationSession(active);
      if (active) {
        setUser(active.impersonatedUser);
      } else {
        try {
          const stored = JSON.parse(localStorage.getItem("nido_user") || "null");
          if (stored) setUser(stored);
        } catch { /* ignore malformed session */ }
      }
    };
    window.addEventListener(IMPERSONATION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener(IMPERSONATION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const login = (userData: User) => {
    // A new login always starts from a clean identity. Do not carry an old
    // impersonation session into another account.
    if (getImpersonationSession()) clearImpersonationSession();
    setUser(userData);
    setImpersonationSession(null);
    setIsAuthenticated(true);
    localStorage.setItem('nido_user', JSON.stringify(userData));
  };

  const logout = () => {
    if (impersonationSession) clearImpersonationSession();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('nido_user');
  };

  const originalUser = impersonationSession?.originalUser ?? user;
  const effectiveUser = impersonationSession?.impersonatedUser ?? user;
  const isImpersonating = Boolean(impersonationSession);
  const isNidoAdmin = effectiveUser?.userType === 'nido_admin';
  const isClientPortalUser = effectiveUser?.userType === 'client_admin' || effectiveUser?.userType === 'client_user';
  const beginImpersonation = (target: User) => {
    // Never allow nested impersonation and always use the preserved original
    // internal identity for the authorization decision.
    if (!originalUser || originalUser.userType !== "nido_admin" || isImpersonating) return false;
    const session = createImpersonationSession(originalUser, target);
    if (!session) return false;
    setImpersonationSession(session);
    setUser(session.impersonatedUser);
    return true;
  };
  const endImpersonation = () => {
    const original = impersonationSession?.originalUser;
    clearImpersonationSession();
    setImpersonationSession(null);
    if (original) setUser(original);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    currentAuthenticatedUser: originalUser,
    login,
    logout,
    isLoading,
    isNidoAdmin,
    isClientPortalUser,
    originalUser,
    effectiveUser,
    isImpersonating,
    impersonationSession,
    startImpersonation: beginImpersonation,
    endImpersonation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
