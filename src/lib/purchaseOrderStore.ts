// ── Shared purchase-order store (localStorage) ────────────────────────────────
// All POs created from the order-detail flow are written here so that
// VendorOrdersPage and VendorOrderDetailPage can read real data.

import { getPrefix } from "./configService";
import type { ProductCommercialTerms } from "./productCommercialTerms";
import { syncMasterOrderFulfillmentStatus } from "./orderFulfillmentStatus";

export interface PODocument {
  id: string;
  name: string;
  ext: string;
  type: string;
  uploadedBy: string;
  uploadedOn: string;
  dataUrl?: string; // base64 data-URI for in-app download
}

export interface PONote {
  id: string;
  author: string;
  initials: string;
  color: string;
  date: string;
  text: string;
  visibility: string;
  kind?: "activity" | "status-change";
}

export type POStatus =
  | "Draft"
  | "Confirmed"
  | "Partially Shipped"
  | "Vendor Notified"
  | "Accepted"
  | "Dispatched"
  | "Delivered"
  | "Completed"
  | "Cancelled";

/**
 * Status labels shown to vendors and on vendor-facing PO pages.
 * Draft/Confirmed remain the persisted lifecycle values because they control
 * editability and confirmation, but the UI should expose the procurement state
 * as Pending/Processing.
 */
export function getPODisplayStatus(status: unknown): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "draft") return "Pending";
  if (normalized === "confirmed") return "Processing";
  return String(status || "Pending");
}

/** One line-item inside a multi-item PO */
export interface POLineItem {
  subOrderId: string;
  item: string;
  sku: string;
  /** Master product code — used to deduct / restore vendor stock when PO is raised / cancelled */
  productCode?: string;
  category: string;
  hsnCode: string;
  specs: string[];
  referenceNumber: string;
  serialNumber?: string;
  qty: number;
  unitPrice: number;
  lineSubtotal: number;
  /** Full GST rate for this line item (e.g. 18 for 18%). Stored so the PDF can show per-item rates. */
  gstPct?: number;
  productType?: string;
  commercialTerms?: ProductCommercialTerms;
  /** Shop configuration selected for this service or digital product. */
  configuration?: Record<string, string>;
  configurationPriceAdjustment?: number;
  /** Fulfilment state and shipment details for this specific PO line. */
  status?: string;
  cancelReason?: string;
  tracking?: {
    number: string;
    carrier: string;
    note: string;
    link: string;
  } | null;
}

export interface StoredPO {
  poNumber: string;
  orderId: string;       // master order ID
  subOrderId: string;   // primary sub-order (first item; kept for backward compat)
  subOrderIds: string[]; // all sub-order IDs covered by this PO
  items: POLineItem[];   // all line items (may be more than one if same vendor)
  vendorId: string;
  vendorName: string;
  vendorContact: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorGstin: string;
  vendorAddress: string;   // full single-line address
  vendorAddressLine1: string;
  vendorAddressLine2: string;
  vendorCity: string;
  vendorState: string;
  vendorPincode: string;
  item: string;
  sku: string;
  category: string;
  hsnCode: string;
  specs: string[];
  referenceNumber: string;
  serialNumber?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  sgstPct: number;
  cgstPct: number;
  sgstAmt: number;
  cgstAmt: number;
  grandTotal: number;
  paymentTerms: string;
  status: POStatus;
  createdOn: string;      // ISO string
  createdOnDisplay: string; // "DD/MM/YYYY"
  requestedDelivery: string;
  documents: PODocument[];
  notes: PONote[];
  cancelReason?: string;
}

/** A PO locks its order only after it has left the editable Draft state. */
export function isPOConfirmed(po: Pick<StoredPO, "status"> | null | undefined): boolean {
  const status = String(po?.status || "").toLowerCase();
  // Missing/legacy status is not evidence that a PO was generated. Treat it
  // as pending so an order cannot become accidentally non-cancellable merely
  // because an incomplete PO record exists in localStorage.
  return Boolean(status) && status !== "draft" && status !== "cancelled" && status !== "rejected";
}

