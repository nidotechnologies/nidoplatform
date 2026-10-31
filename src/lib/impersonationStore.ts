import type { User } from "@/contexts/AuthContext";
import { getPortalUsers, type PortalUser } from "@/lib/portalUserStore";
import { hasPermission } from "@/lib/permissionsStore";

export type ImpersonationMode = "VIEW_ONLY" | "FULL_ACCESS";

export interface ImpersonationSession {
  id: string;
  originalUser: User;
  impersonatedUser: User;
  clientId: string;
  mode: ImpersonationMode;
  startedAt: string;
  expiresAt: string;
  status: "active" | "ended" | "expired";
}

export interface ImpersonationAuditEntry {
  eventType: "IMPERSONATION_STARTED" | "IMPERSONATION_ENDED";
  originalUserId: string;
  impersonatedUserId: string;
  clientId: string;
  impersonationSessionId: string;
  timestamp: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  mode: ImpersonationMode;
  status: string;
}

const SESSION_KEY = "nido_impersonation_session";
const AUDIT_KEY = "nido_impersonation_audit";
export const IMPERSONATION_EVENT = "nidoImpersonationUpdated";
const ONE_HOUR_MS = 60 * 60 * 1000;

function getSessionStorage(): Storage {
  return window.sessionStorage;
}

function notify() {
  window.dispatchEvent(new Event(IMPERSONATION_EVENT));
}

function saveAudit(entry: ImpersonationAuditEntry) {
  let entries: ImpersonationAuditEntry[] = [];
  try { entries = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch { /* ignore */ }
  localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...entries].slice(0, 500)));
}

export function getImpersonationSession(): ImpersonationSession | null {
  try {
    const session = JSON.parse(getSessionStorage().getItem(SESSION_KEY) || "null") as ImpersonationSession | null;
    if (!session) return null;
    if (session.status !== "active" || session.expiresAt <= new Date().toISOString()) {
      endImpersonation("expired");
      return null;
    }
    const target = getPortalUsers().find((u) =>
      u.id === session.impersonatedUser.id &&
      u.clientId === session.clientId,
    );
    if (!target || target.status !== "active" || !canStartImpersonation(session.originalUser, toAuthUser(target))) {
      endImpersonation("revoked");
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function canStartImpersonation(originalUser: User, targetUser: User): boolean {
  return originalUser.userType === "nido_admin" &&
    (targetUser.userType === "client_admin" || targetUser.userType === "client_user") &&
    Boolean(targetUser.clientId) &&
    hasPermission(originalUser.role || "", "client_user_impersonation", "manage");
}

function toAuthUser(target: PortalUser): User {
  return {
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
    userType: target.userType,
    clientId: target.clientId,
    clientName: target.clientName,
  };
}

export function startImpersonation(originalUser: User, targetUser: User): ImpersonationSession | null {
  // Resolve the target from the portal-user store instead of trusting the
  // row/object supplied by the browser. This is the authoritative local
  // equivalent of a server-side lookup.
  const target = getPortalUsers().find((candidate) =>
    candidate.id === targetUser.id &&
    candidate.status === "active" &&
    candidate.clientId === targetUser.clientId,
  );
  if (!target) return null;
  const effectiveTarget = toAuthUser(target);
  if (!canStartImpersonation(originalUser, effectiveTarget)) return null;
  const now = new Date();
  const session: ImpersonationSession = {
    id: `imp-${crypto.randomUUID()}`,
    originalUser,
    impersonatedUser: effectiveTarget,
    clientId: target.clientId,
    mode: "VIEW_ONLY",
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ONE_HOUR_MS).toISOString(),
    status: "active",
  };
  getSessionStorage().setItem(SESSION_KEY, JSON.stringify(session));
  saveAudit({
    eventType: "IMPERSONATION_STARTED",
    originalUserId: originalUser.id,
    impersonatedUserId: targetUser.id,
    clientId: session.clientId,
    impersonationSessionId: session.id,
    timestamp: now.toISOString(),
    startedAt: session.startedAt,
    mode: session.mode,
    status: session.status,
  });
  notify();
  return session;
}

export function endImpersonation(reason: "ended" | "expired" | "revoked" = "ended"): void {
  try {
    const session = JSON.parse(getSessionStorage().getItem(SESSION_KEY) || "null") as ImpersonationSession | null;
    if (session) {
      const endedAt = new Date().toISOString();
      saveAudit({
        eventType: "IMPERSONATION_ENDED",
        originalUserId: session.originalUser.id,
        impersonatedUserId: session.impersonatedUser.id,
        clientId: session.clientId,
        impersonationSessionId: session.id,
        timestamp: endedAt,
        startedAt: session.startedAt,
        endedAt,
        durationSeconds: Math.max(
          0,
          Math.round((Date.parse(endedAt) - Date.parse(session.startedAt)) / 1000),
        ),
        mode: session.mode,
        status: reason,
      });
    }
  } finally {
    getSessionStorage().removeItem(SESSION_KEY);
    notify();
  }
}

export function getImpersonationAudit(): ImpersonationAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch { return []; }
}