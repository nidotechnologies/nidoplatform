import { describe, expect, it, vi } from "vitest";

const roles = vi.hoisted(() => [
  { id: "role-procurement", department: "Procurement", name: "Procurement Lead", description: "", status: "Active" as const },
  { id: "role-procurement-2", department: " procurement ", name: "Buyer", description: "", status: "Inactive" as const },
  { id: "role-finance", department: "Finance & Accounts", name: "Finance Lead", description: "", status: "Active" as const },
  { id: "role-owner", department: "All Departments", name: "System Owner", description: "", status: "Active" as const },
  { id: "role-empty", department: " ", name: "Unassigned", description: "", status: "Active" as const },
]);

vi.mock("@/lib/nidoUsersStore", () => ({
  getRoles: () => roles,
  getUsers: () => [{ id: "user-1", department: "User-only Department" }],
}));
vi.mock("@/lib/clientStore", () => ({ getClients: () => [] }));
vi.mock("@/lib/vendorDataStore", () => ({ getVendors: () => [] }));

import { getReportCenterEntities } from "@/lib/reportCenterData";

describe("Report Center internal department options", () => {
  it("uses distinct configured NIDO role departments instead of user department values", () => {
    expect(getReportCenterEntities().internal).toEqual([
      { id: "Finance & Accounts", name: "Finance & Accounts" },
      { id: "Procurement", name: "Procurement" },
    ]);
  });
});
