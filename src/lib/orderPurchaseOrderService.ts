import type { MyOrder, OrderCartItem } from "../contexts/MyOrdersContext";
import { getPrefix } from "./configService";
import { appendOrderActivity } from "./orderActivityStore";
import { getEffectiveTaxPctForCategory } from "./taxEngine";
import {
  generatePoNumber,
  getAllPOs,
  savePO,
  type POLineItem,
  type PONote,
  type StoredPO,
} from "./purchaseOrderStore";
import { getVendorById } from "./vendorDataStore";

const ORDERS_KEY = "nido_my_orders";

/**
 * Creates the vendor Draft POs for an order after its approval gate has passed.
 * The operation is idempotent so approval refreshes or repeated clicks cannot
 * create duplicate POs.
 */
export function createDraftPOsForOrder(
  orderId: string,
  cartItems: OrderCartItem[],
  paymentTerms: string,
): number {
  if (!orderId || !cartItems.length) return 0;
  const existingPOs = getAllPOs().filter(po => po.orderId === orderId);
  const coveredSubOrderIds = new Set(
    existingPOs
      .filter(po => String(po.status || "").toLowerCase() !== "cancelled")
      .flatMap(po => po.subOrderIds?.length ? po.subOrderIds : [po.subOrderId]),
  );

  // Normalize legacy items before grouping. The old implementation generated
  // fallback sub-order IDs using the index inside each vendor group, so the
  // second vendor's first line could be linked to the first item's sub-order.
  // Order Details then could not find a PO for that item.
  const normalizedCartItems = cartItems.map((item, index) => ({
    ...item,
    subOrderId: item.subOrderId
      || `SO-${orderId}-${String(index + 1).padStart(3, "0")}`,
  }));

  const vendorGroups = new Map<string, OrderCartItem[]>();
  for (const item of normalizedCartItems) {
    if (!item.selectedVendorId) continue;
    const subOrderId = item.subOrderId;
    // Idempotency is per item, not per order. A partially-created order must
    // still receive a Draft PO for every selected item that is not covered.
    if (subOrderId && coveredSubOrderIds.has(subOrderId)) continue;
    if (!vendorGroups.has(item.selectedVendorId)) vendorGroups.set(item.selectedVendorId, []);
    vendorGroups.get(item.selectedVendorId)!.push(item);
  }
  if (vendorGroups.size === 0) return 0;

  const now = new Date();
  const displayDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  let createdCount = 0;

  for (const [vendorId, items] of vendorGroups.entries()) {
    const vendor = getVendorById(vendorId);
    const poNumber = generatePoNumber();
    const lineItems: POLineItem[] = items.map((item, index) => {
      const subOrderId = item.subOrderId!;
      const unitPrice = item.landedCost || item.vendorPrice || item.priceNum || 0;
      const qty = item.quantity;
      const gstPct = item.gstSnapshot ?? getEffectiveTaxPctForCategory(item.category);
      return {
        subOrderId,
        item: item.name,
        sku: item.productCode || `${getPrefix("sku") || "SKU-"}${item.id}`,
        productCode: item.productCode || "",
        category: item.category || "General",
        hsnCode: item.hsnSnapshot || "",
        specs: Array.isArray(item.specs) ? item.specs : [],
        referenceNumber: "",
        qty,
        unitPrice,
        lineSubtotal: unitPrice * qty,
        gstPct,
        productType: item.productType,
        physicalType: item.physicalType,
        commercialTerms: item.commercialTerms,
        configuration: item.configuration,
        configurationPriceAdjustment: item.configurationPriceAdjustment,
        status: "Pending",
        tracking: null,
      };
    });

    const subtotal = lineItems.reduce((sum, line) => sum + line.lineSubtotal, 0);
    const primaryGst = lineItems[0]?.gstPct ?? 18;
    const halfGst = primaryGst / 2;
    const sgstAmt = Math.round(
      lineItems.reduce((sum, line) => sum + line.lineSubtotal * ((line.gstPct ?? 18) / 2) / 100, 0) * 100,
    ) / 100;
    const grandTotal = subtotal + sgstAmt + sgstAmt;
    const vendorAddress = [
      vendor?.addressLine1,
      vendor?.addressLine2,
      vendor?.city,
      vendor?.state,
      vendor?.zipCode,
    ].filter(Boolean).join(", ");
    const creationNote: PONote = {
      id: `audit_created_${Date.now()}_${vendorId}`,
      author: "System",
      initials: "SY",
      color: "#6b7280",
      date: displayDate,
      text: `Draft PO ${poNumber} created after approval for order ${orderId}. Vendor: ${vendor?.name || vendorId}. ${lineItems.length} item${lineItems.length !== 1 ? "s" : ""} — Grand Total ₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}. Awaiting admin review and confirmation.`,
      visibility: "Internal Note",
    };

    const po: StoredPO = {
      poNumber,
      orderId,
      subOrderId: lineItems[0]?.subOrderId || "",
      subOrderIds: lineItems.map(line => line.subOrderId),
      items: lineItems,
      vendorId,
      vendorName: vendor?.name || items[0].selectedVendorName || vendorId,
      vendorContact: vendor?.primaryContact || "",
      vendorEmail: vendor?.email || "",
      vendorPhone: vendor?.phone || "",
      vendorGstin: vendor?.taxId || "",
      vendorAddress,
      vendorAddressLine1: vendor?.addressLine1 || "",
      vendorAddressLine2: vendor?.addressLine2 || "",
      vendorCity: vendor?.city || "",
      vendorState: vendor?.state || "",
      vendorPincode: vendor?.zipCode || "",
      item: lineItems[0]?.item || "",
      sku: lineItems[0]?.sku || "",
      category: lineItems[0]?.category || "",
      hsnCode: lineItems[0]?.hsnCode || "",
      specs: lineItems[0]?.specs || [],
      referenceNumber: "",
      qty: lineItems[0]?.qty || 0,
      unitPrice: lineItems[0]?.unitPrice || 0,
      subtotal,
      sgstPct: halfGst,
      cgstPct: halfGst,
      sgstAmt,
      cgstAmt: sgstAmt,
      grandTotal,
      paymentTerms: paymentTerms || "Net 30",
      status: "Draft",
      createdOn: now.toISOString(),
      createdOnDisplay: displayDate,
      requestedDelivery: "",
      documents: [],
      notes: [creationNote],
    };
    savePO(po);
    appendOrderActivity(
      orderId,
      `Purchase Order ${poNumber} was generated for vendor ${po.vendorName}. Status: Draft.`,
      { actor: "System", eventType: "activity", id: `activity_po_generated_${poNumber}` },
    );
    createdCount += 1;
  }

  return createdCount;
}

/**
 * Resolves an order from the shared local order store and releases its
 * vendor POs after an approval request reaches Approved.
 */
export function createDraftPOsForStoredOrder(orderId: string): number {
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]") as MyOrder[];
    const order = orders.find(item => item.id === orderId);
    // Approval completion can be delivered late (another tab or a queued
    // backend response). Never release procurement work for a cancelled order.
    if (!order?.cartItems?.length || order.status === "Cancelled" || order.status === "Draft") return 0;
    const created = createDraftPOsForOrder(order.id, order.cartItems, order.paymentTerms || "");
    if (created > 0) {
      window.dispatchEvent(new CustomEvent("orderApprovalProcessed", { detail: { orderId, poCount: created } }));
    }
    return created;
  } catch {
    return 0;
  }
}