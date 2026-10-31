import { deriveDigitalFulfillmentStatus } from "./digitalFulfillmentStatuses";
import { isDigitalDocumentProduct } from "./productDocumentRules";

export type FulfillmentStatus =
  | "Pending"
  | "Processing"
  | "Pending Shipping"
  | "Partially Shipped"
  | "Shipped"
  | "Partially Delivered"
  | "Delivered"
  | "Provisioning"
  | "Partially Provisioned"
  | "Provisioned"
  | "Activated"
  | "Completed"
  | "Cancelled";

const ORDERS_KEY = "nido_my_orders";

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

function isDelivered(status: unknown): boolean {
  return normalize(status) === "delivered";
}

function isReturnWorkflow(status: unknown): boolean {
  return [
    "return request raised",
    "pickup scheduled",
    "pickup done",
  ].includes(normalize(status));
}

function isDeliveryComplete(status: unknown): boolean {
  return isDelivered(status) || isReturnWorkflow(status) || normalize(status) === "completed";
}

function isShipped(status: unknown): boolean {
  const value = normalize(status);
  return value === "shipped" || value === "partially shipped" || value === "dispatched";
}

function isCancelled(status: unknown): boolean {
  return normalize(status) === "cancelled" || normalize(status) === "canceled";
}

/**
 * Converts item/line statuses into the status shown for their containing order.
 *
 * Cancelled lines do not participate in shipment progress. A cancelled-only
 * collection remains Cancelled so cancellation keeps its terminal meaning.
 */
export function deriveFulfillmentStatus(
  statuses: unknown[],
  fallback: FulfillmentStatus = "Processing",
): FulfillmentStatus {
  const values = statuses.filter(status => status !== undefined && status !== null);
  const active = values.filter(status => !isCancelled(status));

  if (values.length > 0 && active.length === 0) return "Cancelled";
  if (active.length === 0) return fallback;

  // A return can only be raised after delivery. Keep the master order at
  // Delivered while the item moves through its return workflow instead of
  // regressing it to Processing.
  if (active.every(isDeliveryComplete)) return "Delivered";
  if (active.some(isDeliveryComplete)) return "Partially Delivered";
  if (active.every(isShipped)) return "Shipped";
  if (active.some(isShipped)) return "Partially Shipped";
  return "Processing";
}

export function deriveMasterOrderFulfillmentStatus(
  statuses: unknown[],
  fallback: FulfillmentStatus = "Processing",
): FulfillmentStatus {
  const hasPendingShipping = statuses.some(status => normalize(status) === "pending shipping");
  const hasShipmentProgress = statuses.some(status =>
    isShipped(status) || isDeliveryComplete(status),
  );
  return hasPendingShipping && !hasShipmentProgress
    ? "Pending Shipping"
    : deriveFulfillmentStatus(statuses, fallback);
}

