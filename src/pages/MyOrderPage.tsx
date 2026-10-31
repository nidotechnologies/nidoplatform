import { useState, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMyOrders, type MyOrder as Order, type MyOrderStatus as OrderStatus } from "@/contexts/MyOrdersContext";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSLA } from "@/lib/slaEngine";
import { computeSLAStatus } from "@/lib/slaUtils";
import SLABadge from "@/components/shared/SLABadge";
import { getAllPOs, isPOConfirmed } from "@/lib/purchaseOrderStore";
import { buildOrdersCsv } from "@/lib/orderCsvExport";
import { loadApprovalBootstrap, type ApprovalRequest } from "@/lib/approvalEngine";
import OrderExportDialog, { type OrderExportOption } from "@/components/shared/OrderExportDialog";
import { filterOrdersForExport, type OrderExportFilters } from "@/lib/orderExportFilters";
import { formatCurrency } from "@/lib/formatters";
import { normalizeOrdersForList } from "@/lib/orderListData";

const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; border: string }> = {
  Processing:            { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  Provisioning:          { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" },
  "Partially Provisioned": { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  Provisioned:           { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  Activated:             { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  Completed:             { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  "Pending Shipping":    { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
  "Partially Shipped":   { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  Shipped:               { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  "Partially Delivered": { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Delivered:             { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Cancelled:             { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  Draft:                 { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
};

const ALL_STATUSES: OrderStatus[] = [
  "Processing", "Provisioning", "Partially Provisioned", "Provisioned", "Activated", "Completed",
  "Pending Shipping", "Partially Shipped", "Shipped", "Partially Delivered", "Delivered", "Cancelled", "Draft",
];

// ALL_TABS is now derived inside the component from live orders

// ─── Small helpers ─────────────────────────────────────────────────────────────
function Avatar({ initial, color, size = 28 }: { initial: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  // Persisted legacy/custom orders can contain a status added outside the
  // current type map, so never let a missing style crash the orders page.
  const s = STATUS_STYLE[status] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 14, fontSize: 12, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", display: "inline-block",
    }}>
      {status}
    </span>
  );
}

// ─── Filter panel ──────────────────────────────────────────────────────────────
interface FilterState {
  orderId: string; masterOrderId: string; clientOrderRef: string;
  requestTitle: string; client: string; orderStatus: string; assignedTo: string;
  slaStatus: string; slaFrom: string; slaTo: string; orderDate: string;
  delivery: string; minAmount: string; maxAmount: string; requester: string;
  vendorStatus: string; priority: string; paymentStatus: string;
  attachments: string; tags: string;
}

const EMPTY_FILTERS: FilterState = {
  orderId: "", masterOrderId: "", clientOrderRef: "",
  requestTitle: "", client: "", orderStatus: "", assignedTo: "",
  slaStatus: "", slaFrom: "", slaTo: "", orderDate: "",
  delivery: "", minAmount: "", maxAmount: "", requester: "",
  vendorStatus: "", priority: "", paymentStatus: "", attachments: "", tags: "",
};

const labelSt: React.CSSProperties = { display: "block", fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 4, fontWeight: 500 };
const inputSt: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid hsl(var(--border))",
  borderRadius: 6, fontSize: 13, color: "hsl(var(--foreground))", background: "hsl(var(--background))",
  boxSizing: "border-box" as const, outline: "none", fontFamily: "inherit",
};

function Inp({ label, fkey, placeholder, filters, setFilters }: {
  label: string; fkey: keyof FilterState; placeholder: string;
  filters: FilterState; setFilters: (f: FilterState) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelSt}>{label}</label>
      <input style={inputSt} placeholder={placeholder} value={filters[fkey]}
        onChange={e => setFilters({ ...filters, [fkey]: e.target.value })} />
    </div>
  );
}

function Sel({ label, fkey, placeholder, options, filters, setFilters }: {
  label: string; fkey: keyof FilterState; placeholder: string; options: string[];
  filters: FilterState; setFilters: (f: FilterState) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelSt}>{label}</label>
      <select style={{ ...inputSt, appearance: "none" as const, cursor: "pointer" }} value={filters[fkey]}
        onChange={e => setFilters({ ...filters, [fkey]: e.target.value })}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FilterPanel({ filters, setFilters, onClose, onApply, onClear }: {
  filters: FilterState; setFilters: (f: FilterState) => void;
  onClose: () => void; onApply: () => void; onClear: () => void;
}) {
  const p = { filters, setFilters };
  const _bg = "hsl(var(--card))"; const _bdr = "hsl(var(--border))"; const _fg = "hsl(var(--foreground))"; const _m = "hsl(var(--muted-foreground))";
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, height: "100vh", width: 320,
      background: _bg, boxShadow: "-2px 0 24px rgba(0,0,0,0.18)", border: `1px solid ${_bdr}`,
      zIndex: 300, display: "flex", flexDirection: "column", fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: `1px solid ${_bdr}` }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: _fg }}>Filters</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onClear} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Clear All</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: _m, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: _fg }}>Order Information</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Inp label="Order ID" fkey="orderId" placeholder="Enter order ID" {...p} />
          <Inp label="Master Order ID" fkey="masterOrderId" placeholder="Enter master order ID" {...p} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Inp label="Client Order Reference" fkey="clientOrderRef" placeholder="Enter reference" {...p} />
        </div>
        <Inp label="Request Title / Description" fkey="requestTitle" placeholder="Enter request title or description" {...p} />
        <Sel label="Client" fkey="client" placeholder="Select Client"
          options={["TechHub Solutions", "OfficeMart Supplies", "PaperWorld Distributors", "Global Industrial"]} {...p} />
        <Sel label="Order Status" fkey="orderStatus" placeholder="Select status"
          options={ALL_STATUSES} {...p} />
        <Sel label="Assigned To" fkey="assignedTo" placeholder="Select users"
          options={["Sneha Iyer", "Priya Nair", "Arjun Mehta", "Rahul Verma", "Sanjay Patel", "Anita Desai"]} {...p} />
        <Sel label="SLA Status" fkey="slaStatus" placeholder="Select SLA status"
          options={["On Track", "At Risk", "Breached"]} {...p} />
        <div>
          <label style={labelSt}>Remaining SLA Time</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>From</div>
              <input style={inputSt} type="time" value={filters.slaFrom}
                onChange={e => setFilters({ ...filters, slaFrom: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>To</div>
              <input style={inputSt} type="time" value={filters.slaTo}
                onChange={e => setFilters({ ...filters, slaTo: e.target.value })} />
            </div>
          </div>
        </div>
        <Sel label="Order Date" fkey="orderDate" placeholder="Select date range"
          options={["Today", "Last 7 days", "Last 30 days", "Custom range"]} {...p} />
        <Sel label="Delivery" fkey="delivery" placeholder="Select delivery filter"
          options={["Standard", "Express", "Overnight"]} {...p} />
        <div>
          <label style={labelSt}>Amount</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Min Amount</div>
              <input style={inputSt} placeholder="Enter min amount" value={filters.minAmount}
                onChange={e => setFilters({ ...filters, minAmount: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Max Amount</div>
              <input style={inputSt} placeholder="Enter max amount" value={filters.maxAmount}
                onChange={e => setFilters({ ...filters, maxAmount: e.target.value })} />
            </div>
          </div>
        </div>
        <Sel label="Requester" fkey="requester" placeholder="Select requester"
          options={["Pavan", "Rohit Sharma", "Anita Desai", "Sanjay Patel", "Priya Nair", "Rahul Verma", "Arjun Mehta", "Sneha Iyer"]} {...p} />
        <Sel label="Vendor Status" fkey="vendorStatus" placeholder="Select vendor status"
          options={["Active", "Inactive", "Pending"]} {...p} />
        <div style={{ display: "flex", gap: 10 }}>
          <Sel label="Priority" fkey="priority" placeholder="Select priority"
            options={["High", "Medium", "Low"]} {...p} />
          <Sel label="Payment Status" fkey="paymentStatus" placeholder="Select payment status"
            options={["Paid", "Pending", "Overdue"]} {...p} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Sel label="Attachments" fkey="attachments" placeholder="Select option"
            options={["Has Attachments", "No Attachments"]} {...p} />
          <Sel label="Tags / Labels" fkey="tags" placeholder="Select tags"
            options={["Urgent", "Review", "Approved", "Flagged"]} {...p} />
        </div>
      </div>

      <div style={{ padding: "14px 20px", borderTop: `1px solid ${_bdr}`, display: "flex", gap: 10 }}>
        <button onClick={onClear} style={{
          flex: 1, padding: "9px 0", border: `1px solid ${_bdr}`, borderRadius: 7,
          background: _bg, color: _fg, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Clear All</button>
        <button onClick={onApply} style={{
          flex: 1, padding: "9px 0", border: "none", borderRadius: 7,
          background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Apply Filters</button>
      </div>
    </div>
  );
}

// ─── 3-dot action dropdown ─────────────────────────────────────────────────────
function ActionDropdown({ onExport, onCreateOrder, onBulkStatus, onBulkNotes, onClose }: {
  onExport: () => void;
  onCreateOrder: () => void;
  onBulkStatus: () => void;
  onBulkNotes: () => void;
  onClose: () => void;
}) {
  const items = [
    { icon: "⬆️", label: "Export",              action: () => { onExport();      onClose(); } },
    { icon: "＋", label: "Create Order",         action: () => { onCreateOrder(); onClose(); } },
    { icon: "⟳",  label: "Bulk Update Status",  action: () => { onBulkStatus();  onClose(); } },
    { icon: "✎",  label: "Bulk Update Notes",   action: () => { onBulkNotes();   onClose(); } },
  ];
  const _c = "hsl(var(--card))"; const _b = "hsl(var(--border))"; const _f = "hsl(var(--foreground))"; const _mu = "hsl(var(--muted))";
  return (
    <div style={{
      position: "absolute", top: 40, right: 0, background: _c,
      boxShadow: "0 4px 20px rgba(0,0,0,0.18)", borderRadius: 10, zIndex: 200,
      minWidth: 210, border: `1px solid ${_b}`, overflow: "hidden",
    }}>
      {items.map(item => (
        <button key={item.label} onClick={item.action} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          padding: "11px 18px", border: "none", background: "none",
          cursor: "pointer", fontSize: 14, color: _f, textAlign: "left", fontFamily: "inherit",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = _mu)}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bulk Status Modal ─────────────────────────────────────────────────────────
function BulkStatusModal({ selectedCount, onApply, onClose }: {
  selectedCount: number;
  onApply: (status: OrderStatus) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus>("Processing");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={onClose} />
      <div style={{
        position: "relative", background: "hsl(var(--card))", borderRadius: 14, padding: "28px 32px",
        width: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", fontFamily: "inherit",
        border: "1px solid hsl(var(--border))",
      }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "hsl(var(--foreground))" }}>Bulk Update Status</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "hsl(var(--muted-foreground))" }}>
          Apply new status to <strong style={{ color: "hsl(var(--foreground))" }}>{selectedCount} selected order{selectedCount !== 1 ? "s" : ""}</strong>.
        </p>
        <label style={labelSt}>New Status</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as OrderStatus)}
          style={{ ...inputSt, marginBottom: 24, appearance: "none" as const, cursor: "pointer" }}
        >
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", border: "1px solid hsl(var(--border))", borderRadius: 8,
            background: "hsl(var(--card))", color: "hsl(var(--foreground))", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={() => { onApply(status); onClose(); }} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 8,
            background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
          }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Notes Modal ──────────────────────────────────────────────────────────
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

        {/* Note composer — same layout as OrderDetailsPage */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 210px" }}>
            {/* Left: textarea */}
            <div style={{ padding: "14px 16px", borderRight: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: "hsl(var(--foreground))" }}>Add Note</div>
              <textarea
                value={note}
                onChange={e => { if (e.target.value.length <= 500) setNote(e.target.value); }}
                placeholder="Write your note here..."
                rows={4}
                style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13.5, fontFamily: "inherit", color: "#374151", boxSizing: "border-box", background: "transparent", lineHeight: 1.5 }}
              />
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{note.length} / 500</div>
            </div>

            {/* Right: visibility */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Visibility</div>
                {visibilityOptions.map(({ label, icon, sub }) => (
                  <div key={label} onClick={() => setVisibility(label)} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${visibility === label ? "#2563eb" : "#d1d5db"}`, background: visibility === label ? "#2563eb" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 }}>
                      {visibility === label && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", display: "flex", alignItems: "center", gap: 5 }}>{icon} {label}</div>
                      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
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

// ─── Toast banner ──────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: "#111827", color: "#fff", borderRadius: 10, padding: "12px 22px",
      fontSize: 14, fontWeight: 500, zIndex: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
      display: "flex", alignItems: "center", gap: 14, fontFamily: "inherit",
      animation: "fadeIn 0.2s",
    }}>
      <span>✓ {message}</span>
      <button onClick={onDone} style={{
        background: "none", border: "none", color: "#9ca3af", cursor: "pointer",
        fontSize: 18, padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

// ─── Table styles ──────────────────────────────────────────────────────────────
const thSt: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 600,
  color: "#6b7280", letterSpacing: 0.4, whiteSpace: "nowrap", userSelect: "none" as const,
};
const tdSt: React.CSSProperties = { padding: "14px 16px", verticalAlign: "middle" };

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function MyOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, updateOrdersStatus } = useMyOrders();
  const { user, isImpersonating, isClientPortalUser } = useAuth();
  const isViewOnly = isImpersonating;
  const orderListData = useMemo(() => normalizeOrdersForList(orders), [orders]);
  const visibleOrders = useMemo(() => {
    if (!isClientPortalUser || !user?.clientId) return orderListData.orders;
    return orderListData.orders.filter(o =>
      o.clientId === user.clientId ||
      o.cartItems?.some(item => item.clientId === user.clientId) ||
      o.client === user.clientName
    );
  }, [orderListData, isClientPortalUser, user?.clientId, user?.clientName]);
  const exportStatusOptions = useMemo<OrderExportOption[]>(() =>
    [...new Set(visibleOrders.map(order => order.status))]
      .sort((a, b) => a.localeCompare(b))
      .map(status => ({ value: status, label: status })),
  [visibleOrders]);
  const exportClientOptions = useMemo<OrderExportOption[]>(() => {
    const clients = new Map<string, string>();
    visibleOrders.forEach(order => {
      const value = order.clientId || order.cartItems?.find(item => item.clientId)?.clientId || order.client;
      if (value && !clients.has(value)) clients.set(value, order.client || value);
    });
    return [...clients.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleOrders]);
  const [activeTab, setActiveTab] = useState("All Orders");
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set<string>());
  const [currentPage, setCurrentPage] = useState(1);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkNotes, setShowBulkNotes] = useState(false);
  const [pendingBulkCancel, setPendingBulkCancel] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== "").length;

  // Derive tab counts from live orders
  const ALL_TABS = useMemo(() => {
    const statuses: OrderStatus[] = [
      "Draft", "Processing", "Provisioning", "Partially Provisioned", "Provisioned", "Activated", "Completed",
      "Pending Shipping", "Partially Shipped", "Shipped", "Partially Delivered", "Delivered", "Cancelled",
    ];
    return [
       { key: "All Orders", label: "All Orders", count: visibleOrders.length },
       ...statuses.map(s => ({ key: s, label: s, count: visibleOrders.filter(o => o.status === s).length })),
    ];
  }, [visibleOrders]);

  const filteredOrders = useMemo(() => {
    return visibleOrders.filter(o => {
      if (activeTab !== "All Orders" && o.status !== activeTab) return false;
      const q = search.toLowerCase();
      if (q && !o.id.toLowerCase().includes(q) && !o.client.toLowerCase().includes(q) &&
        !o.requester.toLowerCase().includes(q)) return false;
      if (appliedFilters.client && o.client !== appliedFilters.client) return false;
      if (appliedFilters.orderStatus && o.status !== appliedFilters.orderStatus) return false;
      if (appliedFilters.requester && !o.requester.toLowerCase().includes(appliedFilters.requester.toLowerCase())) return false;
      if (appliedFilters.assignedTo && !o.assigned.toLowerCase().includes(appliedFilters.assignedTo.toLowerCase())) return false;
      if (appliedFilters.minAmount) {
        const min = parseFloat(appliedFilters.minAmount.replace(/[^0-9.]/g, ""));
        const amt = parseFloat(o.totalAmount.replace(/[^0-9.]/g, ""));
        if (!isNaN(min) && amt < min) return false;
      }
      if (appliedFilters.maxAmount) {
        const max = parseFloat(appliedFilters.maxAmount.replace(/[^0-9.]/g, ""));
        const amt = parseFloat(o.totalAmount.replace(/[^0-9.]/g, ""));
        if (!isNaN(max) && amt > max) return false;
      }
      return true;
    });
  }, [visibleOrders, activeTab, search, appliedFilters]);

  const allChecked = filteredOrders.length > 0 && filteredOrders.every(o => selected.has(o.id));
  const someChecked = filteredOrders.some(o => selected.has(o.id)) && !allChecked;

  const toggleAll = () => {
    if (allChecked) setSelected(s => { const n = new Set(s); filteredOrders.forEach(o => n.delete(o.id)); return n; });
    else setSelected(s => { const n = new Set(s); filteredOrders.forEach(o => n.add(o.id)); return n; });
  };
  const toggleOne = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleApply = () => { setAppliedFilters(filters); setShowFilter(false); };
  const handleClear = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };

  const selectedCount = filteredOrders.filter(o => selected.has(o.id)).length;
  const totalSelected = [...selected].length;

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExport = async (exportFilters: OrderExportFilters) => {
    const ordersToExport = filterOrdersForExport(filteredOrders, exportFilters, {
      getDate: order => order.orderDate || order.createdAt,
      getStatus: order => order.status,
      getClient: order => order.clientId || order.cartItems?.find(item => item.clientId)?.clientId || order.client,
    });
    if (ordersToExport.length === 0) {
      showToast("No orders match the selected export filters.");
      return false;
    }

    let approvalRequests: ApprovalRequest[] = [];
    try {
      const approvalData = await loadApprovalBootstrap();
      const orderIds = new Set(ordersToExport.map((order) => order.id));
      approvalRequests = approvalData.requests.filter((request) =>
        request.module === "Order" && orderIds.has(request.reference),
      );
    } catch {
      // The order export remains available when the optional approval service is unavailable.
    }

    const csv = buildOrdersCsv(ordersToExport, {
      approvalRequests,
      hideInternal: isClientPortalUser,
      reportFrom: exportFilters.fromDate,
      reportTo: exportFilters.toDate,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_full_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(`Exported ${ordersToExport.length} order${ordersToExport.length === 1 ? "" : "s"} using the workbook export format.`);
    return true;
  };

  // ── Bulk update status ──────────────────────────────────────────────────────
  const handleBulkStatusApply = (status: OrderStatus) => {
    if (isViewOnly) {
      showToast("This action is disabled while using client-user impersonation.");
      return;
    }
    if (orderListData.invalidCount > 0) {
      showToast("Some saved order records are invalid. Status updates are paused to avoid changing the wrong order.");
      return;
    }
    if (status === "Cancelled") {
      // Cancelling is a terminal, hard-to-undo action — confirm first.
      setPendingBulkCancel(true);
      return;
    }
    applyBulkStatus(status);
  };

  const applyBulkStatus = (status: OrderStatus, cancelReason?: string) => {
    if (isViewOnly) {
      showToast("This action is disabled while using client-user impersonation.");
      setPendingBulkCancel(false);
      setShowBulkStatus(false);
      return;
    }
    if (orderListData.invalidCount > 0) {
      showToast("Some saved order records are invalid. Status updates are paused to avoid changing the wrong order.");
      setPendingBulkCancel(false);
      setShowBulkStatus(false);
      return;
    }
    // Cascades to sub-orders (and clears vendor selection) when moving to
    // Cancelled/Draft, and stays in sync with the order detail page since
    // both read/write the same shared order + sub-order state. Orders that
    // are already Cancelled or have a confirmed/issued PO are skipped by the
    // context itself, so they cannot be cancelled or processed further.
    const ids = [...selected];
     const alreadyCancelledIds = ids.filter(id => orderListData.orders.find(o => o.id === id)?.status === "Cancelled");
    const poLockedIds = status === "Cancelled"
      ? ids.filter(id => getAllPOs().some(po => po.orderId === id && isPOConfirmed(po)))
      : [];
    const skippedIds = new Set([...alreadyCancelledIds, ...poLockedIds]);
    const eligibleIds = ids.filter(id => !skippedIds.has(id));
    updateOrdersStatus(eligibleIds, status, cancelReason);
    const skipped = skippedIds.size;
    const applied = ids.length - skipped;
    if (skipped > 0 && status === "Cancelled") {
      const reasons = [
        alreadyCancelledIds.length > 0 ? `${alreadyCancelledIds.length} already-cancelled` : "",
        poLockedIds.length > 0 ? `${poLockedIds.length} with confirmed POs` : "",
      ].filter(Boolean).join(" and ");
      showToast(`Updated ${applied} order${applied !== 1 ? "s" : ""} to "${status}". ${skipped} order${skipped !== 1 ? "s" : ""} skipped (${reasons}).`);
    } else {
      showToast(
        skipped > 0
          ? `Updated ${applied} order${applied !== 1 ? "s" : ""} to "${status}". ${skipped} already-cancelled order(s) were skipped.`
          : `Updated ${applied} order${applied !== 1 ? "s" : ""} to "${status}"`
      );
    }
    setPendingBulkCancel(false);
    setBulkCancelReason("");
  };

  // ── Bulk update notes ───────────────────────────────────────────────────────
  const handleBulkNotesApply = (note: string, visibility: string) => {
    if (isViewOnly) {
      showToast("This action is disabled while using client-user impersonation.");
      setShowBulkNotes(false);
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const author = user?.name || "System Owner";
    const newNote = { id: "n" + Date.now(), author, date: dateStr, text: note, visibility };

    // Append to each selected order's notes in localStorage (same key as OrderDetailsPage)
    [...selected].forEach(orderId => {
      const key = `nido_notes_${orderId}`;
      let existing: typeof newNote[] = [];
      try { existing = JSON.parse(localStorage.getItem(key) || "null") || []; } catch { existing = []; }
      localStorage.setItem(key, JSON.stringify([newNote, ...existing]));
    });

    showToast(`Note added to ${totalSelected} order${totalSelected !== 1 ? "s" : ""}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div
      style={{ fontFamily: "'Inter','Segoe UI',sans-serif", minHeight: "100vh", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
      onClick={e => {
        if (showActions && actionsRef.current && !actionsRef.current.contains(e.target as Node))
          setShowActions(false);
      }}
    >
      <OrderExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        statuses={exportStatusOptions}
        clients={exportClientOptions}
        onExport={handleExport}
      />
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "hsl(var(--foreground))" }}>Orders</h1>
            <p style={{ margin: "5px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 13.5 }}>Manage and track all purchase orders</p>
          </div>
          <div ref={actionsRef} style={{ position: "relative" }}>
            <button
              onClick={e => { e.stopPropagation(); setShowActions(v => !v); }}
              style={{
                border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", borderRadius: 8,
                width: 36, height: 36, cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--foreground))",
              }}
            >⋮</button>
            {showActions && (
              <ActionDropdown
                onExport={() => setShowExportDialog(true)}
                onCreateOrder={() => {
                  if (isViewOnly) {
                    showToast("This action is disabled while using client-user impersonation.");
                    return;
                  }
                  navigate(location.pathname.startsWith("/portal/") ? "/portal/catalog" : "/shop");
                }}
                onBulkStatus={() => {
                  if (isViewOnly) {
                    showToast("This action is disabled while using client-user impersonation.");
                    return;
                  }
                  setShowBulkStatus(true);
                }}
                onBulkNotes={() => {
                  if (isViewOnly) {
                    showToast("This action is disabled while using client-user impersonation.");
                    return;
                  }
                  setShowBulkNotes(true);
                }}
                onClose={() => setShowActions(false)}
              />
            )}
          </div>
        </div>

        {orderListData.invalidCount > 0 && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              border: "1px solid #fcd34d",
              borderRadius: 8,
              background: "#fffbeb",
              color: "#92400e",
              fontSize: 13,
            }}
          >
            {orderListData.invalidCount} saved order record{orderListData.invalidCount === 1 ? "" : "s"} could not be displayed.
            The original saved data has not been changed.
          </div>
        )}

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 16, pointerEvents: "none" }}>
              🔍
            </span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by order ID, client name, or requester..."
              style={{
                width: "100%", padding: "10px 14px 10px 38px", border: "1px solid hsl(var(--border))",
                borderRadius: 8, fontSize: 13.5, color: "hsl(var(--foreground))", boxSizing: "border-box",
                outline: "none", fontFamily: "inherit", background: "hsl(var(--background))",
              }}
            />
          </div>
          <button
            onClick={() => setShowFilter(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              border: "1px solid hsl(var(--border))", borderRadius: 8,
              background: showFilter ? "hsl(var(--primary)/0.1)" : "hsl(var(--card))",
              cursor: "pointer", fontSize: 14, fontWeight: 500,
              color: showFilter ? "#2563eb" : "hsl(var(--foreground))", fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 15 }}>▼</span> Filters
            {activeFilterCount > 0 && (
              <span style={{ background: "#2563eb", color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid hsl(var(--border))", marginBottom: 0, overflowX: "auto" }}>
          {ALL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                style={{
                  padding: "11px 0", marginRight: 28, border: "none", background: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? "#2563eb" : "hsl(var(--muted-foreground))",
                  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: -2, whiteSpace: "nowrap", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {tab.label}
                <span style={{ fontSize: 13, color: active ? "#2563eb" : "hsl(var(--muted-foreground))", fontWeight: 400 }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ borderLeft: "1px solid hsl(var(--border))", borderRight: "1px solid hsl(var(--border))", borderBottom: "1px solid hsl(var(--border))", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", background: "hsl(var(--card))" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))" }}>
                  <th style={{ ...thSt, width: 44 }}>
                    <input
                      type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll} style={{ cursor: "pointer", width: 15, height: 15 }}
                    />
                  </th>
                  {["ORDER ID", "CLIENT", "REQUESTER", "ASSIGNED", "ORDER DATE ↓", "STATUS", "SLA TIME ⓘ", "TOTAL AMOUNT"].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => {
                  const isSel = selected.has(order.id);
                  return (
                    <tr key={order.id}
                      style={{ borderBottom: i < filteredOrders.length - 1 ? "1px solid hsl(var(--border))" : "none", background: isSel ? "hsl(var(--primary)/0.08)" : "transparent", transition: "background 0.1s" }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "hsl(var(--muted))"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSel ? "hsl(var(--primary)/0.08)" : "transparent"; }}>
                      <td style={tdSt}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(order.id)} style={{ cursor: "pointer", width: 15, height: 15 }} />
                      </td>
                      <td style={tdSt}>
                        <button
                          onClick={() => navigate(`${location.pathname.startsWith("/portal/") ? "/portal/orders" : "/orders"}/${order.id}`)}
                          style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
                        >
                          {order.id}
                        </button>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.clientInitial} color={order.clientColor} size={28} />
                          <span style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>{order.client}</span>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.requesterInitial} color={order.requesterColor} size={28} />
                          <div>
                            <div style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>{order.requester}</div>
                            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{order.requesterRole}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.assignedInitial} color={order.assignedColor} size={28} />
                          <div>
                            <div style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>{order.assigned}</div>
                            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
                              {order.autoAssignmentStatus === "pending"
                                ? "Assignment pending"
                                : order.autoAssignmentStatus === "unassigned"
                                  ? "Needs assignment"
                                  : order.autoAssignmentStatus === "disabled"
                                    ? "Auto assignment disabled"
                                    : order.assignedRole || "Auto-assigned"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ color: "hsl(var(--foreground))" }}>{order.orderDate}</div>
                        <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{order.orderTime}</div>
                      </td>
                      <td style={tdSt}><StatusBadge status={order.status} /></td>
                      <td style={tdSt}>
                        {(() => {
                          const tiers = getClientSLA();
                          const std = tiers.find(t => t.name === "Standard") ?? tiers[0];
                          const targetHrs = std?.orderProcessingTime ?? 24;
                          const start = order.orderDate ? `${order.orderDate} ${order.orderTime || ""}` : null;
                          const done = order.status === "Delivered" || order.status === "Cancelled";
                          const sla = computeSLAStatus(start, targetHrs, done);
                          return <SLABadge sla={sla} compact />;
                        })()}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 600, color: "hsl(var(--foreground))" }}>
                        {typeof order.totalAmountNum === "number" ? formatCurrency(order.totalAmountNum) : order.totalAmount}
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>
                      No orders match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderTop: "1px solid hsl(var(--border))" }}>
            <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: 10 }}>
              {selectedCount > 0 && (
                <>
                  <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{selectedCount} rows selected</span>
                  <button onClick={() => setSelected(new Set())}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}>
                    Clear selection
                  </button>
                </>
              )}
              {selectedCount === 0 && (
                <span>Showing 1 to {filteredOrders.length} of {filteredOrders.length} orders</span>
              )}
              {selectedCount > 0 && (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>· Showing 1 to {filteredOrders.length} of {filteredOrders.length} orders</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button style={{ width: 30, height: 30, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--card))", cursor: "pointer", fontSize: 14, color: "hsl(var(--muted-foreground))" }}>‹</button>
              {[1, 2, 3, 4, 5].map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} style={{
                  width: 30, height: 30, border: currentPage === p ? "1px solid #2563eb" : "1px solid hsl(var(--border))",
                  borderRadius: 6, background: currentPage === p ? "hsl(var(--primary)/0.1)" : "hsl(var(--card))",
                  color: currentPage === p ? "#2563eb" : "hsl(var(--foreground))", cursor: "pointer",
                  fontWeight: currentPage === p ? 700 : 400, fontSize: 13, fontFamily: "inherit",
                }}>{p}</button>
              ))}
              <button style={{ width: 30, height: 30, border: "1px solid hsl(var(--border))", borderRadius: 6, background: "hsl(var(--card))", cursor: "pointer", fontSize: 14, color: "hsl(var(--muted-foreground))" }}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter overlay */}
      {showFilter && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 299 }} onClick={() => setShowFilter(false)} />
          <FilterPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilter(false)} onApply={handleApply} onClear={handleClear} />
        </>
      )}

      {/* Bulk status modal */}
      {showBulkStatus && (
        <BulkStatusModal
          selectedCount={totalSelected}
          onApply={handleBulkStatusApply}
          onClose={() => setShowBulkStatus(false)}
        />
      )}

      {/* Bulk cancel confirmation */}
      {pendingBulkCancel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} onClick={() => { setPendingBulkCancel(false); setBulkCancelReason(""); }} />
          <div style={{ position: "relative", background: "hsl(var(--card))", borderRadius: 14, padding: "28px 32px", width: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", fontFamily: "inherit", border: "1px solid hsl(var(--border))" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700, color: "#dc2626" }}>
              Cancel {totalSelected} order{totalSelected !== 1 ? "s" : ""}?
            </h2>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
              ⚠️ This action cannot be undone. Once cancelled, an order can no longer be edited, have its status changed, or be processed further.
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 5 }}>
              Reason for Cancellation <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              value={bulkCancelReason}
              onChange={e => setBulkCancelReason(e.target.value)}
              rows={3}
              placeholder="Enter reason for cancellation..."
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${bulkCancelReason.trim() ? "hsl(var(--border))" : "#fca5a5"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: 4, background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
            />
            {!bulkCancelReason.trim() && <div style={{ fontSize: 11.5, color: "#dc2626", marginBottom: 14 }}>Reason is required before confirming cancellation.</div>}
            {bulkCancelReason.trim() && <div style={{ marginBottom: 14 }} />}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setPendingBulkCancel(false); setBulkCancelReason(""); }} style={{ flex: 1, padding: "10px 0", border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--card))", color: "hsl(var(--foreground))", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>
                Keep Orders
              </button>
              <button onClick={() => { if (!bulkCancelReason.trim()) return; applyBulkStatus("Cancelled", bulkCancelReason.trim()); }} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, background: bulkCancelReason.trim() ? "#dc2626" : "#fca5a5", color: "#fff", cursor: bulkCancelReason.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 14, fontFamily: "inherit", transition: "background 0.15s" }}>
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk notes modal */}
      {showBulkNotes && (
        <BulkNotesModal
          selectedCount={totalSelected}
          onApply={handleBulkNotesApply}
          onClose={() => setShowBulkNotes(false)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
