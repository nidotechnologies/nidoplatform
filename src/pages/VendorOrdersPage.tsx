import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POLink, OrderLink } from "@/components/shared/IdLinks";
import { getAllPOs, getPODisplayStatus, getPOByNumber, updatePO, type StoredPO } from "@/lib/purchaseOrderStore";
import { derivePOFulfillmentStatus } from "@/lib/orderFulfillmentStatus";
import { getProcurementSLA } from "@/lib/slaEngine";
import { computeSLAStatus } from "@/lib/slaUtils";
import SLABadge from "@/components/shared/SLABadge";
import { useOrderStatusConfig } from "@/lib/orderStatusStore";
import { belongsToVendor, hasVendorScope, type VendorScope } from "@/lib/vendorScope";
import { buildVendorOrdersCsv } from "@/lib/orderCsvExport";
import type { MyOrder } from "@/contexts/MyOrdersContext";
import OrderExportDialog, { type OrderExportOption } from "@/components/shared/OrderExportDialog";
import { filterOrdersForExport, type OrderExportFilters } from "@/lib/orderExportFilters";

type OrderStatus = string;

interface Order {
  id: string;
  orderId: string;
  vendor: string;
  date: string;
  dateStr: string;
  status: OrderStatus;
  amount: number;
  amountStr: string;
  client: string;
  clientId: string;
  delivery: string;
  items: string;
}

const LEGACY_PO_STATUSES: OrderStatus[] = [
  "Pending", "Processing", "Provisioning", "Partially Provisioned", "Provisioned",
  "Activated", "Completed", "Shipped", "Delivered", "Closed", "Cancelled",
];
const PAGE_SIZE = 10;

const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
  Processing: { bg: "#eff6ff", color: "#185fa5", border: "#b5d4f4" },
  Pending:    { bg: "#fafafa", color: "#777",    border: "#ddd" },
  Confirmed:  { bg: "#eaf3de", color: "#3b6d11", border: "#c0dd97" },
  Shipped:    { bg: "#f3f4f6", color: "#555",    border: "#d1d5db" },
  Delivered:  { bg: "#e1f5ee", color: "#0f6e56", border: "#9fe1cb" },
  Draft:      { bg: "#fafafa", color: "#777",    border: "#ddd" },
  Closed:     { bg: "#fbeaf0", color: "#993556", border: "#f4c0d1" },
  Cancelled:  { bg: "#fff1f0", color: "#a32d2d", border: "#f7c1c1" },
};

