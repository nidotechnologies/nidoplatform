import { describe, expect, it } from "vitest";
import { serviceRequestBelongsToPortalUser } from "@/lib/serviceRequestAccess";

const currentUser = {
  id: "portal-client-a-user",
  email: "alex@example.com",
  name: "Alex Morgan",
  clientId: "client-a",
};

const clientUsers = [
  { ...currentUser, password: "unused", userType: "client_user" as const, clientName: "Client A", role: "Employee", status: "active" as const, createdAt: "" },
  { id: "portal-client-a-user-b", email: "sam@example.com", name: "Sam Lee", clientId: "client-a", password: "unused", userType: "client_user" as const, clientName: "Client A", role: "Employee", status: "active" as const, createdAt: "" },
];

describe("portal service request visibility", () => {
  it("shows an owned request for the matching client", () => {
    expect(serviceRequestBelongsToPortalUser({
      id: "request-a",
      clientId: "client-a",
      requestType: "AMC",
      itemAsset: "Equipment",
      assetTag: "",
      location: "",
      requestDate: "",
      requestDateTs: 0,
      status: "Pending",
      priority: "Low",
      nextAppointment: "",
      requestedBy: "Alex Morgan",
      requestedById: currentUser.id,
    }, currentUser, clientUsers)).toBe(true);
  });

  it("hides another user's request and all records explicitly assigned to another client", () => {
    const base = {
      id: "request-a",
      clientId: "client-a",
      requestType: "AMC",
      itemAsset: "Equipment",
      assetTag: "",
      location: "",
      requestDate: "",
      requestDateTs: 0,
      status: "Pending",
      priority: "Low",
      nextAppointment: "",
      requestedBy: "Sam Lee",
    };
    expect(serviceRequestBelongsToPortalUser({ ...base, requestedById: "portal-client-a-user-b" }, currentUser, clientUsers)).toBe(false);
    expect(serviceRequestBelongsToPortalUser({ ...base, clientId: "client-b", requestedById: currentUser.id }, currentUser, clientUsers)).toBe(false);
  });

  it("fails closed on unscoped legacy records unless the stable user ID matches", () => {
    const base = {
      id: "request-legacy",
      requestType: "Repair Service",
      itemAsset: "Equipment",
      assetTag: "",
      location: "",
      requestDate: "",
      requestDateTs: 0,
      status: "Pending",
      priority: "Low",
      nextAppointment: "",
      requestedBy: "Alex Morgan",
    };
    expect(serviceRequestBelongsToPortalUser(base, currentUser, clientUsers)).toBe(false);
    expect(serviceRequestBelongsToPortalUser({ ...base, requestedById: currentUser.id }, currentUser, clientUsers)).toBe(true);
  });
});
