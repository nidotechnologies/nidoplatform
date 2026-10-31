import { getUsers } from "@/lib/nidoUsersStore";

interface AuthenticatedVendorUser {
  id?: string;
  name?: string;
  email?: string;
}

export function getVendorAuditIdentity(user: AuthenticatedVendorUser | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  const employee = getUsers().find(
    candidate =>
      candidate.id === user?.id ||
      Boolean(email && candidate.email.trim().toLowerCase() === email)
  );

  return {
    name: employee?.name || user?.name || "",
    employeeId: employee?.employeeId || "",
    email: employee?.email || user?.email || "",
  };
}

export function getVendorCreationAuditFields(user: AuthenticatedVendorUser | null | undefined) {
  const identity = getVendorAuditIdentity(user);
  return {
    createdByName: identity.name,
    createdByEmployeeId: identity.employeeId,
    createdByEmail: identity.email,
    createdAt: new Date().toISOString(),
  };
}

export function getVendorUpdateAuditFields(user: AuthenticatedVendorUser | null | undefined) {
  const identity = getVendorAuditIdentity(user);
  return {
    updatedByName: identity.name,
    updatedByEmployeeId: identity.employeeId,
    updatedByEmail: identity.email,
    updatedAt: new Date().toISOString(),
  };
}