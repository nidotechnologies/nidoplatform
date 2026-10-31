// Scans orders, POs, and support tickets every 60 s and returns the set of
// items whose SLA is in "warning" or "breached" state and not yet dismissed.

import { useState, useEffect, useCallback } from "react";
import { useMyOrders } from "@/contexts/MyOrdersContext";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getClientSLA, getProcurementSLA, getServiceSLA } from "@/lib/slaEngine";
import { computeSLAStatus, SLAStatus } from "@/lib/slaUtils";
import { getDismissedAlerts } from "@/lib/slaAlertStore";

export interface SLAAlert {
  key: string;       // unique stable key — used for dismiss tracking
  type: "order" | "po" | "ticket";
  id: string;        // display ID (ORD-xxx, PO-xxx, TKT-xxx)
  label: string;     // human-readable "Order ORD-001"
  status: string;    // item's current status
  sla: SLAStatus;
  href: string;      // navigate target
}

const PO_STAGE_MAP: Record<string, string> = {
  "Draft":               "Purchase Order Creation",
  "Pending":             "Purchase Order Approval",
  "Processing":          "Vendor Confirmation",
  "Confirmed":           "Vendor Confirmation",
  "Partially Shipped":   "Goods Dispatch",
  "Shipped":             "Goods Dispatch",
  "Partially Delivered": "Goods Receipt",
  "Delivered":           "Payment Processing",
  "Closed":              "Payment Processing",
};

const TICKET_PRIORITY_MAP: Record<string, string> = {
  high:   "Technical Support",
  medium: "Remote Support",
  low:    "On-site Support",
};

export function useSLAAlerts() {
  const { orders } = useMyOrders();
  const [alerts, setAlerts] = useState<SLAAlert[]>([]);

  const scan = useCallback(() => {
    const dismissed = getDismissedAlerts();
    const result: SLAAlert[] = [];

    // ── 1. Orders ───────────────────────────────────────────────────────────
    const clientTiers = getClientSLA();
    const stdTier = clientTiers.find(t => t.name === "Standard") ?? clientTiers[0];
    const orderTargetHrs = stdTier?.orderProcessingTime ?? 24;

    for (const order of orders) {
      const done = order.status === "Delivered" || order.status === "Cancelled";
      if (done) continue;
      const start = order.orderDate ? `${order.orderDate} ${order.orderTime || ""}` : null;
      const sla = computeSLAStatus(start, orderTargetHrs, false);
      if (sla.state !== "warning" && sla.state !== "breached") continue;
      const key = `order-${order.id}-${sla.state}`;
      if (dismissed.has(key)) continue;
      result.push({ key, type: "order", id: order.id, label: `Order ${order.id}`, status: order.status, sla, href: `/orders/${order.id}` });
    }

    // ── 2. Purchase Orders ──────────────────────────────────────────────────
    const procStages = getProcurementSLA();

    for (const po of getAllPOs()) {
      const done = po.status === "Delivered" || po.status === "Closed";
      if (done) continue;
      const stageName = PO_STAGE_MAP[po.status] ?? "Purchase Order Creation";
      const stage = procStages.find(s => s.stage === stageName);
      const targetHrs = stage?.targetTimeHrs ?? 24;
      const sla = computeSLAStatus(po.createdOn, targetHrs, false);
      if (sla.state !== "warning" && sla.state !== "breached") continue;
      const key = `po-${po.poNumber}-${sla.state}`;
      if (dismissed.has(key)) continue;
      result.push({ key, type: "po", id: po.poNumber, label: `PO ${po.poNumber}`, status: po.status, sla, href: `/purchase-orders` });
    }

    // ── 3. Support Tickets ──────────────────────────────────────────────────
    const svcCategories = getServiceSLA();

    for (const ticket of getSupportTickets()) {
      if (ticket.status === "resolved") continue;
      const catName = TICKET_PRIORITY_MAP[ticket.priority] ?? "Technical Support";
      const cat = svcCategories.find(c => c.category === catName);
      const targetHrs = cat?.resolutionTimeHrs ?? 4;
      const sla = computeSLAStatus(ticket.created, targetHrs, false);
      if (sla.state !== "warning" && sla.state !== "breached") continue;
      const key = `ticket-${ticket.id}-${sla.state}`;
      if (dismissed.has(key)) continue;
      result.push({ key, type: "ticket", id: ticket.number || ticket.id, label: `Ticket ${ticket.number || ticket.id}`, status: ticket.status, sla, href: `/support` });
    }

    setAlerts(result);
  }, [orders]);

  // Run on mount and every 60 s
  useEffect(() => {
    scan();
    const interval = setInterval(scan, 60_000);
    return () => clearInterval(interval);
  }, [scan]);

  // Re-scan when SLA config changes or tickets are updated
  useEffect(() => {
    const handler = () => scan();
    window.addEventListener("slaEngineUpdated", handler);
    window.addEventListener("supportTicketsUpdated", handler);
    return () => {
      window.removeEventListener("slaEngineUpdated", handler);
      window.removeEventListener("supportTicketsUpdated", handler);
    };
  }, [scan]);

  return { alerts, rescan: scan };
}
