import type { MyOrder, MyOrderStatus } from "@/contexts/MyOrdersContext";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeOrder(value: unknown): MyOrder | null {
  if (!isRecord(value)) return null;

  const id = displayText(value.id, "");
  if (!id) return null;

  const client = displayText(value.client, "Unknown client");
  const requester = displayText(value.requester, "Unknown requester");
  const assigned = displayText(value.assigned, "Unassigned");
  const cartItems = Array.isArray(value.cartItems)
    ? value.cartItems
        .filter(isRecord)
        .map((item) => ({ ...item, clientId: displayText(item.clientId, "") }))
    : [];
  const totalAmountNum = typeof value.totalAmountNum === "number" && Number.isFinite(value.totalAmountNum)
    ? value.totalAmountNum
    : undefined;

  return {
    ...value,
    id,
    client,
    clientId: optionalText(value.clientId),
    clientColor: displayText(value.clientColor, "#64748b"),
    clientInitial: displayText(value.clientInitial, client.charAt(0).toUpperCase() || "C"),
    poNumber: displayText(value.poNumber, "—"),
    requester,
    requesterRole: displayText(value.requesterRole, ""),
    requesterInitial: displayText(value.requesterInitial, requester.charAt(0).toUpperCase() || "U"),
    requesterColor: displayText(value.requesterColor, "#64748b"),
    assigned,
    assignedRole: displayText(value.assignedRole, ""),
    assignedInitial: displayText(value.assignedInitial, assigned.charAt(0).toUpperCase() || "U"),
    assignedColor: displayText(value.assignedColor, "#64748b"),
    orderDate: displayText(value.orderDate, ""),
    orderTime: displayText(value.orderTime, ""),
    status: displayText(value.status, "Draft") as MyOrderStatus,
    slaTime: typeof value.slaTime === "string" || value.slaTime === null ? value.slaTime : null,
    slaAlert: value.slaAlert === true,
    totalAmount: displayText(value.totalAmount, "—"),
    totalAmountNum,
    createdAt: optionalText(value.createdAt),
    cartItems: cartItems as unknown as MyOrder["cartItems"],
  };
}

/**
 * Stored orders are browser data and may predate the current order shape.
 * Return safe list rows without mutating or rewriting the stored records.
 */
export function normalizeOrdersForList(value: unknown): { orders: MyOrder[]; invalidCount: number } {
  if (!Array.isArray(value)) {
    return { orders: [], invalidCount: value === undefined ? 0 : 1 };
  }

  const orders: MyOrder[] = [];
  let invalidCount = 0;

  for (const item of value) {
    const order = normalizeOrder(item);
    if (order) orders.push(order);
    else invalidCount += 1;
  }

  return { orders, invalidCount };
}