/** Aggregate physical and digital line progress into a status suitable for order lists. */
export function deriveOrderFulfillmentStatus(
  lines: Array<Record<string, any>>,
  fallback: FulfillmentStatus = "Processing",
): FulfillmentStatus {
  const active = lines.filter(line => !isCancelled(line?.status));
  if (lines.length > 0 && active.length === 0) return "Cancelled";
  if (active.length === 0) return fallback;

  const digital = active.filter(isDigitalDocumentProduct);
  const physical = active.filter(line => !isDigitalDocumentProduct(line));
  if (!physical.length) {
    return deriveDigitalFulfillmentStatus(digital.map(line => ({
      status: String(line.status || "Pending"),
      quantity: line.quantity ?? line.qty ?? 1,
    }))) as FulfillmentStatus;
  }
  const physicalStatuses = physical.map(line => line.status);
  const physicalStatus = deriveMasterOrderFulfillmentStatus(physicalStatuses, fallback);
  if (!digital.length) return physicalStatus;

  const digitalStatus = deriveDigitalFulfillmentStatus(digital.map(line => ({
    status: String(line.status || "Pending"),
    quantity: line.quantity ?? line.qty ?? 1,
  }))) as FulfillmentStatus;
  const physicalComplete = physicalStatuses.every(status => isDeliveryComplete(status));
  if (physicalComplete && digitalStatus === "Completed") return "Completed";
  if (physicalComplete) return digitalStatus;
  if (digitalStatus === "Completed") return physicalStatus;

  const combinedStatus = deriveMasterOrderFulfillmentStatus(
    [...physicalStatuses, ...digital.map(line => line.status)],
    fallback,
  );
  // Keep visible digital progress when the physical part is still processing.
  return combinedStatus === "Processing" && digitalStatus !== "Processing"
    ? digitalStatus
    : combinedStatus;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "");
    return parsed && typeof parsed === "object" ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function lineStatus(line: any, po: any): string {
  if (isCancelled(po?.status)) return "Cancelled";
  if (line?.status) return line.status;
  if (po?.status && !["draft", "confirmed", "accepted", "vendor notified"].includes(normalize(po.status))) {
    return po.status;
  }
  return "Processing";
}

/**
 * Recalculates and persists the master order status from the customer-facing
 * sub-order state. Vendor PO-line status is intentionally not included here:
 * vendor fulfillment only unlocks the Shipped action in Order Details.
 */
export function syncMasterOrderFulfillmentStatus(orderId: string): FulfillmentStatus | null {
  if (!orderId || typeof window === "undefined") return null;

  const orders = readJson<any[]>(ORDERS_KEY, []);
  const order = orders.find(candidate => candidate?.id === orderId);
  if (!order) return null;
  if (isCancelled(order.status) || normalize(order.status) === "draft") {
    return order.status as FulfillmentStatus;
  }

  const saved = readJson<Record<string, any>>(`nido_subitems_${orderId}`, {});
  const items = Array.isArray(order.cartItems) ? order.cartItems : [];

  const lines = items.map((item: any, index: number) => {
    const subOrderId = item?.subOrderId || `SO-${orderId}-${String(index + 1).padStart(3, "0")}`;
    const storedStatus = saved[subOrderId]?.itemStatus;
    return {
      ...item,
      status: storedStatus || "Processing",
      quantity: item?.quantity ?? item?.qty ?? 1,
    };
  });

  const nextStatus = deriveOrderFulfillmentStatus(
    lines,
    (order.status as FulfillmentStatus) || "Processing",
  );
  if (order.status !== nextStatus) {
    const updatedOrders = orders.map(candidate =>
      candidate?.id === orderId ? { ...candidate, status: nextStatus } : candidate,
    );
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
    window.dispatchEvent(new CustomEvent("orderFulfillmentStatusUpdated", {
      detail: { orderId, status: nextStatus },
    }));
  }
  return nextStatus;
}

/**
 * Derives the fulfillment status displayed on a vendor PO detail page without
 * replacing the PO's separate Draft/Confirmed procurement lifecycle.
 */
export function derivePOFulfillmentStatus(po: any): FulfillmentStatus {
  if (isCancelled(po?.status)) return "Cancelled";
  if (normalize(po?.status) === "draft") return "Pending";
  const lines = Array.isArray(po?.items) ? po.items : [];
  if (!lines.length) {
    return normalize(po?.status) === "draft" || normalize(po?.status) === "confirmed"
      ? "Processing"
      : (po?.status || "Processing") as FulfillmentStatus;
  }
  const statuses = lines.map(line => {
    const status = lineStatus(line, po);
    const effectiveStatus = isDigitalDocumentProduct(line)
      && ["pending", "confirmed"].includes(normalize(status))
      ? "Processing"
      : status;
    return {
      ...line,
      status: effectiveStatus,
      quantity: line.qty ?? line.quantity ?? 1,
    };
  });
  return deriveOrderFulfillmentStatus(statuses, "Processing");
}