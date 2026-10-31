import { beforeEach, describe, expect, it } from "vitest";
import {
  addPortalUser,
  createPortalRolePermission,
  activateClientPortal,
  findPortalUser,
  getPortalModuleForPath,
  getPortalRoles,
  getPortalUsersByClient,
  hasPortalPermission,
  PORTAL_MODULES,
  provisionPortalUser,
  savePortalRoles,
  updatePortalUser,
  type PortalRole,
} from "@/lib/portalUserStore";

const clientId = "client-auth-test";

function seedUser(overrides: Partial<Parameters<typeof addPortalUser>[0]> = {}) {
  savePortalRoles(clientId, [{
    id: "employee-role",
    name: "Employee",
    description: "",
    status: "active",
    permissions: [createPortalRolePermission("Dashboard", { view: true })],
  }]);
  addPortalUser({
    id: "portal-client-auth-test-user",
    email: "user@example.com",
    password: "Correct@123",
    name: "Portal User",
    userType: "client_user",
    clientId,
    clientName: "Authentication Test Client",
    role: "Employee",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("client portal authentication", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accepts a provisioned active user with normalized email input", () => {
    seedUser();

    expect(findPortalUser("  USER@EXAMPLE.COM ", "Correct@123")?.id).toBe(
      "portal-client-auth-test-user",
    );
  });

  it("rejects incorrect passwords, inactive users, and inactive roles", () => {
    seedUser();
    expect(findPortalUser("user@example.com", "Wrong@123")).toBeNull();

    updatePortalUser("portal-client-auth-test-user", { status: "inactive" });
    expect(findPortalUser("user@example.com", "Correct@123")).toBeNull();

    localStorage.clear();
    seedUser();
    const roles = getPortalRoles(clientId).map(role =>
      role.name === "Employee" ? { ...role, status: "inactive" as const } : role,
    );
    localStorage.setItem(`nido_portal_roles_${clientId}`, JSON.stringify(roles));
    expect(findPortalUser("user@example.com", "Correct@123")).toBeNull();
  });

  it("requires a saved active role instead of falling back to a sample role", () => {
    expect(() => provisionPortalUser(clientId, "Authentication Test Client", {
      email: "new.user@example.com",
      name: "New User",
    })).toThrow("Create and activate a client role before provisioning a portal user.");
  });

  it("persists generated credentials against a role configured for that client", () => {
    savePortalRoles(clientId, [{
      id: "employee-role",
      name: "Employee",
      description: "",
      status: "active",
      permissions: [createPortalRolePermission("Dashboard", { view: true })],
    }]);
    const credentials = provisionPortalUser(clientId, "Authentication Test Client", {
      email: "new.user@example.com",
      name: "New User",
      role: "Employee",
    });

    expect(findPortalUser(credentials.email, credentials.password)?.id).toBe(
      credentials.userId,
    );
  });

  it("does not seed sample roles for a client with no saved role data", () => {
    expect(getPortalRoles(clientId)).toEqual([]);
    expect(localStorage.getItem(`nido_portal_roles_${clientId}`)).toBe("[]");
    expect(PORTAL_MODULES).toContain("Approvals");
    expect(PORTAL_MODULES).toContain("My Profile");
  });

  it("creates an explicit administrator role when portal access is activated", () => {
    activateClientPortal(clientId, "Authentication Test Client", {
      email: "admin@example.com",
      password: "Admin@1234!",
      userId: "portal-admin-test",
    });

    const adminRole = getPortalRoles(clientId).find(role => role.name === "Client Admin");
    expect(adminRole?.permissions).toHaveLength(PORTAL_MODULES.length);
    expect(hasPortalPermission(clientId, "Client Admin", "Catalog", "view")).toBe(true);
    expect(findPortalUser("admin@example.com", "Admin@1234!")?.id).toBe("portal-admin-test");
  });

  it("uses the configured permission rows instead of a hardcoded administrator bypass", () => {
    savePortalRoles(clientId, [{
      id: "client-admin-role",
      name: "Client Admin",
      description: "",
      status: "active",
      permissions: [createPortalRolePermission("Dashboard", { view: true })],
    }]);

    expect(hasPortalPermission(clientId, "Client Admin", "Dashboard", "view")).toBe(true);
    expect(hasPortalPermission(clientId, "Client Admin", "Catalog", "view")).toBe(false);
  });

  it("keeps user assignments aligned when an inactive role is renamed", () => {
    seedUser();
    savePortalRoles(clientId, [{
      id: "employee-role",
      name: "Former Employee",
      description: "",
      status: "inactive",
      permissions: [],
    }]);

    updatePortalUser("portal-client-auth-test-user", { role: "Former Employee" });

    expect(getPortalUsersByClient(clientId)[0]?.role).toBe("Former Employee");
  });

  it("removes only untouched, unused legacy sample roles", () => {
    localStorage.setItem(`nido_portal_roles_${clientId}`, JSON.stringify([
      {
        id: "r4",
        name: "Finance",
        description: "Access to invoices and reports",
        status: "active",
        permissions: [
          createPortalRolePermission("Dashboard", { view: true }),
          createPortalRolePermission("Invoices", { view: true }),
          createPortalRolePermission("Reports", { view: true }),
          createPortalRolePermission("My Profile", { view: true }),
        ],
      },
      {
        id: "r7",
        name: "Employee",
        description: "Browse catalog and submit requests",
        status: "active",
        permissions: [
          createPortalRolePermission("Dashboard", { view: true }),
          createPortalRolePermission("Catalog", { view: true }),
          createPortalRolePermission("Orders", { view: true, create: true }),
          createPortalRolePermission("Services", { view: true }),
          createPortalRolePermission("Notifications", { view: true }),
          createPortalRolePermission("Approvals", { view: true, create: true }),
          createPortalRolePermission("My Profile", { view: true }),
        ],
      },
      {
        id: "r2",
        name: "Procurement Manager",
        description: "Can manage orders and catalog",
        status: "active",
        permissions: [createPortalRolePermission("Catalog", { view: true })],
      },
      { id: "client-role-custom", name: "Custom Role", description: "", status: "active", permissions: [] },
    ]));
    localStorage.setItem(`nido_portal_role_modules_migrated_${clientId}`, "1");
    localStorage.setItem("nido_portal_users", JSON.stringify([{
      id: "assigned-employee",
      email: "employee@example.com",
      password: "not-used",
      name: "Employee User",
      userType: "client_user",
      clientId,
      clientName: "Authentication Test Client",
      role: "Employee",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    }]));

    expect(getPortalRoles(clientId).map(role => role.name)).toEqual([
      "Employee",
      "Procurement Manager",
      "Custom Role",
    ]);
  });

  it("persists added modules, including a module with no permissions enabled yet", () => {
    const role: PortalRole = {
      id: "role-with-new-modules",
      name: "Module Test",
      description: "",
      status: "active",
      permissions: [
        createPortalRolePermission("Approvals"),
        createPortalRolePermission("My Profile", { view: true }),
      ],
    };

    savePortalRoles(clientId, [role]);
    const savedRole = getPortalRoles(clientId)[0];

    expect(savedRole.permissions.map(permission => permission.module)).toEqual(["Approvals", "My Profile"]);
    expect(hasPortalPermission(clientId, role.name, "Approvals", "view")).toBe(false);
    expect(hasPortalPermission(clientId, role.name, "My Profile", "view")).toBe(true);
  });

  it("migrates legacy sidebar permissions and removes empty scaffold rows", () => {
    const oldModules = PORTAL_MODULES.filter(module => module !== "Approvals" && module !== "My Profile");
    const legacyRole: PortalRole = {
      id: "legacy-role",
      name: "Legacy Employee",
      description: "",
      status: "active",
      permissions: oldModules.map(module => createPortalRolePermission(module, {
        view: module === "Dashboard" || module === "Orders",
      })),
    };
    localStorage.setItem(`nido_portal_roles_${clientId}`, JSON.stringify([legacyRole]));

    const migratedRole = getPortalRoles(clientId)[0];

    expect(migratedRole.permissions.map(permission => permission.module)).toEqual([
      "Dashboard",
      "Orders",
      "Approvals",
      "My Profile",
    ]);
    expect(hasPortalPermission(clientId, legacyRole.name, "Approvals", "view")).toBe(true);
    expect(hasPortalPermission(clientId, legacyRole.name, "My Profile", "view")).toBe(true);
  });

  it("resolves portal routes to the permission module used by the sidebar", () => {
    expect(getPortalModuleForPath("/portal/approvals")).toBe("Approvals");
    expect(getPortalModuleForPath("/portal/profile")).toBe("My Profile");
    expect(getPortalModuleForPath("/portal/my-services/requests/request-1")).toBe("Services");
    expect(getPortalModuleForPath("/portal/unmapped")).toBeNull();
  });
});