function Badge({ status }: { status: OrderStatus }) {
  const s = badgeStyles[status] || { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" };
  return (
    <span style={{ display: "inline-block", padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMsg(m); setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2800);
  };
  return { msg, visible, show };
}

// ── Map a StoredPO → the Order shape used by this list ───────────────────────
function storedPOToOrder(po: StoredPO): Order {
  const createdDate = new Date(po.createdOn);
  const hasValidDate = !Number.isNaN(createdDate.getTime());
  const fmtINR = (n: number) =>
    "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    id:        po.poNumber,
    orderId:   po.orderId,
    vendor:    po.vendorName,
    date:      hasValidDate ? createdDate.toISOString().split("T")[0] : "",
    dateStr:   hasValidDate ? createdDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : po.createdOnDisplay || "—",
    status:    derivePOFulfillmentStatus(po),
    amount:    po.grandTotal,
    amountStr: fmtINR(po.grandTotal),
    client:    "",
    clientId:  "",
    delivery:  po.requestedDelivery || "Within 30 days",
    items:     (po.items?.length ? po.items.map(item => item.item).filter(Boolean) : [po.item]).filter(Boolean).join(", ") || "—",
  };
}

function getSavedMasterOrders(): MyOrder[] {
  try {
    const value = localStorage.getItem("nido_my_orders");
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed as MyOrder[] : [];
  } catch {
    return [];
  }
}

// ─── Bulk Notes Modal ─────────────────────────────────────────────────────────
function BulkNotesModal({ selectedCount, onApply, onClose }: {
  selectedCount: number;
  onApply: (note: string, visibility: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("Internal Note");
  const visibilityOptions = [
    { label: "Internal Note", icon: "🔒", sub: "Only visible to internal users" },
    { label: "External Note", icon: "🌐", sub: "Visible to the client on the portal" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{
        position: "relative", background: "hsl(var(--card))", borderRadius: 14, padding: "28px 32px",
        width: 560, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", fontFamily: "inherit",
        border: "1px solid hsl(var(--border))",
      }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "hsl(var(--foreground))" }}>Bulk Update Notes</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "hsl(var(--muted-foreground))" }}>
          Add a note to <strong style={{ color: "hsl(var(--foreground))" }}>{selectedCount} selected order{selectedCount !== 1 ? "s" : ""}</strong>.
        </p>

        {/* Note composer */}
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 210px" }}>
            {/* Left: textarea */}
            <div style={{ padding: "14px 16px", borderRight: "1px solid hsl(var(--border))" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: "hsl(var(--foreground))" }}>Add Note</div>
              <textarea
                value={note}
                onChange={e => { if (e.target.value.length <= 500) setNote(e.target.value); }}
                placeholder="Write your note here..."
                rows={4}
                style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13.5, fontFamily: "inherit", color: "hsl(var(--foreground))", boxSizing: "border-box", background: "transparent", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>{note.length} / 500</div>
            </div>

            {/* Right: visibility */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "hsl(var(--foreground))", marginBottom: 12 }}>Visibility</div>
              {visibilityOptions.map(({ label, icon, sub }) => (
                <div key={label} onClick={() => setVisibility(label)} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${visibility === label ? "#2563eb" : "hsl(var(--border))"}`, background: visibility === label ? "#2563eb" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 }}>
                    {visibility === label && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))", display: "flex", alignItems: "center", gap: 5 }}>{icon} {label}</div>
                    <div style={{ fontSize: 11.5, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", border: "1px solid hsl(var(--border))", borderRadius: 8,
            background: "hsl(var(--card))", color: "hsl(var(--foreground))", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
          }}>Cancel</button>
          <button
            onClick={() => { if (note.trim()) { onApply(note.trim(), visibility); onClose(); } }}
            disabled={!note.trim()}
            style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 8,
              background: note.trim() ? "#2563eb" : "#93c5fd", color: "#fff",
              cursor: note.trim() ? "pointer" : "not-allowed",
              fontWeight: 600, fontSize: 14, fontFamily: "inherit",
            }}>Save Note</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function VendorOrderList(scope: VendorScope = {}) {
  const navigate = useNavigate();
  const orderStatusConfig = useOrderStatusConfig();

  // The shared PO store is the only source of records for this page.
  const loadOrders = () => {
    const ordersById = new Map(getSavedMasterOrders().map(order => [order.id, order]));
    return getAllPOs()
      .map(po => {
        const masterOrder = ordersById.get(po.orderId);
        return {
          ...storedPOToOrder(po),
          client: masterOrder?.client || "",
          clientId: masterOrder?.clientId || masterOrder?.cartItems?.find(item => item.clientId)?.clientId || "",
        };
      })
      .filter(order => !hasVendorScope(scope) || belongsToVendor(order, scope));
  };

  const [orders, setOrders] = useState<Order[]>(loadOrders);

  // Refresh for same-tab edits, cross-tab edits, and when the page is resumed.
  useEffect(() => {
    const refresh = () => setOrders(loadOrders());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    window.addEventListener("poCreated", refresh);
    window.addEventListener("poActivityUpdated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("poCreated", refresh);
      window.removeEventListener("poActivityUpdated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [scope.vendorId, scope.vendorName]);
  const poStatusOptions = Array.from(new Set([
    ...orderStatusConfig.statuses
      .filter(status => status.category === "Purchase Orders" && status.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(status => getPODisplayStatus(status.name)),
    ...LEGACY_PO_STATUSES,
    ...orders.map(order => getPODisplayStatus(order.status)),
  ]));
  const poTabs: (OrderStatus | "All")[] = ["All", ...poStatusOptions];
  const [activeTab, setActiveTab] = useState<OrderStatus | "All">("All");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [vendorFilter, setVendorFilter] = useState("All Vendors");
  const [dateRange, setDateRange] = useState("All Dates");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<keyof Order | "">("");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [notesModal, setNotesModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [bulkNote, setBulkNote] = useState("");
  const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const toast = useToast();

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => setOpenDropdown(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const displayedOrders = useMemo(
    () => orders.map(o => ({
      ...o,
      status: getPODisplayStatus(o.status),
    })),
    [orders]
  );
  const exportStatusOptions = useMemo<OrderExportOption[]>(() =>
    [...new Set(displayedOrders.map(order => order.status))]
      .sort((a, b) => a.localeCompare(b))
      .map(status => ({ value: status, label: status })),
  [displayedOrders]);
  const exportClientOptions = useMemo<OrderExportOption[]>(() => {
    const clients = new Map<string, string>();
    displayedOrders.forEach(order => {
      const value = order.clientId || order.client;
      if (value && !clients.has(value)) clients.set(value, order.client || value);
    });
    return [...clients.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [displayedOrders]);

  const getFiltered = (): Order[] => {
    let rows = [...displayedOrders];
    if (activeTab !== "All") rows = rows.filter(r => r.status === activeTab);
    if (statusFilter !== "All") rows = rows.filter(r => r.status === statusFilter);
    if (vendorFilter !== "All Vendors") rows = rows.filter(r => r.vendor === vendorFilter);
    if (search) rows = rows.filter(r =>
      r.id.toLowerCase().includes(search) ||
      r.vendor.toLowerCase().includes(search) ||
      r.orderId.toLowerCase().includes(search) ||
      r.items.toLowerCase().includes(search)
    );
    if (dateRange !== "All Dates") {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const start = new Date(today);
      if (dateRange === "This Month") {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(start.getDate() - (dateRange === "Last 7 Days" ? 6 : 29));
        start.setHours(0, 0, 0, 0);
      }
      rows = rows.filter(row => {
        const rowDate = new Date(`${row.date}T00:00:00`);
        return Boolean(row.date) && !Number.isNaN(rowDate.getTime()) && rowDate >= start && rowDate <= today;
      });
    }
    if (sortCol) {
      rows.sort((a, b) => {
        const va = a[sortCol as keyof Order];
        const vb = b[sortCol as keyof Order];
        return (typeof va === "number" ? (va as number) - (vb as number) : String(va).localeCompare(String(vb))) * sortDir;
      });
    } else {
      rows.sort((a, b) => b.date.localeCompare(a.date));
    }
    return rows;
  };

  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const listedOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageRows = listedOrders;
  const vendorOptions = ["All Vendors", ...Array.from(new Set(displayedOrders.map(order => order.vendor))).sort()];

  const tabCount = (t: OrderStatus | "All") =>
    t === "All" ? displayedOrders.length : displayedOrders.filter(r => r.status === t).length;

  const handleSort = (col: keyof Order) => {
    setPage(1);
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  };

  const toggleRow = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const toggleAll = () => {
    const allSel = listedOrders.length > 0 && listedOrders.every(r => selected.has(r.id));
    setSelected(allSel ? new Set() : new Set(listedOrders.map(r => r.id)));
  };

  const applyBulkStatus = () => {
    if (!bulkStatus) { toast.show("Please select a status"); return; }
    if (selected.size === 0) { toast.show("Select at least one order first"); return; }
    if (bulkStatus === "Cancelled") {
      // Cancelling is a terminal action — confirm before applying.
      setStatusModal(false);
      setConfirmBulkCancel(true);
      return;
    }
    performBulkStatusUpdate(bulkStatus as OrderStatus);
  };

  const performBulkStatusUpdate = (status: OrderStatus, cancelReason?: string) => {
    // Cancellation is terminal; delivered and already-cancelled POs cannot
    // be cancelled again.
    const eligible = [...selected].filter(id => {
      const po = getPOByNumber(id);
      return po && po.status !== "Cancelled" && po.status !== "Delivered";
    });
    if (status !== "Cancelled") {
      toast.show("Use each purchase order's details to update its fulfillment status.");
      return;
    }
    // Cancellation is the only safe bulk lifecycle action; other transitions
    // require line-level tracking, inventory, and notification updates.
    for (const id of eligible) {
      updatePO(id, { status: "Cancelled", cancelReason: cancelReason || "Cancelled from Vendor Orders" });
    }
    setOrders(loadOrders());
    const skipped = selected.size - eligible.length;
    toast.show(
      skipped > 0
        ? `${eligible.length} PO(s) cancelled. ${skipped} delivered or already-cancelled PO(s) were skipped.`
        : `${eligible.length} PO(s) cancelled.`
    );
    setStatusModal(false); setBulkStatus(""); setConfirmBulkCancel(false); setBulkCancelReason("");
    setSelected(new Set());
  };

  const applyBulkNotes = (note: string, visibility: string) => {
    if (selected.size === 0) { toast.show("Select at least one order first"); return; }
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const newNote = {
      id: "n" + Date.now(),
      author: "System Owner",
      initials: "SO",
      color: "#2563eb",
      date: dateStr,
      text: note,
      visibility,
    };
    let persisted = 0;
    [...selected].forEach(poNumber => {
      const po = getPOByNumber(poNumber);
      if (po) {
        updatePO(poNumber, { notes: [newNote, ...(po.notes || [])] });
        persisted++;
      }
    });
    toast.show(persisted > 0
      ? `Note added to ${persisted} order(s)`
      : `Note saved (orders will show it when reopened)`
    );
    setNotesModal(false); setBulkNote("");
  };

  const doExport = (exportFilters: OrderExportFilters) => {
    const ordersToExport = filterOrdersForExport(filtered, exportFilters, {
      getDate: order => order.date,
      getStatus: order => order.status,
      getClient: order => order.clientId || order.client,
    });
    const poByNumber = new Map(getAllPOs().map((po) => [po.poNumber, po]));
    const exportablePOs = ordersToExport
      .map((order) => poByNumber.get(order.id))
      .filter((po): po is StoredPO => Boolean(po));
    if (exportablePOs.length === 0) {
      toast.show("No vendor orders match the selected export filters.");
      return false;
    }
    const csv = buildVendorOrdersCsv(exportablePOs, {
      hideInternal: hasVendorScope(scope),
      reportFrom: exportFilters.fromDate,
      reportTo: exportFilters.toDate,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor_orders_full_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.show(`Exported ${exportablePOs.length} vendor order${exportablePOs.length === 1 ? "" : "s"} using the workbook export format.`);
    setOpenDropdown(null);
    return true;
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const bg   = "hsl(var(--background))";
  const card = "hsl(var(--card))";
  const fg   = "hsl(var(--foreground))";
  const muted= "hsl(var(--muted-foreground))";
  const bdr  = "hsl(var(--border))";
  const mutedBg = "hsl(var(--muted))";

  const s = {
    page:      { padding: "28px 36px", background: bg, minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize: 14, color: fg } as React.CSSProperties,
    card:      { background: card, border: `1px solid ${bdr}`, borderRadius: 12, overflow: "hidden" } as React.CSSProperties,
    th:        { fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase" as const, letterSpacing: ".05em", padding: "11px 14px", borderBottom: `1px solid ${bdr}`, textAlign: "left" as const, background: mutedBg, whiteSpace: "nowrap" as const },
    td:        { padding: "13px 14px", borderBottom: `1px solid ${bdr}`, fontSize: 13, verticalAlign: "middle" as const, color: fg },
    link:      { color: "#4a6cf7", textDecoration: "none", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    orderLink: { color: "#4a6cf7", textDecoration: "none", fontWeight: 500, cursor: "pointer", fontFamily: "monospace", fontSize: 13, background: "none", border: "none", padding: 0 } as React.CSSProperties,
    btn:       { display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", border: `1px solid ${bdr}`, borderRadius: 8, fontSize: 13, background: card, color: fg, cursor: "pointer", whiteSpace: "nowrap" as const },
    ddItem:    { display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", fontSize: 13, color: fg, cursor: "pointer", textDecoration: "none", background: "none", border: "none", width: "100%", textAlign: "left" as const },
    pgBtn:     (active: boolean): React.CSSProperties => ({ minWidth: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `1px solid ${bdr}`, fontSize: 13, cursor: "pointer", background: active ? "#4a6cf7" : card, color: active ? "#fff" : fg }),
    cb:        (checked: boolean, indeterminate?: boolean): React.CSSProperties => ({ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked || indeterminate ? "#4a6cf7" : bdr}`, background: checked || indeterminate ? "#4a6cf7" : card, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }),
  };

  const Dropdown = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div style={{ display: openDropdown === id ? "block" : "none", position: "absolute", right: 0, top: "calc(100% + 6px)", background: card, border: `1px solid ${bdr}`, borderRadius: 10, minWidth: 180, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,.15)", overflow: "hidden" }}>
      {children}
    </div>
  );

  const SortIcon = ({ col }: { col: keyof Order }) => (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, marginLeft: 3 }}>
      <span style={{ display: "block", width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: `3px solid ${sortCol === col && sortDir === 1 ? "#4a6cf7" : "#ccc"}` }} />
      <span style={{ display: "block", width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: `3px solid ${sortCol === col && sortDir === -1 ? "#4a6cf7" : "#ccc"}` }} />
    </span>
  );

  const Checkbox = ({ checked, indeterminate, onClick }: { checked: boolean; indeterminate?: boolean; onClick: () => void }) => (
    <div style={s.cb(checked, indeterminate)} onClick={onClick}>
      {(checked || indeterminate) && (
        indeterminate
          ? <span style={{ display: "block", width: 8, height: 2, background: "#fff", borderRadius: 1 }} />
          : <span style={{ display: "block", width: 9, height: 5, borderLeft: "2px solid #fff", borderBottom: "2px solid #fff", transform: "rotate(-45deg) translateY(-1px)" }} />
      )}
    </div>
  );

  const Modal = ({ open, title, onClose, onApply, children }: { open: boolean; title: string; onClose: () => void; onApply: () => void; children: React.ReactNode }) => {
    if (!open) return null;
    const _c = "hsl(var(--card))"; const _b = "hsl(var(--border))"; const _f = "hsl(var(--foreground))";
    return (
      <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: _c, borderRadius: 14, padding: 24, width: 340, boxShadow: "0 16px 48px rgba(0,0,0,.2)", border: `1px solid ${_b}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: _f }}>{title}</h3>
          {children}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${_b}`, background: _c, color: _f }}>Cancel</button>
            <button onClick={onApply} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "1px solid #4a6cf7", background: "#4a6cf7", color: "#fff" }}>Apply</button>
          </div>
        </div>
      </div>
    );
  };

  const allSelected = listedOrders.length > 0 && listedOrders.every(r => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    const listedIds = new Set(listedOrders.map(order => order.id));
    setSelected(current => {
      const next = new Set([...current].filter(id => listedIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [listedOrders.map(order => order.id).join("|")]);

  return (
    <div style={s.page}>
      <OrderExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        statuses={exportStatusOptions}
        clients={exportClientOptions}
        onExport={doExport}
      />
      {/* Toast */}
      {toast.visible && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1a1a2e", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 999 }}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      <Modal open={statusModal} title={`Cancel ${selected.size} selected PO${selected.size === 1 ? "" : "s"}?`} onClose={() => setStatusModal(false)} onApply={applyBulkStatus}>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: fg, margin: "0 0 16px" }}>
          Cancellation is permanent. Fulfillment status changes are managed from each PO's details so item, stock, and tracking data stay in sync.
        </p>
      </Modal>
      {notesModal && (
        <BulkNotesModal
          selectedCount={selected.size}
          onApply={(note, visibility) => applyBulkNotes(note, visibility)}
          onClose={() => { setNotesModal(false); setBulkNote(""); }}
        />
      )}

      {confirmBulkCancel && (
        <div onClick={e => { if (e.target === e.currentTarget) { setConfirmBulkCancel(false); setBulkCancelReason(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: card, borderRadius: 14, padding: 24, width: 420, boxShadow: "0 16px 48px rgba(0,0,0,.2)", border: `1px solid ${bdr}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: "#dc2626" }}>Cancel {selected.size} order{selected.size !== 1 ? "s" : ""}?</h3>
            <p style={{ fontSize: 13, color: fg, marginBottom: 12, lineHeight: 1.5 }}>
              This action cannot be undone. Once cancelled, these orders can no longer be edited, have their status changed, or be processed further.
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: fg, marginBottom: 5 }}>
              Reason for Cancellation <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              value={bulkCancelReason}
              onChange={e => setBulkCancelReason(e.target.value)}
              rows={3}
              placeholder="Enter reason for cancellation..."
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${bulkCancelReason.trim() ? bdr : "#fca5a5"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: 4, background: card, color: fg }}
            />
            {!bulkCancelReason.trim() && <div style={{ fontSize: 11.5, color: "#dc2626", marginBottom: 14 }}>Reason is required before confirming cancellation.</div>}
            {bulkCancelReason.trim() && <div style={{ marginBottom: 14 }} />}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setConfirmBulkCancel(false); setBulkCancelReason(""); }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${bdr}`, background: card, color: fg }}>Keep Orders</button>
              <button onClick={() => { if (!bulkCancelReason.trim()) return; performBulkStatusUpdate("Cancelled", bulkCancelReason.trim()); }} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: bulkCancelReason.trim() ? "pointer" : "not-allowed", border: "1px solid #dc2626", background: bulkCancelReason.trim() ? "#dc2626" : "#fca5a5", color: "#fff", transition: "background 0.15s" }}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 600, color: fg, marginBottom: 4 }}>Vendor Orders</h1>
      <p style={{ fontSize: 13, color: muted, marginBottom: 24 }}>Live purchase orders from the shared procurement store</p>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: "0 0 300px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: muted, fontSize: 15 }}>🔍</span>
          <input value={search} onChange={e => { setPage(1); setSearch(e.target.value.toLowerCase().trimStart()); }}
            placeholder="Search PO, order, vendor, or item..."
            style={{ width: "100%", padding: "8px 10px 8px 34px", border: `1px solid ${bdr}`, borderRadius: 8, fontSize: 13, background: card, color: fg, outline: "none" }} />
        </div>

        {/* Status filter */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button style={s.btn} onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}>
            Status ▾
          </button>
          <Dropdown id="status">
            {(["All", ...poStatusOptions] as (OrderStatus | "All")[]).map(st => (
              <button key={st} style={s.ddItem} onClick={() => { setPage(1); setStatusFilter(st); setOpenDropdown(null); }}>{st === "All" ? "All Statuses" : st}</button>
            ))}
          </Dropdown>
        </div>

        {/* Vendor filter */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button style={s.btn} onClick={() => setOpenDropdown(openDropdown === "vendor" ? null : "vendor")}>
            Vendor ▾
          </button>
          <Dropdown id="vendor">
            {vendorOptions.map(v => (
              <button key={v} style={s.ddItem} onClick={() => { setPage(1); setVendorFilter(v); setOpenDropdown(null); }}>{v}</button>
            ))}
          </Dropdown>
        </div>

        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button style={s.btn} onClick={() => setOpenDropdown(openDropdown === "date" ? null : "date")}>{dateRange} ▾</button>
          <Dropdown id="date">
            {["All Dates", "Last 7 Days", "Last 30 Days", "This Month"].map(option => (
              <button key={option} style={s.ddItem} onClick={() => { setPage(1); setDateRange(option); setOpenDropdown(null); }}>{option}</button>
            ))}
          </Dropdown>
        </div>

        {/* More menu */}
        <div style={{ marginLeft: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
          <button style={{ ...s.btn, padding: "8px 11px" }} onClick={() => setOpenDropdown(openDropdown === "more" ? null : "more")}>⋯</button>
          <Dropdown id="more">
            <button style={s.ddItem} onClick={() => { setShowExportDialog(true); setOpenDropdown(null); }}>📥 Export</button>
            <hr style={{ border: "none", borderTop: `1px solid ${bdr}`, margin: "4px 0" }} />
            <button style={s.ddItem} disabled={selected.size === 0} onClick={() => { setBulkStatus("Cancelled"); setStatusModal(true); setOpenDropdown(null); }}>Cancel Selected POs</button>
            <button style={s.ddItem} disabled={selected.size === 0} onClick={() => { setNotesModal(true); setOpenDropdown(null); }}>📝 Bulk Update Notes</button>
          </Dropdown>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1.5px solid ${bdr}`, gap: 0, overflowX: "auto" }}>
        {poTabs.map(t => (
          <div key={t} onClick={() => { setPage(1); setActiveTab(t); }}
            style={{ padding: "10px 18px", fontSize: 13, color: activeTab === t ? "#4a6cf7" : muted, cursor: "pointer", borderBottom: activeTab === t ? "2.5px solid #4a6cf7" : "2.5px solid transparent", marginBottom: -1.5, whiteSpace: "nowrap", fontWeight: activeTab === t ? 500 : 400 }}>
            {t === "All" ? "All Orders" : t} ({tabCount(t)})
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={s.card}>
        {/* Selection bar */}
        {selected.size > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, color: fg, borderBottom: `1px solid ${bdr}`, background: mutedBg }}>
            <Checkbox checked={allSelected} indeterminate={someSelected} onClick={toggleAll} />
            <span>{selected.size} of {listedOrders.length} listed selected &nbsp;|&nbsp;
              <button onClick={() => setSelected(new Set())} style={{ color: "#4a6cf7", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0 }}>Clear</button>
            </span>
          </div>
        ) : (
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${bdr}`, background: mutedBg, display: "flex", alignItems: "center" }}>
            <Checkbox checked={false} onClick={toggleAll} />
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: 48, paddingLeft: 16 }}></th>
                {([["id","PO Number"],["vendor","Vendor"],["date","PO Date"],["items","Items"],["orderId","Order ID"],["status","Status"],["amount","Total Amount"],["delivery","Requested Delivery"]] as [keyof Order, string][]).map(([col, label]) => (
                  <th key={col} style={s.th}>
                    <span onClick={() => handleSort(col)} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }}>
                      {label} <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th style={s.th}>SLA</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={10} style={{ ...s.td, textAlign: "center", color: muted, padding: 32 }}>No live purchase orders match these filters.</td></tr>
              ) : pageRows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/vendor-orders/${row.id}`)}
                  style={{ background: selected.has(row.id) ? "hsl(var(--primary)/0.08)" : "transparent", cursor: "pointer" }}
                  onMouseEnter={e => { if (!(e.target as HTMLElement).closest('button')) (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(row.id) ? "hsl(var(--primary)/0.08)" : "transparent"; }}
                >
                  <td style={{ ...s.td, paddingLeft: 16 }} onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(row.id)} onClick={() => toggleRow(row.id)} /></td>
                  <td style={s.td}><POLink id={row.id} /></td>
                  <td style={s.td}>{row.vendor}</td>
                  <td style={s.td}>{row.dateStr}</td>
                  <td style={{ ...s.td, maxWidth: 220 }}>{row.items}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <OrderLink id={row.orderId} />
                  </td>
                  <td style={s.td}><Badge status={row.status} /></td>
                  <td style={s.td}>{row.amountStr}</td>
                  <td style={s.td}>{row.delivery}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    {(() => {
                      const stages = getProcurementSLA();
                      const stageMap: Record<string, string> = {
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
                      const stageName = stageMap[row.status] ?? "Purchase Order Creation";
                      const stage = stages.find(s => s.stage === stageName);
                      const targetHrs = stage?.targetTimeHrs ?? 24;
                      const done = row.status === "Delivered" || row.status === "Closed";
                      const sla = computeSLAStatus(row.date, targetHrs, done);
                      return <SLABadge sla={sla} compact />;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", fontSize: 13, color: muted, borderTop: `1px solid ${bdr}` }}>
          <span>{filtered.length === 0
            ? "No live purchase orders match these filters."
            : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} live purchase orders`}</span>
          {filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button style={{ ...s.btn, padding: "6px 11px" }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</button>
              <span>Page {currentPage} of {totalPages} · {PAGE_SIZE} per page</span>
              <button style={{ ...s.btn, padding: "6px 11px" }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}