function syncPOFulfillmentToClientOrder(po: StoredPO): void {
  if (typeof window === "undefined" || !po.orderId || !isPOConfirmed(po) || !po.items?.length) return;
  const key = `nido_subitems_${po.orderId}`;
  let itemStates: Record<string, any> = {};
  try {
    itemStates = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    itemStates = {};
  }

  const changedSubOrderIds: string[] = [];
  const updatedOn = new Date().toLocaleDateString("en-IN");
  po.items.forEach((line, index) => {
    const subOrderId = line.subOrderId || po.subOrderIds?.[index] || "";
    if (!subOrderId) return;
    const existing = itemStates[subOrderId] || {};
    const rawStatus = String(line.status || "").trim();
    const itemStatus = !rawStatus || ["pending", "confirmed"].includes(rawStatus.toLowerCase())
      ? "Processing"
      : rawStatus;
    if (existing.itemStatus === "Cancelled" && itemStatus !== "Cancelled") return;
    if (
      ["Return Request Raised", "Pickup Scheduled", "Pickup Done"].includes(existing.itemStatus) &&
      itemStatus === "Delivered"
    ) return;

    const updated = {
      ...existing,
      itemStatus,
      statusOwner: "purchase-order",
      updatedOn,
      ...(line.tracking !== undefined ? {
        tracking: line.tracking,
        trackingOwner: line.tracking ? "purchase-order" : undefined,
      } : {}),
      ...(line.referenceNumber !== undefined ? { referenceNumber: line.referenceNumber } : {}),
      ...(line.serialNumber !== undefined ? { serialNumber: line.serialNumber } : {}),
    };
    if (JSON.stringify(updated) !== JSON.stringify(existing)) {
      itemStates[subOrderId] = updated;
      changedSubOrderIds.push(subOrderId);
    }
  });

  if (changedSubOrderIds.length) {
    localStorage.setItem(key, JSON.stringify(itemStates));
    window.dispatchEvent(new CustomEvent("orderSubItemsUpdated", {
      detail: { orderId: po.orderId, subOrderIds: changedSubOrderIds },
    }));
  }
  // Keep the order-list summary aligned even when Order Details is not open.
  syncMasterOrderFulfillmentStatus(po.orderId);
}

const STORAGE_KEY = "nido_all_purchase_orders";

