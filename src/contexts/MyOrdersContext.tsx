import { createContext, useContext, useState, useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { getPrefix } from "../lib/configService";
import { releaseStock, type StockAllocation } from "../lib/stockEngine";
import { releaseVendorReservation } from "../lib/vendorStore";
import { cancelDraftPOsForOrder, getAllPOs, isPOConfirmed } from "../lib/purchaseOrderStore";
import type { ProductCommercialTerms } from "../lib/productCommercialTerms";
import { createDraftPOsForOrder } from "../lib/orderPurchaseOrderService";
import { autoAssignmentApi, type AutoAssignmentOrderResult } from "../lib/autoAssignmentApi";
import { getRoles, getUsers } from "../lib/nidoUsersStore";
import { getClientForPortal, getClients } from "../lib/clientStore";
import { appendOrderActivityOnce, getActivityActor } from "../lib/orderActivityStore";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MyOrderStatus =
  | "Processing"
  | "Provisioning"
  | "Partially Provisioned"
  | "Provisioned"
  | "Activated"
  | "Completed"
  | "Pending Shipping"
  | "Partially Shipped"
  | "Shipped"
  | "Partially Delivered"
  | "Delivered"
  | "Cancelled"
  | "Draft";

// Minimal cart-item shape stored with the order for the detail view
export interface OrderCartItem {
  id: number;
  name: string;
  image: string;
  priceNum: number;
  quantity: number;
  category: string;
  specs: string[];
  moq: number;
  clientId: string;
  productCode?: string;
  productType?: string;
  physicalType?: string;
  commercialTerms?: ProductCommercialTerms;
  fulfillmentType?: "physical" | "digital" | "hybrid";
  /** Vendor allocation snapshot — used to restore stock if the order is cancelled. */
  vendorAllocations?: StockAllocation[];
  // ── Vendor snapshot — locked at add-to-cart time ──────────────────────────
  selectedVendorId?: string;
  selectedVendorName?: string;
  vendorPrice?: number;
  /** Final client selling price per unit before GST, snapshotted at checkout. */
  clientSellingPriceExclGst?: number;
  landedCost?: number;
  gstSnapshot?: number;
  /** Exact discounted customer price including GST at checkout. */
  checkoutUnitPriceInclusive?: number;
  /** Exact discounted customer price before GST at checkout for invoice imports. */
  checkoutUnitPriceExclGst?: number;
  /** GST rate used for the saved customer checkout price. */
  checkoutGstRate?: number;
  hsnSnapshot?: string;
  vendorRating?: number;
  /** Cloud/service configuration selected before the item was added to cart. */
  configuration?: Record<string, string>;
  configurationPriceAdjustment?: number;
  /** Unique ID for the stock reservation placed at checkout — used for auditing and release on cancellation */
  stockReservationId?: string;
  /** Stable generated sub-order identifier assigned when the master order is created. */
  subOrderId?: string;
}

export interface MyOrder {
  id: string;
  createdBy?: string;
  requesterId?: string;
  requesterEmail?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  updateCount?: number;
  /** Client tenant that owns this order. */
  clientId?: string;
  /** Stable key used to make assignment retries idempotent across browsers with overlapping order numbers. */
  assignmentId?: string;
  /** Server-side tier assignment status; pending items retry after reload/connection recovery. */
  autoAssignmentStatus?: "pending" | "assigned" | "unassigned" | "disabled";
  client: string;
  clientColor: string;
  clientInitial: string;
  poNumber: string;
  requester: string;
  /** Person selected in Shop's "Ordered By" selector. */
  orderedFor?: string;
  /** Client portal orders can defer PO creation until approval is complete. */
  deferPurchaseOrders?: boolean;
  requesterRole: string;
  requesterInitial: string;
  requesterColor: string;
  assigned: string;
  assignedRole: string;
  assignedInitial: string;
  assignedColor: string;
  orderDate: string;
  orderTime: string;
  status: MyOrderStatus;
  slaTime: string | null;
  slaAlert: boolean;
  totalAmount: string;
  // Cart items stored at order-creation time, used by the detail page
  cartItems?: OrderCartItem[];
  // Numeric total for easy calculation
  totalAmountNum?: number;
  /** Original total retained so legacy orders can allocate cancellations consistently. */
  initialTotalAmountNum?: number;
  /** Checkout fees needed to recalculate the remaining total after line cancellation. */
  checkoutPricingSnapshot?: {
    shippingDeliveryFee: number;
    platformFeePct: number;
  };
  // Payment & delivery captured at checkout
  paymentMethod?: string;
  paymentDetail?: string;
  paymentTerms?: string;
  /** Optional customer-facing note entered during checkout. */
  orderNotes?: string;
  deliveryAddress?: string;
  /** Snapshot of the selected checkout delivery address for the order detail view. */
  deliveryDetails?: {
    label?: string;
    attentionName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    phone?: string;
    instructions?: string;
  };
  cancelReason?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface MyOrdersContextType {
  orders: MyOrder[];
  addOrder: (order: Omit<MyOrder, "id"> & { id?: string }) => string;
  setOrders: React.Dispatch<React.SetStateAction<MyOrder[]>>;
  updateOrderStatus: (orderId: string, status: MyOrderStatus, cancelReason?: string) => void;
  updateOrdersStatus: (orderIds: string[], status: MyOrderStatus, cancelReason?: string) => void;
}

const MyOrdersContext = createContext<MyOrdersContextType | undefined>(undefined);

const ORDERS_KEY = "nido_my_orders";
const SEQ_KEY = "nido_order_seq";
const PENDING_ASSIGNMENTS_KEY = "nido_pending_order_assignments_v1";
type PendingAssignment = { assignmentId: string; orderId: string; clientId: string; clientName: string; clientTier: string };
const assignmentRequestsInFlight = new Set<string>();
// Sub-order-level state (per master order) mirrors the keys OrderDetailsPage
// reads/writes, so status cascades stay consistent no matter which screen
// (order list or order detail) triggered the change.
const subItemsKey = (orderId: string) => `nido_subitems_${orderId}`;
const vendorsKey = (orderId: string) => `nido_vendors_${orderId}`;

// A master order moving to Cancelled/Draft always cascades to every sub-order
// (all items get the same status) and clears any in-progress vendor sourcing,
// since vendor selection should not be happening for an order that is no
// longer active. This mirrors the logic OrderDetailsPage uses to derive
// sub-order IDs from cartItems.
function cascadeStatusToSubOrders(order: MyOrder, status: MyOrderStatus) {
  if (status !== "Cancelled" && status !== "Draft") return;
  const itemCount = order.cartItems?.length || 0;
  if (itemCount === 0) return;
  try {
    const key = subItemsKey(order.id);
    let saved: Record<string, any> = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      saved = {};
    }
    const updatedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    for (let i = 0; i < itemCount; i++) {
      const subId = order.cartItems?.[i]?.subOrderId
        || `SO-${order.id}-${String(i + 1).padStart(3, "0")}`;
      saved[subId] = { ...(saved[subId] || {}), itemStatus: status, updatedOn };
    }
    localStorage.setItem(key, JSON.stringify(saved));
    // Vendor sourcing should not be in-flight for a cancelled/draft order.
    localStorage.removeItem(vendorsKey(order.id));
  } catch {
    /* never block the status update on a localStorage failure */
  }
  // Notify any currently-mounted OrderDetailsPage (same tab) to reload its
  // sub-order/vendor state immediately — the "storage" event only fires
  // across tabs, not within the tab that made the change.
  window.dispatchEvent(new CustomEvent("orderSubItemsUpdated", { detail: { orderId: order.id } }));
}

// Serial, zero-padded order numbers: ORD-000001, ORD-000002, ...
function nextOrderId(): string {
  let seq = 0;
  try {
    seq = parseInt(localStorage.getItem(SEQ_KEY) || "0", 10) || 0;
  } catch {
    seq = 0;
  }
  seq += 1;
  try {
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* ignore */
  }
  return `${getPrefix("order") || "ORD-"}${String(seq).padStart(6, "0")}`;
}

function createAssignmentId(): string {
  return globalThis.crypto?.randomUUID?.()
    || `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readPendingAssignments(): PendingAssignment[] {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_ASSIGNMENTS_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    let changed = false;
    const pending = stored.filter((item) => item?.orderId && item?.clientId).map((item) => {
      if (item.assignmentId) return item as PendingAssignment;
      changed = true;
      return { ...item, assignmentId: createAssignmentId() } as PendingAssignment;
    });
    if (changed) savePendingAssignments(pending);
    return pending;
  } catch {
    return [];
  }
}

function savePendingAssignments(items: PendingAssignment[]) {
  try {
    localStorage.setItem(PENDING_ASSIGNMENTS_KEY, JSON.stringify(items));
  } catch {
    // The order itself remains saved even if the retry queue cannot be written.
  }
}

function getAssignmentRoster() {
  const activeRoles = new Map(getRoles().map((role) => [role.name, role.status === "Active"]));
  return getUsers().map((user) => ({
    id: user.id,
    name: user.name || user.email || user.employeeId || "Unnamed employee",
    role: user.role || "",
    department: user.department || "",
    active: user.status === "Active",
    roleActive: !user.role || activeRoles.get(user.role) === true,
  }));
}

function queuePendingAssignment(item: PendingAssignment) {
  const pending = readPendingAssignments();
  if (!pending.some((entry) => entry.assignmentId === item.assignmentId)) {
    pending.push(item);
    savePendingAssignments(pending);
  }
}

async function sendPendingAssignment(
  item: PendingAssignment,
  updateOrders: Dispatch<SetStateAction<MyOrder[]>>,
) {
  if (assignmentRequestsInFlight.has(item.assignmentId)) return;
  assignmentRequestsInFlight.add(item.assignmentId);
  try {
    const result = await autoAssignmentApi.assignOrder({
      assignmentId: item.assignmentId,
      orderId: item.orderId,
      clientId: item.clientId,
      clientName: item.clientName,
      clientTier: item.clientTier,
      employees: getAssignmentRoster(),
    });
    const currentUser = result.assigned_employee_id
      ? getUsers().find((entry) => entry.id === result.assigned_employee_id)
      : undefined;
    const status = result.status === "assigned" ? "assigned" : result.status === "disabled" ? "disabled" : "unassigned";
    updateOrders((current) => current.map((order) => order.id === item.orderId ? {
      ...order,
      assigned: result.assigned_employee_name || "Unassigned",
      assignedRole: currentUser?.role || "",
      assignedInitial: (result.assigned_employee_name || "U").charAt(0).toUpperCase(),
      autoAssignmentStatus: status,
    } : order));
    savePendingAssignments(readPendingAssignments().filter((entry) => entry.assignmentId !== item.assignmentId));
    appendOrderActivityOnce(
      item.orderId,
      `activity_assignment_${item.orderId}_${status}`,
      status === "assigned"
        ? `Order ${item.orderId} was assigned to ${result.assigned_employee_name}.`
        : status === "disabled"
          ? `Order ${item.orderId} was left unassigned because automatic assignment is disabled.`
          : `Order ${item.orderId} was added to the unassigned assignment queue.`,
      { actor: "Auto Assignment", eventType: "activity" },
    );
    window.dispatchEvent(new CustomEvent("nidoOrderAssignmentUpdated", { detail: { orderId: item.orderId } }));
  } catch {
    // Keep this item in the local retry queue; an unavailable API must not drop the order.
  } finally {
    assignmentRequestsInFlight.delete(item.assignmentId);
  }
}

export function MyOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<MyOrder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // Persist every change to localStorage so orders survive page refresh
  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event("nidoMyOrdersUpdated"));
  }, [orders]);

  // Cross-tab / cross-session sync: if another tab (e.g. the owner platform or
  // the client portal open side-by-side) writes to the shared orders key,
  // pick up the change immediately instead of waiting for a manual refresh.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ORDERS_KEY) return;
      try {
        setOrders(JSON.parse(e.newValue || "[]"));
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // A PO or sub-order can be operated from another page in the same tab.
  // Fulfillment status sync writes the shared order record directly and emits
  // this event so the context (and every order page) reflects it immediately.
  useEffect(() => {
    const onFulfillmentStatusUpdated = (event: Event) => {
      const detailOrderId = (event as CustomEvent).detail?.orderId;
      if (!detailOrderId) return;
      try {
        const latest: MyOrder[] = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
        setOrders(latest);
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener("orderFulfillmentStatusUpdated", onFulfillmentStatusUpdated);
    return () => window.removeEventListener("orderFulfillmentStatusUpdated", onFulfillmentStatusUpdated);
  }, []);

  useEffect(() => {
    const retryPending = () => {
      readPendingAssignments().forEach((item) => void sendPendingAssignment(item, setOrders));
    };
    retryPending();
    const interval = window.setInterval(retryPending, 30_000);
    window.addEventListener("online", retryPending);
    window.addEventListener("focus", retryPending);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", retryPending);
      window.removeEventListener("focus", retryPending);
    };
  }, []);

  const addOrder = (order: Omit<MyOrder, "id"> & { id?: string }) => {
    const id = nextOrderId();
    const assignmentId = order.assignmentId || createAssignmentId();
    const createdAt = order.createdAt || new Date().toISOString();
    const createdBy = order.createdBy || getActivityActor(order.requester || "System");
    const cartItems = order.cartItems?.map((item, index) => ({
      ...item,
      subOrderId: item.subOrderId
        || `${getPrefix("salesOrder") || "SO-"}${id}-${String(index + 1).padStart(3, "0")}`,
    }));
    const normalizedOrder = {
      ...order,
      createdBy,
      createdAt,
      updatedBy: order.updatedBy || createdBy,
      updatedAt: order.updatedAt || createdAt,
      updateCount: order.updateCount || 0,
      assignmentId,
      assigned: "Unassigned",
      assignedRole: "",
      assignedInitial: "U",
      autoAssignmentStatus: order.clientId ? "pending" : "unassigned",
      id,
      cartItems,
    } as MyOrder;
    setOrders((prev) => [normalizedOrder, ...prev]);
    if (order.clientId) {
      const client = getClientForPortal(order.clientId)
        || getClients().find((entry) => entry.id === order.clientId);
      const tier = String(client?.client_tier || client?.tier || "");
      const assignment: PendingAssignment = {
        assignmentId,
        orderId: id,
        clientId: order.clientId,
        clientName: client?.name || order.client,
        clientTier: tier,
      };
      queuePendingAssignment(assignment);
      void sendPendingAssignment(assignment, setOrders);
    }
    appendOrderActivityOnce(
      id,
      `activity_order_placed_${id}`,
      `Order ${id} was placed.`,
      { actor: createdBy, eventType: "activity" },
    );
    // Draft POs are created immediately for orders without an approval gate.
    // Client orders that require approval pass deferPurchaseOrders=true and
    // are released by the approval service after final approval.
    if (cartItems?.length && !order.deferPurchaseOrders) {
      createDraftPOsForOrder(id, cartItems, order.paymentTerms || "");
    }
    return id;
  };

  // Single source of truth for changing a master order's status. Used by both
  // the order list (bulk update) and the order detail page ("Update Master
  // Status") so a Cancelled/Draft transition always cascades to sub-orders
  // and clears vendor selection consistently, regardless of entry point.
  // Cancelled is a terminal state: once an order is Cancelled it can no
  // longer be edited, have its status changed, or be processed further —
  // guarding here (the single source of truth) protects every entry point
  // (order detail page, list bulk update) without relying on each caller
  // to re-check.
  const updateOrderStatus = (orderId: string, status: MyOrderStatus, cancelReason?: string) => {
    const activityId = `activity_order_status_${orderId}_${status}_${Date.now()}`;
    const updatedBy = getActivityActor();
    const updatedAt = new Date().toISOString();
    setOrders((prev) => {
      const target = prev.find((o) => o.id === orderId);
      if (!target || target.status === "Cancelled") return prev;
      if (target.status === status) return prev;
      if (target.status === "Delivered") return prev;
      if (
        status === "Delivered" &&
        target.status !== "Shipped" &&
        target.status !== "Partially Delivered"
      ) return prev;
      // Once any PO has been generated for an order (including a draft PO),
      // the master order must not be cancelled.
      if (status === "Cancelled" && getAllPOs().some((po) => po.orderId === orderId && isPOConfirmed(po))) return prev;
      // Release reserved stock when an order is cancelled before a PO is raised.
      // If a PO was already raised for some qty, that qty's reservedStock was
      // already cleared at PO-creation time, so the Math.max(0, ...) floor in
      // releaseVendorReservation makes this safe to call unconditionally.
      if (status === "Cancelled") {
        cancelDraftPOsForOrder(orderId, cancelReason);
        for (const item of (target.cartItems || [])) {
          if (!item.productCode) continue;
          for (const alloc of (item.vendorAllocations || [])) {
            if (alloc.vendorId && alloc.allocated > 0) {
              releaseVendorReservation(alloc.vendorId, item.productCode, alloc.allocated);
            }
          }
        }
      }
      cascadeStatusToSubOrders(target, status);
      const extra = status === "Cancelled" && cancelReason ? { cancelReason } : {};
      if (target.status !== status) {
        appendOrderActivityOnce(
          orderId,
          activityId,
          `Order status changed from ${target.status} to ${status}.${cancelReason ? ` Reason: ${cancelReason}` : ""}`,
          { actor: updatedBy, eventType: "status-change" },
        );
      }
      return prev.map((o) => (o.id === orderId ? {
        ...o,
        status,
        ...extra,
        updatedBy,
        updatedAt,
        updateCount: (Number(o.updateCount) || 0) + 1,
      } : o));
    });
  };

  const updateOrdersStatus = (orderIds: string[], status: MyOrderStatus, cancelReason?: string) => {
    const idSet = new Set(orderIds);
    const activityTimestamp = Date.now();
    const updatedBy = getActivityActor();
    const updatedAt = new Date().toISOString();
    setOrders((prev) => {
      prev.forEach((o) => {
        if (
          idSet.has(o.id) &&
          o.status !== "Cancelled" &&
          !(status === "Cancelled" && getAllPOs().some((po) => po.orderId === o.id && isPOConfirmed(po)))
        ) {
          if (status === "Cancelled") cancelDraftPOsForOrder(o.id, cancelReason);
          cascadeStatusToSubOrders(o, status);
          if (o.status !== status) {
            appendOrderActivityOnce(
              o.id,
              `activity_order_status_${o.id}_${status}_${activityTimestamp}`,
              `Order status changed from ${o.status} to ${status}.${cancelReason ? ` Reason: ${cancelReason}` : ""}`,
              { actor: updatedBy, eventType: "status-change" },
            );
          }
        }
      });
      const extra = status === "Cancelled" && cancelReason ? { cancelReason } : {};
      return prev.map((o) => (
        idSet.has(o.id) &&
        o.status !== status &&
        o.status !== "Cancelled" &&
        !(status === "Cancelled" && getAllPOs().some((po) => po.orderId === o.id && isPOConfirmed(po)))
          ? {
              ...o,
              status,
              ...extra,
              updatedBy,
              updatedAt,
              updateCount: (Number(o.updateCount) || 0) + 1,
            }
          : o
      ));
    });
  };

  return (
    <MyOrdersContext.Provider value={{ orders, addOrder, setOrders, updateOrderStatus, updateOrdersStatus }}>
      {children}
    </MyOrdersContext.Provider>
  );
}

export function useMyOrders() {
  const ctx = useContext(MyOrdersContext);
  if (!ctx) throw new Error("useMyOrders must be used within a MyOrdersProvider");
  return ctx;
}