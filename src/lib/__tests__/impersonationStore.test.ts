import {
  canStartImpersonation,
  endImpersonation,
  getImpersonationAudit,
  getImpersonationSession,
  startImpersonation,
} from "@/lib/impersonationStore";
import { addPortalUser } from "@/lib/portalUserStore";
import { hasPermission } from "@/lib/permissionsStore";
import type { User } from "@/contexts/AuthContext";

const admin: User = {
  id: "admin-1",
  email: "admin@nidotech.com",
  name: "Mark Adams",
  role: "System Admin",
  userType: "nido_admin",
};

const procurementManager: User = {
  ...admin,
  id: "manager-1",
  role: "Procurement Manager",
};

const portalUser: User = {
  id: "portal-client-a-user",
  email: "john@client-a.com",
  name: "John Doe",
  role: "Client User",
  userType: "client_user",
  clientId: "client-a",
  clientName: "Client A",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function seedTarget(overrides: Partial<User> = {}) {
  addPortalUser({
    id: portalUser.id,
    email: portalUser.email,
    password: "not-used-by-impersonation",
    name: portalUser.name,
    userType: portalUser.userType,
    clientId: portalUser.clientId!,
    clientName: portalUser.clientName!,
    role: portalUser.role!,
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  });
}

describe("impersonationStore", () => {
  it("uses the dedicated permission and denies unauthorized internal roles", () => {
    expect(hasPermission("System Admin", "client_user_impersonation", "manage")).toBe(true);
    expect(hasPermission("System Owner", "client_user_impersonation", "manage")).toBe(true);
    expect(hasPermission("Procurement Manager", "client_user_impersonation", "manage")).toBe(false);
    expect(canStartImpersonation(procurementManager, portalUser)).toBe(false);
    expect(canStartImpersonation(admin, { ...portalUser, userType: "nido_admin" })).toBe(false);
  });

  it("re-resolves the active target, stores only the temporary session in sessionStorage, and audits start/end", () => {
    seedTarget();

    const session = startImpersonation(admin, portalUser);

    expect(session).not.toBeNull();
    expect(session?.originalUser.id).toBe(admin.id);
    expect(session?.impersonatedUser.id).toBe(portalUser.id);
    expect(session?.impersonatedUser.userType).toBe("client_user");
    expect(sessionStorage.getItem("nido_impersonation_session")).toBeTruthy();
    expect(localStorage.getItem("nido_impersonation_session")).toBeNull();
    expect(getImpersonationSession()?.clientId).toBe("client-a");

    endImpersonation();
    const audit = getImpersonationAudit();
    expect(audit.map((entry) => entry.eventType)).toEqual([
      "IMPERSONATION_ENDED",
      "IMPERSONATION_STARTED",
    ]);
    expect(audit[0].originalUserId).toBe(admin.id);
    expect(audit[0].impersonatedUserId).toBe(portalUser.id);
  });

  it("rejects a target whose authoritative client or status does not match", () => {
    seedTarget({ clientId: "client-b" });
    expect(startImpersonation(admin, portalUser)).toBeNull();

    sessionStorage.clear();
    localStorage.clear();
    seedTarget({ status: "inactive" });
    expect(startImpersonation(admin, portalUser)).toBeNull();
  });
});