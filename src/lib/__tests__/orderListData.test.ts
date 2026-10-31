import { describe, expect, it } from "vitest";
import { normalizeOrdersForList } from "../orderListData";

describe("normalizeOrdersForList", () => {
  it("keeps valid orders and supplies safe display values for missing fields", () => {
    const result = normalizeOrdersForList([
      { id: "ORD-1", client: "Acme", requester: "Sam", assigned: "Lee" },
    ]);

    expect(result.invalidCount).toBe(0);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      id: "ORD-1",
      client: "Acme",
      clientInitial: "A",
      requester: "Sam",
      requesterInitial: "S",
      assigned: "Lee",
      assignedInitial: "L",
      status: "Draft",
      cartItems: [],
    });
  });

  it("skips invalid rows and handles a non-array saved value without changing it", () => {
    const result = normalizeOrdersForList([
      null,
      { id: "", client: "Missing ID" },
      { id: "ORD-2", client: { name: "Invalid client shape" }, cartItems: {} },
    ]);

    expect(result.invalidCount).toBe(2);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].client).toBe("Unknown client");
    expect(result.orders[0].cartItems).toEqual([]);
    expect(normalizeOrdersForList({ bad: "saved payload" })).toEqual({ orders: [], invalidCount: 1 });
  });
});
