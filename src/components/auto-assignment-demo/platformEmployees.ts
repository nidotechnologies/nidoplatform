import { getRoles, getUsers, NIDO_ROLES_EVENT, NIDO_USERS_EVENT } from "@/lib/nidoUsersStore";
import type { Employee } from "./model";

export { NIDO_ROLES_EVENT, NIDO_USERS_EVENT };

export function getNidoAssignmentEmployees(): Employee[] {
  const activeRoleNames = new Set(
    getRoles()
      .filter((role) => role.status === "Active")
      .map((role) => role.name),
  );

  return getUsers()
    .map((user) => ({
      id: user.id,
      employeeId: user.employeeId || "ID unavailable",
      name: user.name.trim() || user.email || "Unnamed employee",
      department: user.department || "Unassigned department",
      role: user.role || "Unassigned role",
      status: user.status === "Active" && !user.locked && activeRoleNames.has(user.role)
        ? "Active" as const
        : "Inactive" as const,
    }))
    .sort((left, right) =>
      Number(right.status === "Active") - Number(left.status === "Active")
      || left.name.localeCompare(right.name),
    );
}
