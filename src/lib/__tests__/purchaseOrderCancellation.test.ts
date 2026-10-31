import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPOs, updatePO, type StoredPO } from "../purchaseOrderStore";

const poStorageKey = "nido_all_purchase_orders";

function makePO(status: string, lineStatuses = ["Pending", "Pending"]): StoredPO {
  return {
    poNumber: "PO-CANCEL-TEST",
    orderId: "ORDER-CANCEL-TEST",
    subOrderId: "SUB-1",
    subOrderIds: ["SUB-1", "SUB-2"],
    items: lineStatuses.map((lineStatus, index) => ({
      subOrderId: `SUB-${index + 1}`,
      item: `Item ${index + 1}`,
      sku: `SKU-${index + 1}`,
      productCode: `PRODUCT-${index + 1}`,
      category: "Digital",
      hsnCode: "",
      specs: [],
      referenceNumber: "",
      qty: 1,
      unitPrice: 100,
      lineSubtotal: 100,
      status: lineStatus,
    })),
    vendorId: "VENDOR-1",
    vendorName: "Old Vendor",
    vendorContact: "",
    vendorEmail: "",
    vendorPhone: "",
    vendorGstin: "",
    vendorAddress: "",
    vendorAddressLine1: "",
    vendorAddressLine2: "",
    vendorCity: "",
    vendorState: "",
    vendorPincode: "",
    item: "Item 1",
    sku: "SKU-1",
    category: "Digital",
    hsnCode: "",
    specs: [],
    referenceNumber: "",
    qty: 1,
    unitPrice: 100,
    subtotal: 200,
    sgstPct: 9,
    cgstPct: 9,
    sgstAmt: 18,
    cgstAmt: 18,
    grandTotal: 236,
    paymentTerms: "Net 30",
    status: status as StoredPO["status"],
    createdOn: "2026-01-01T00:00:00.000Z",
    createdOnDisplay: "01/01/2026",
    requestedDelivery: "",
    documents: [],
    notes: [],
  };
}

function seedOrderItemState() {
  localStorage.setItem("nido_vendors_ORDER-CANCEL-TEST", JSON.stringify({
    "SUB-1": "VENDOR-1",
    "SUB-2": "VENDOR-1",
  }));
  localStorage.setItem("nido_subitems_ORDER-CANCEL-TEST", JSON.stringify({
    "SUB-1": {
      itemStatus: "Processing",
      selectedVendorId: "VENDOR-1",
      selectedVendorName: "Old Vendor",
      stockAllocations: [{ vendorId: "VENDOR-1", allocated: 1 }],
      referenceNumber: "OLD-REF",
      serialNumber: "OLD-SERIAL",
    },
    "SUB-2": {
      itemStatus: "Processing",
      selectedVendorId: "VENDOR-1",
      selectedVendorName: "Old Vendor",
      stockAllocations: [{ vendorId: "VENDOR-1", allocated: 1 }],
    },
  }));
}

describe("PO cancellation projection", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(poStorageKey, JSON.stringify([makePO("Confirmed")]));
    seedOrderItemState();
  });

  it.each(["Draft", "Confirmed"])("cancelling a %s PO reopens active order items for vendor selection", status => {
    localStorage.setItem(poStorageKey, JSON.stringify([makePO(status)]));
    const itemUpdate = vi.fn();
    window.addEventListener("orderSubItemsUpdated", itemUpdate);

    updatePO("PO-CANCEL-TEST", { status: "Cancelled", cancelReason: "Vendor unavailable" });

    const savedPO = getAllPOs()[0];
    const itemState = JSON.parse(localStorage.getItem("nido_subitems_ORDER-CANCEL-TEST") || "{}");
    expect(savedPO.status).toBe("Cancelled");
    for (const subOrderId of ["SUB-1", "SUB-2"]) {
      expect(itemState[subOrderId].itemStatus).toBe("Pending");
      expect(itemState[subOrderId].selectedVendorId).toBeNull();
      expect(itemState[subOrderId].stockAllocations).toEqual([]);
    }
    expect(itemState["SUB-1"].referenceNumber).toBe("");
    expect(itemState["SUB-1"].serialNumber).toBe("");
    expect(JSON.parse(localStorage.getItem("nido_vendors_ORDER-CANCEL-TEST") || "{}")).toEqual({});
    expect(itemUpdate).toHaveBeenCalled();
    window.removeEventListener("orderSubItemsUpdated", itemUpdate);
  });

  it("keeps an explicitly cancelled PO line closed while reopening its active siblings", () => {
    localStorage.setItem(poStorageKey, JSON.stringify([makePO("Confirmed", ["Pending", "Cancelled"])]));

    updatePO("PO-CANCEL-TEST", { status: "Cancelled", cancelReason: "Vendor unavailable" });

    const itemState = JSON.parse(localStorage.getItem("nido_subitems_ORDER-CANCEL-TEST") || "{}");
    expect(itemState["SUB-1"].itemStatus).toBe("Pending");
    expect(itemState["SUB-1"].selectedVendorId).toBeNull();
    expect(itemState["SUB-2"].itemStatus).toBe("Cancelled");
    expect(itemState["SUB-2"].cancelReason).toBe("Vendor unavailable");
  });
});