export function getAllPOs(): StoredPO[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getPOByNumber(poNumber: string): StoredPO | undefined {
  return getAllPOs().find((p) => p.poNumber === poNumber);
}

export function savePO(po: StoredPO): void {
  const all = getAllPOs();
  const idx = all.findIndex((p) => p.poNumber === po.poNumber);
  if (idx >= 0) {
    all[idx] = po;
  } else {
    all.unshift(po);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  syncPOFulfillmentToClientOrder(po);
  // Notify any listening page (e.g. PurchaseOrdersPage) to refresh
  try { window.dispatchEvent(new CustomEvent("poCreated", { detail: { poNumber: po.poNumber } })); } catch { /* SSR safe */ }
}

export function updatePO(
  poNumber: string,
  changes: Partial<StoredPO>,
  options: { cancelLinkedItems?: boolean } = {},
): void {
  const all = getAllPOs();
  const idx = all.findIndex((p) => p.poNumber === poNumber);
  if (idx >= 0) {
    const existing = all[idx];
    if (existing.status === "Delivered" && changes.status && changes.status !== "Delivered") return;
    if (
      changes.status === "Delivered" &&
      existing.status !== "Shipped" &&
      existing.status !== "Partially Delivered" &&
      existing.status !== "Delivered"
    ) return;
    all[idx] = { ...all[idx], ...changes };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    // A PO cancellation is recorded globally, but does not itself cancel the
    // customer sub-orders. Active lines return to Pending with the old vendor
    // allocation cleared so Order Details can source them again. Explicit
    // sub-order/master-order cancellations remain terminal.
    if (changes.status === "Cancelled") {
      const po = all[idx];
      const orderId = po.orderId;
      const allLinesCancelled = Boolean(po.items?.length) && po.items.every(
        line => String(line.status || "").toLowerCase() === "cancelled",
      );
      const cancelLinkedItems = options.cancelLinkedItems === true || allLinesCancelled;
      const subOrderIds: string[] = po.subOrderIds?.length
        ? po.subOrderIds
        : [po.subOrderId].filter(Boolean);
      const cancelledLineIds = new Set<string>();
      (po.items || []).forEach((line, index) => {
        if (String(line.status || "").toLowerCase() !== "cancelled") return;
        const subId = line.subOrderId || po.subOrderIds?.[index];
        if (subId) cancelledLineIds.add(subId);
      });

      try {
        // Remove createdPOs entries for these sub-orders
        const posKey = `nido_pos_${orderId}`;
        const createdPOs: Record<string, any> = JSON.parse(localStorage.getItem(posKey) || "{}");
        let changed = false;
        for (const key of Object.keys(createdPOs)) {
          if (subOrderIds.includes(createdPOs[key]?.subOrderId)) {
            delete createdPOs[key];
            changed = true;
          }
        }
        if (changed) localStorage.setItem(posKey, JSON.stringify(createdPOs));
      } catch { /* storage unavailable */ }

      try {
        // Remove vendor selection entries for these sub-orders
        const vendorsKey = `nido_vendors_${orderId}`;
        const vendors: Record<string, string> = JSON.parse(localStorage.getItem(vendorsKey) || "{}");
        let changed = false;
        for (const subId of subOrderIds) {
          if (subId in vendors) { delete vendors[subId]; changed = true; }
        }
        if (changed) localStorage.setItem(vendorsKey, JSON.stringify(vendors));
      } catch { /* storage unavailable */ }

      try {
        const itemStateKey = `nido_subitems_${orderId}`;
        const itemState: Record<string, any> = JSON.parse(localStorage.getItem(itemStateKey) || "{}");
        for (const subId of subOrderIds) {
          const itemCancelled = cancelLinkedItems || cancelledLineIds.has(subId);
          itemState[subId] = {
            ...(itemState[subId] || {}),
            itemStatus: itemCancelled ? "Cancelled" : "Pending",
            cancelReason: itemCancelled ? changes.cancelReason || "Purchase order cancelled" : "",
            tracking: null,
            trackingOwner: undefined,
            updatedOn: new Date().toLocaleDateString("en-IN"),
            ...(itemCancelled ? {} : {
              selectedVendorId: null,
              selectedVendorName: "",
              vendorSelectionMeta: null,
              stockAllocations: [],
              referenceNumber: "",
              serialNumber: "",
            }),
          };
        }
        localStorage.setItem(itemStateKey, JSON.stringify(itemState));
        syncMasterOrderFulfillmentStatus(orderId);
      } catch { /* storage unavailable */ }

      // Notify OrderDetailsPage (same tab) to sync its React state from localStorage
      try {
        window.dispatchEvent(new CustomEvent("poCancelled", {
          detail: { poNumber, orderId, subOrderIds },
        }));
        window.dispatchEvent(new CustomEvent("orderSubItemsUpdated", {
          detail: {
            orderId,
            subOrderIds,
            reason: changes.cancelReason || "Purchase order cancelled",
            reopenedSubOrderIds: subOrderIds.filter(subId => !cancelLinkedItems && !cancelledLineIds.has(subId)),
          },
        }));
      } catch { /* SSR safe */ }
    }

    if (changes.status !== "Cancelled" && (changes.status !== undefined || changes.items !== undefined)) {
      syncPOFulfillmentToClientOrder(all[idx]);
    }
    try { window.dispatchEvent(new CustomEvent("poCreated", { detail: { poNumber } })); } catch { /* SSR safe */ }
  }
}

/** Append a durable PO activity entry without replacing manual notes. */
export function appendPOActivity(
  poNumber: string,
  note: PONote,
): void {
  const all = getAllPOs();
  const idx = all.findIndex(po => po.poNumber === poNumber);
  if (idx < 0) return;
  const existing = all[idx].notes || [];
  if (existing.some(item => item.id === note.id)) return;
  all[idx] = { ...all[idx], notes: [note, ...existing] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  try {
    window.dispatchEvent(new CustomEvent("poActivityUpdated", { detail: { poNumber } }));
  } catch {
    /* SSR safe */
  }
}

/**
 * Mark every still-editable PO for a cancelled master order as Cancelled.
 * Draft POs remain in the store for audit/history, but updatePO's cancellation
 * projection makes their covered order items inactive and removes vendor
 * selection/action mappings.
 */
export function cancelDraftPOsForOrder(orderId: string, cancelReason?: string): string[] {
  const reason = cancelReason?.trim() || "Master order cancelled";
  const draftPOs = getAllPOs().filter(po => po.orderId === orderId && po.status === "Draft");
  draftPOs.forEach(po => updatePO(po.poNumber, { status: "Cancelled", cancelReason: reason }, { cancelLinkedItems: true }));
  return draftPOs.map(po => po.poNumber);
}

/**
 * Permanently removes a Draft PO.
 *
 * Draft POs are editable working records. This is intentionally restricted to
 * Draft status so confirmed/cancelled procurement history cannot be erased.
 */
export function deleteDraftPO(poNumber: string): void {
  const all = getAllPOs();
  const po = all.find((candidate) => candidate.poNumber === poNumber);
  if (!po || po.status !== "Draft") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((candidate) => candidate.poNumber !== poNumber)));
  try {
    window.dispatchEvent(new CustomEvent("poCreated", {
      detail: { poNumber, action: "deleted" },
    }));
  } catch {
    /* SSR safe */
  }
}

/**
 * Remove one cancelled sub-order from any Draft PO for its master order.
 * If it was the only line, the Draft PO is removed. Multi-line POs keep their
 * remaining products and have their totals/primary line metadata recalculated.
 */
export function removeSubOrderFromDraftPOs(orderId: string, subOrderId: string): void {
  const all = getAllPOs();
  const removedPoNumbers = new Set<string>();
  let changed = false;

  const next = all.flatMap((po) => {
    if (po.orderId !== orderId || po.status !== "Draft") return [po];

    const items = Array.isArray(po.items) ? po.items : [];
    const remainingItems = items.filter((item) => item.subOrderId !== subOrderId);
    const covered = remainingItems.length !== items.length
      || po.subOrderId === subOrderId
      || po.subOrderIds?.includes(subOrderId);

    if (!covered) return [po];
    changed = true;

    if (remainingItems.length === 0) {
      removedPoNumbers.add(po.poNumber);
      return [];
    }

    const subtotal = remainingItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const sgstAmt = Math.round(
      remainingItems.reduce((sum, item) => sum + item.lineSubtotal * ((item.gstPct ?? 18) / 2) / 100, 0) * 100,
    ) / 100;
    const cgstAmt = sgstAmt;
    const primary = remainingItems[0];

    return [{
      ...po,
      items: remainingItems,
      subOrderId: primary.subOrderId,
      subOrderIds: remainingItems.map((item) => item.subOrderId),
      item: primary.item,
      sku: primary.sku,
      category: primary.category,
      hsnCode: primary.hsnCode,
      specs: primary.specs,
      referenceNumber: primary.referenceNumber,
      serialNumber: primary.serialNumber || "",
      qty: primary.qty,
      unitPrice: primary.unitPrice,
      subtotal,
      sgstPct: (primary.gstPct ?? 18) / 2,
      cgstPct: (primary.gstPct ?? 18) / 2,
      sgstAmt,
      cgstAmt,
      grandTotal: subtotal + sgstAmt + cgstAmt,
      documents: (po.documents || []).map((document) => {
        const isSystemDocument = String(document.uploadedBy || "").toLowerCase() === "system";
        const isGeneratedPO = isSystemDocument && (
          String(document.type || "").toLowerCase().includes("purchase order") ||
          String(document.name || "").toLowerCase() === `${String(po.poNumber || "").toLowerCase()}.pdf`
        );
        return isGeneratedPO ? { ...document, dataUrl: undefined } : document;
      }),
    }];
  });

  if (!changed) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  // Keep the legacy per-order PO projection in sync where older flows created it.
  try {
    const posKey = `nido_pos_${orderId}`;
    const legacyPOs: Record<string, any> = JSON.parse(localStorage.getItem(posKey) || "{}");
    let legacyChanged = false;
    for (const key of Object.keys(legacyPOs)) {
      const entry = legacyPOs[key];
      if (entry?.subOrderId === subOrderId || removedPoNumbers.has(entry?.poNumber)) {
        delete legacyPOs[key];
        legacyChanged = true;
      }
    }
    if (legacyChanged) localStorage.setItem(posKey, JSON.stringify(legacyPOs));
  } catch {
    /* storage unavailable */
  }

  try {
    window.dispatchEvent(new CustomEvent("poCreated", {
      detail: { orderId, subOrderId, action: "lineRemoved" },
    }));
  } catch {
    /* SSR safe */
  }
}

// Dedicated monotonic counter — avoids rescanning all POs each time.
const COUNTER_KEY = "nido_po_counter";

/**
 * Generate the next PO number.
 * The current stored PO records are the source of truth for the next serial
 * number. The counter is resynchronised from them so a number consumed by a
 * temporary Draft PO does not make later vendor changes jump over an unused
 * number.
 * Reads the current prefix from config so changes in General Settings take effect immediately.
 */
export function generatePoNumber(): string {
  const prefix = getPrefix("purchaseOrder") || "PO-";

  // Build regex dynamically from current prefix to parse existing numbers
  const prefixEscaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${prefixEscaped}(\\d+)$`);

  const existing = new Set(
    getAllPOs()
      .map(p => { const m = p.poNumber.match(re); return m ? parseInt(m[1], 10) : 0; })
  );

  // Start after the highest currently stored PO (8 is one before the sample
  // PO-00008). This deliberately ignores a stale counter left by a Draft PO
  // that was merged or removed during vendor reassignment.
  const highestExisting = Math.max(8, ...existing);
  let next = highestExisting + 1;

  // Skip any numbers already in use (defensive against concurrent writes).
  while (existing.has(next)) next++;

  localStorage.setItem(COUNTER_KEY, String(next));
  return `${prefix}${String(next).padStart(5, "0")}`;
}
