import { beforeEach, describe, expect, it } from "vitest";
import {
  deriveOrderFulfillmentStatus,
  derivePOFulfillmentStatus,
  deriveMasterOrderFulfillmentStatus,
  syncMasterOrderFulfillmentStatus,
} from "@/lib/orderFulfillmentStatus";

describe("master order fulfillment status", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("derives the master status from all sub-order item statuses", () => {
    expect(deriveMasterOrderFulfillmentStatus(["Processing", "Shipped"])).toBe("Partially Shipped");
    expect(deriveMasterOrderFulfillmentStatus(["Delivered", "Processing"])).toBe("Partially Delivered");
    expect(deriveMasterOrderFulfillmentStatus(["Delivered", "Return Request Raised"])).toBe("Delivered");
    expect(deriveMasterOrderFulfillmentStatus(["Pending Shipping", "Processing"])).toBe("Pending Shipping");
    expect(deriveMasterOrderFulfillmentStatus(["Cancelled", "Cancelled"])).toBe("Cancelled");
  });

  it("persists the newly derived status and notifies the shared order context", () => {
    const orderId = "ORD-STATUS-1";
    localStorage.setItem("nido_my_orders", JSON.stringify([{
      id: orderId,
      status: "Processing",
      cartItems: [
        { subOrderId: "SO-STATUS-1" },
        { subOrderId: "SO-STATUS-2" },
      ],
    }]));
    localStorage.setItem(`nido_subitems_${orderId}`, JSON.stringify({
      "SO-STATUS-1": { itemStatus: "Delivered" },
      "SO-STATUS-2": { itemStatus: "Processing" },
    }));

    const events: CustomEvent[] = [];
    const onStatusUpdated = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener("orderFulfillmentStatusUpdated", onStatusUpdated);

    expect(syncMasterOrderFulfillmentStatus(orderId)).toBe("Partially Delivered");
    const savedOrders = JSON.parse(localStorage.getItem("nido_my_orders") || "[]");

    window.removeEventListener("orderFulfillmentStatusUpdated", onStatusUpdated);
    expect(savedOrders[0].status).toBe("Partially Delivered");
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ orderId, status: "Partially Delivered" });
  });

  it("shows digital fulfillment progress on PO and master-order summaries", () => {
    const line = {
      subOrderId: "SO-DIGITAL-1",
      productType: "Digital SaaS",
      qty: 4,
      status: "Partially Provisioned (2/4)",
    };
    expect(deriveOrderFulfillmentStatus([line])).toBe("Partially Provisioned");
    expect(derivePOFulfillmentStatus({ status: "Confirmed", items: [line] })).toBe("Partially Provisioned");
    expect(deriveOrderFulfillmentStatus([{ ...line, status: "Activated" }])).toBe("Activated");

    const orderId = "ORD-DIGITAL-1";
    localStorage.setItem("nido_my_orders", JSON.stringify([{
      id: orderId,
      status: "Processing",
      cartItems: [{ ...line, status: undefined }],
    }]));
    localStorage.setItem(`nido_subitems_${orderId}`, JSON.stringify({
      [line.subOrderId]: { itemStatus: line.status },
    }));
    expect(syncMasterOrderFulfillmentStatus(orderId)).toBe("Partially Provisioned");
  });
});
