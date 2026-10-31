import { beforeEach, describe, expect, it } from "vitest";
import {
  cancelDraftPOsForOrder,
  getAllPOs,
  removeSubOrderFromDraftPOs,
  savePO,
  updatePO,
  type POLineItem,
  type StoredPO,
} from "../purchaseOrderStore";

const makeLine = (subOrderId: string, item: string, lineSubtotal: number): POLineItem => ({
  subOrderId,
  item,
  sku: `SKU-${subOrderId}`,
  category: "General",
  hsnCode: "",
  specs: [],
  referenceNumber: "",
  qty: 1,
  unitPrice: lineSubtotal,
  lineSubtotal,
  gstPct: 18,
  status: "Pending",
});

const makePO = (
  poNumber: string,
  status: StoredPO["status"],
  items: POLineItem[],
  orderId = "ORDER-1",
): StoredPO => {
  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const halfTax = subtotal * 0.09;
  const primary = items[0];

  return {
    poNumber,
    orderId,
    subOrderId: primary?.subOrderId || "",
    subOrderIds: items.map(item => item.subOrderId),
    items,
    vendorId: "VENDOR-1",
    vendorName: "Vendor One",
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
    item: primary?.item || "",
    sku: primary?.sku || "",
    category: primary?.category || "",
    hsnCode: primary?.hsnCode || "",
    specs: primary?.specs || [],
    referenceNumber: primary?.referenceNumber || "",
    qty: primary?.qty || 0,
    unitPrice: primary?.unitPrice || 0,
    subtotal,
    sgstPct: 9,
    cgstPct: 9,
    sgstAmt: halfTax,
    cgstAmt: halfTax,
    grandTotal: subtotal + halfTax + halfTax,
    paymentTerms: "Net 30",
    status,
    createdOn: "2026-10-15T00:00:00.000Z",
    createdOnDisplay: "15/10/2026",
    requestedDelivery: "",
    documents: [],
    notes: [],
  };
};

describe("purchaseOrderStore cancellation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("cancels a Draft PO without cancelling the linked client order items", () => {
    savePO(makePO("PO-00009", "Draft", [makeLine("SO-1", "Active item", 100)]));
    localStorage.setItem("nido_subitems_ORDER-1", JSON.stringify({
      "SO-1": { itemStatus: "Processing" },
    }));

    updatePO("PO-00009", { status: "Cancelled", cancelReason: "Draft PO abandoned" });

    expect(getAllPOs()[0].status).toBe("Cancelled");
    expect(JSON.parse(localStorage.getItem("nido_subitems_ORDER-1") || "{}")).toEqual({
      "SO-1": { itemStatus: "Processing" },
    });
  });

  it("projects confirmed PO line progress into the linked order and My Orders status", () => {
    const orderId = "ORDER-DIGITAL-1";
    const subOrderId = "SO-DIGITAL-1";
    const line = {
      ...makeLine(subOrderId, "Digital license", 100),
      qty: 4,
      productType: "Digital SaaS",
    } as POLineItem;
    savePO(makePO("PO-DIGITAL-1", "Draft", [line], orderId));
    localStorage.setItem("nido_my_orders", JSON.stringify([{
      id: orderId,
      status: "Processing",
      cartItems: [{ subOrderId, productType: "Digital SaaS", quantity: 4 }],
    }]));
    localStorage.setItem(`nido_subitems_${orderId}`, JSON.stringify({
      [subOrderId]: { itemStatus: "Processing" },
    }));

    updatePO("PO-DIGITAL-1", { status: "Confirmed" });
    const confirmedPO = getAllPOs()[0];
    updatePO("PO-DIGITAL-1", {
      items: confirmedPO.items.map(item => ({ ...item, status: "Provisioning" })),
    });

    expect(JSON.parse(localStorage.getItem(`nido_subitems_${orderId}`) || "{}")[subOrderId].itemStatus)
      .toBe("Provisioning");
    expect(JSON.parse(localStorage.getItem("nido_my_orders") || "[]")[0].status)
      .toBe("Provisioning");
  });

  it("removes one cancelled item from a Draft PO and recalculates the remaining PO", () => {
    const firstLine = makeLine("SO-1", "Cancelled item", 100);
    const remainingLine = makeLine("SO-2", "Remaining item", 50);
    const draft = makePO("PO-00010", "Draft", [firstLine, remainingLine]);
    draft.documents = [
      {
        id: "generated-pdf",
        name: "PO-00010.pdf",
        ext: "pdf",
        type: "Purchase Order PDF",
        uploadedBy: "System",
        uploadedOn: "15/10/2026",
        dataUrl: "data:application/pdf;base64,old",
      },
      {
        id: "vendor-attachment",
        name: "vendor-terms.pdf",
        ext: "pdf",
        type: "Attachment",
        uploadedBy: "Vendor",
        uploadedOn: "15/10/2026",
        dataUrl: "data:application/pdf;base64,terms",
      },
    ];
    savePO(draft);

    removeSubOrderFromDraftPOs("ORDER-1", "SO-1");

    const updated = getAllPOs()[0];
    expect(updated.items).toEqual([remainingLine]);
    expect(updated.subOrderId).toBe("SO-2");
    expect(updated.subOrderIds).toEqual(["SO-2"]);
    expect(updated.item).toBe("Remaining item");
    expect(updated.subtotal).toBe(50);
    expect(updated.sgstAmt).toBe(4.5);
    expect(updated.cgstAmt).toBe(4.5);
    expect(updated.grandTotal).toBe(59);
    expect(updated.documents[0].dataUrl).toBeUndefined();
    expect(updated.documents[1].dataUrl).toContain("terms");
  });

  it("removes an empty Draft PO but leaves confirmed POs unchanged", () => {
    const cancelledLine = makeLine("SO-1", "Cancelled item", 100);
    savePO(makePO("PO-00010", "Draft", [cancelledLine]));
    savePO(makePO("PO-00011", "Confirmed", [cancelledLine], "ORDER-1"));

    removeSubOrderFromDraftPOs("ORDER-1", "SO-1");

    expect(getAllPOs().map(po => po.poNumber)).toEqual(["PO-00011"]);
    expect(getAllPOs()[0].status).toBe("Confirmed");
  });

  it("marks every Draft PO for a cancelled order as Cancelled and preserves history", () => {
    savePO(makePO("PO-00010", "Draft", [makeLine("SO-1", "First item", 100)]));
    savePO(makePO("PO-00011", "Draft", [makeLine("SO-2", "Second item", 50)]));
    savePO(makePO("PO-00012", "Confirmed", [makeLine("SO-3", "Other order", 25)], "ORDER-2"));
    localStorage.setItem("nido_subitems_ORDER-1", JSON.stringify({}));

    const cancelledPOs = cancelDraftPOsForOrder("ORDER-1", "Customer cancelled");

    expect(cancelledPOs).toEqual(["PO-00011", "PO-00010"]);
    expect(getAllPOs().find(po => po.poNumber === "PO-00010")).toMatchObject({
      status: "Cancelled",
      cancelReason: "Customer cancelled",
    });
    expect(getAllPOs().find(po => po.poNumber === "PO-00011")?.status).toBe("Cancelled");
    expect(getAllPOs().find(po => po.poNumber === "PO-00012")?.status).toBe("Confirmed");
    expect(JSON.parse(localStorage.getItem("nido_subitems_ORDER-1") || "{}")).toMatchObject({
      "SO-1": { itemStatus: "Cancelled", cancelReason: "Customer cancelled" },
      "SO-2": { itemStatus: "Cancelled", cancelReason: "Customer cancelled" },
    });
  });
});
