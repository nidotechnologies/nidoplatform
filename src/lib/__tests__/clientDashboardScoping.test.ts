import { describe, expect, it } from "vitest";
import {
  belongsToPortalUser,
  invoiceBelongsToPortalUser,
  invoiceReferencesOrders,
} from "@/lib/clientDashboardScoping";

const signedInUser = {
  id: "portal-user-a",
  email: "alex@example.com",
  name: "Alex Morgan",
};
const anotherUser = {
  id: "portal-user-b",
  email: "sam@example.com",
  name: "Sam Lee",
};

describe("client dashboard personal data scoping", () => {
  it("matches orders and tickets by stable user identity, not just client membership", () => {
    expect(belongsToPortalUser({ requestedById: signedInUser.id }, signedInUser, [signedInUser, anotherUser])).toBe(true);
    expect(belongsToPortalUser({ createdByEmail: "ALEX@example.com" }, signedInUser, [signedInUser, anotherUser])).toBe(true);
    expect(belongsToPortalUser({ requestedById: anotherUser.id }, signedInUser, [signedInUser, anotherUser])).toBe(false);
    expect(belongsToPortalUser({ clientId: "same-client" }, signedInUser, [signedInUser, anotherUser])).toBe(false);
  });

  it("accepts a legacy name only when it is unique among the client's portal users", () => {
    expect(belongsToPortalUser({ requester: "Alex Morgan" }, signedInUser, [signedInUser, anotherUser])).toBe(true);
    const duplicateNameUser = { id: "portal-user-c", email: "alex2@example.com", name: "Alex Morgan" };
    expect(
      belongsToPortalUser({ requester: "Alex Morgan" }, signedInUser, [signedInUser, duplicateNameUser]),
    ).toBe(false);
  });

  it("matches invoices only when they are tied to the signed-in user's orders", () => {
    const ownedOrders = [
      {
        id: "ORD-OWNED",
        poNumber: "PO-OWNED",
        productDetails: [{ subOrderId: "SO-ORD-OWNED-001" }],
      },
    ];

    expect(invoiceReferencesOrders({ poReference: "PO-OWNED" }, ownedOrders)).toBe(true);
    expect(invoiceReferencesOrders({ lineItems: [{ subOrderId: "SO-ORD-OWNED-001" }] }, ownedOrders)).toBe(true);
    expect(invoiceReferencesOrders({ poReference: "PO-OTHER" }, ownedOrders)).toBe(false);
    expect(invoiceReferencesOrders({ lineItems: [{ subOrderId: "SO-ORD-OWNED-OTHER-001" }] }, ownedOrders)).toBe(false);
    expect(
      invoiceBelongsToPortalUser(
        { createdById: anotherUser.id, originatingOrderId: "ORD-OWNED" },
        ownedOrders,
        signedInUser,
        [signedInUser, anotherUser],
      ),
    ).toBe(true);
    expect(
      invoiceBelongsToPortalUser(
        { createdById: anotherUser.id },
        ownedOrders,
        signedInUser,
        [signedInUser, anotherUser],
      ),
    ).toBe(false);
  });
});
