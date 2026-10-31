import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveClientContract,
  getClientContract,
  getClientContracts,
  getClientOrders,
  saveClientContract,
} from "@/lib/clientDataStore";

describe("client order source mapping", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("preserves saved checkout notes and delivery snapshots from master orders", () => {
    localStorage.setItem("nido_my_orders", JSON.stringify([{
      id: "order-1",
      clientId: "client-1",
      client: "Acme",
      orderDate: "2026-10-01",
      orderNotes: "Call before delivery",
      deliveryAddress: "12 Market Road, Pune",
      deliveryDetails: {
        label: "Office",
        attentionName: "Asha",
        line1: "12 Market Road",
        line2: "Suite 4",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        zip: "411001",
        phone: "9876543210",
        instructions: "Use the rear entrance",
      },
      cartItems: [{ id: 1, name: "Router", quantity: 2, clientId: "client-1" }],
    }]));

    const [order] = getClientOrders("client-1", "Acme");

    expect(order).toMatchObject({
      id: "order-1",
      orderNotes: "Call before delivery",
      deliveryAddress: "12 Market Road, Pune",
      deliveryDetails: {
        label: "Office",
        attentionName: "Asha",
        line1: "12 Market Road",
        instructions: "Use the rear entrance",
      },
      cartItems: [{ id: 1, name: "Router", quantity: 2 }],
    });
  });

  it("stores multiple contracts for a client and updates only the matching contract", () => {
    saveClientContract({
      clientId: "client-1",
      contractId: "CON-1",
      contractTitle: "Support Agreement",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      data: { overview: { purpose: "Support" } },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    saveClientContract({
      clientId: "client-1",
      contractId: "CON-2",
      contractTitle: "License Agreement",
      data: {},
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    saveClientContract({
      clientId: "client-1",
      contractId: "CON-1",
      contractTitle: "Updated Support Agreement",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
      data: { overview: { purpose: "Updated support" } },
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    expect(getClientContracts("client-1").map(contract => contract.contractId)).toEqual(["CON-1", "CON-2"]);
    expect(getClientContract("client-1", "CON-2")?.contractTitle).toBe("License Agreement");
    expect(getClientContract("client-1")?.contractTitle).toBe("Updated Support Agreement");
    expect(getClientContracts("client-2")).toEqual([]);
  });

  it("archives a contract without deleting its details or losing the archived state on save", () => {
    saveClientContract({
      clientId: "client-archive-test",
      contractId: "CON-ARCHIVE",
      contractTitle: "Support Agreement",
      data: { overview: { purpose: "Keep supporting Acme" } },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(archiveClientContract("client-archive-test", "CON-ARCHIVE")).toBe(true);
    const archived = getClientContract("client-archive-test", "CON-ARCHIVE");
    expect(archived).toMatchObject({
      archivedAt: expect.any(String),
      data: { overview: { purpose: "Keep supporting Acme" } },
    });

    saveClientContract({
      ...archived!,
      contractTitle: "Updated Support Agreement",
      archivedAt: undefined,
    });

    expect(getClientContract("client-archive-test", "CON-ARCHIVE")).toMatchObject({
      contractTitle: "Updated Support Agreement",
      archivedAt: expect.any(String),
    });
    expect(archiveClientContract("client-archive-test", "missing")).toBe(false);
  });
});
