import { beforeEach, describe, expect, it } from "vitest";
import {
  SYSTEM_OWNER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_ROLE,
  addUser,
  authenticateNidoUser,
  deleteUser,
  getUsers,
  isSystemOwnerPasswordSetupRequired,
  saveUsers,
  setupSystemOwnerPassword,
  updateUser,
} from "@/lib/nidoUsersStore";

describe("NIDO users live store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the System Owner present and unchanged when a saved list omits it", () => {
    const owner = getUsers().find(user => user.id === SYSTEM_OWNER_ID);
    expect(owner?.role).toBe(SYSTEM_OWNER_ROLE);

    saveUsers(getUsers().filter(user => user.id !== SYSTEM_OWNER_ID));

    const restored = getUsers().find(user => user.id === SYSTEM_OWNER_ID);
    expect(restored).toMatchObject({
      id: SYSTEM_OWNER_ID,
      name: "System Owner",
      email: "owner@nidotech.com",
      role: SYSTEM_OWNER_ROLE,
      status: "Active",
    });
  });

  it("requires a browser-specific password before the System Owner can sign in", () => {
    expect(isSystemOwnerPasswordSetupRequired()).toBe(true);
    expect(authenticateNidoUser(SYSTEM_OWNER_EMAIL, "").error).toBe("invalid_credentials");

    setupSystemOwnerPassword("browser-chosen-test-password");

    expect(isSystemOwnerPasswordSetupRequired()).toBe(false);
    expect(authenticateNidoUser(SYSTEM_OWNER_EMAIL, "browser-chosen-test-password").user?.id)
      .toBe(SYSTEM_OWNER_ID);
    expect(() => setupSystemOwnerPassword("another-test-password")).toThrow(
      "System Owner password is already configured.",
    );
  });

  it("blocks edits and deletion of the System Owner account", () => {
    const owner = getUsers().find(user => user.id === SYSTEM_OWNER_ID)!;

    updateUser(owner.id, {
      name: "Changed Owner",
      email: "changed@example.com",
      password: "Changed@123",
      role: "System Admin",
      status: "Inactive",
    });
    deleteUser(owner.id);

    const unchanged = getUsers().find(user => user.id === SYSTEM_OWNER_ID)!;
    expect(unchanged.name).toBe("System Owner");
    expect(unchanged.email).toBe("owner@nidotech.com");
    expect(unchanged.password).toBe("");
    expect(unchanged.role).toBe(SYSTEM_OWNER_ROLE);
    expect(unchanged.status).toBe("Active");
  });

  it("shows newly added users through the shared store", () => {
    addUser({
      employeeId: "EMP-099",
      name: "Live User",
      email: "live.user@nidotech.com",
      password: "Live@123",
      phone: "",
      role: "System Admin",
      jobTitle: "Administrator",
      designation: "Administrator",
      department: "IT",
      status: "Active",
      createdAt: "",
      updatedAt: "",
    });

    expect(getUsers().some(user => user.email === "live.user@nidotech.com")).toBe(true);
  });

  it("does not retain legacy demo users or assign imported users a shared password", () => {
    localStorage.setItem("nido_config_users", JSON.stringify([
      {
        id: "user-2",
        employeeId: "EMP-002",
        name: "Mark Adams",
        email: "admin@nidotech.com",
        password: "Admin@123",
        phone: "",
        role: "System Admin",
        jobTitle: "",
        designation: "",
        department: "IT",
        status: "Active",
        createdAt: "",
        updatedAt: "",
      },
    ]));

    const users = getUsers();

    expect(users.some(user => user.id === SYSTEM_OWNER_ID)).toBe(true);
    expect(users.some(user => user.email === "admin@nidotech.com")).toBe(false);
    expect(users.filter(user => user.id.startsWith("imported-user-"))
      .every(user => user.password === "")).toBe(true);
    expect(JSON.parse(localStorage.getItem("nido_config_users") || "[]")
      .some((user: { email: string }) => user.email === "admin@nidotech.com")).toBe(false);
  });
});