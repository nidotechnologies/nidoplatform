import { useState, useMemo, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus =
  | "Processing"
  | "Partially Shipped"
  | "Partially Delivered"
  | "Delivered"
  | "Cancelled"
  | "Draft";

interface Order {
  id: string;
  client: string;
  clientColor: string;
  clientInitial: string;
  poNumber: string;
  requester: string;
  requesterRole: string;
  requesterInitial: string;
  requesterColor: string;
  assigned: string;
  assignedRole: string;
  assignedInitial: string;
  assignedColor: string;
  orderDate: string;
  orderTime: string;
  status: OrderStatus;
  slaTime: string | null;
  slaAlert: boolean;
  totalAmount: string;
}

const ORDERS: Order[] = [
  {
    id: "ORD-24815779", client: "TechHub Solutions", clientColor: "#c53030", clientInitial: "T",
    poNumber: "PO-10034", requester: "Pavan", requesterRole: "System Owner", requesterInitial: "P", requesterColor: "#6b46c1",
    assigned: "Sneha Iyer", assignedRole: "Admin", assignedInitial: "S", assignedColor: "#276749",
    orderDate: "Apr 16, 2026", orderTime: "12:33 PM", status: "Processing",
    slaTime: "02:45", slaAlert: true, totalAmount: "$2,192.00",
  },
  {
    id: "ORD-24815678", client: "OfficeMart Supplies", clientColor: "#2b6cb0", clientInitial: "O",
    poNumber: "PO-10035", requester: "Rohit Sharma", requesterRole: "Admin", requesterInitial: "R", requesterColor: "#9b2c2c",
    assigned: "Priya Nair", assignedRole: "Admin", assignedInitial: "P", assignedColor: "#c05621",
    orderDate: "Apr 15, 2026", orderTime: "04:15 PM", status: "Partially Shipped",
    slaTime: "01:30", slaAlert: false, totalAmount: "$1,045.50",
  },
  {
    id: "ORD-24815560", client: "PaperWorld Distributors", clientColor: "#276749", clientInitial: "A",
    poNumber: "PO-10036", requester: "Anita Desai", requesterRole: "Procurement Manager", requesterInitial: "A", requesterColor: "#276749",
    assigned: "Arjun Mehta", assignedRole: "Procurement Manager", assignedInitial: "A", assignedColor: "#276749",
    orderDate: "Apr 14, 2026", orderTime: "11:20 AM", status: "Partially Delivered",
    slaTime: "03:10", slaAlert: false, totalAmount: "$3,765.25",
  },
  {
    id: "ORD-24815432", client: "Global Industrial", clientColor: "#276749", clientInitial: "G",
    poNumber: "PO-10037", requester: "Sanjay Patel", requesterRole: "Purchase Executive", requesterInitial: "S", requesterColor: "#276749",
    assigned: "Rahul Verma", assignedRole: "Purchase Executive", assignedInitial: "R", assignedColor: "#9b2c2c",
    orderDate: "Apr 13, 2026", orderTime: "09:10 AM", status: "Delivered",
    slaTime: null, slaAlert: false, totalAmount: "$980.00",
  },
  {
    id: "ORD-24815321", client: "TechHub Solutions", clientColor: "#c53030", clientInitial: "T",
    poNumber: "PO-10038", requester: "Priya Nair", requesterRole: "Admin", requesterInitial: "P", requesterColor: "#c05621",
    assigned: "Sneha Iyer", assignedRole: "Admin", assignedInitial: "S", assignedColor: "#276749",
    orderDate: "Apr 12, 2026", orderTime: "02:45 PM", status: "Delivered",
    slaTime: null, slaAlert: false, totalAmount: "$1,560.00",
  },
  {
    id: "ORD-24815210", client: "OfficeMart Supplies", clientColor: "#2b6cb0", clientInitial: "O",
    poNumber: "PO-10039", requester: "Rahul Verma", requesterRole: "Purchase Executive", requesterInitial: "R", requesterColor: "#9b2c2c",
    assigned: "Sanjay Patel", assignedRole: "Purchase Executive", assignedInitial: "S", assignedColor: "#276749",
    orderDate: "Apr 11, 2026", orderTime: "10:30 AM", status: "Cancelled",
    slaTime: null, slaAlert: false, totalAmount: "$450.00",
  },
  {
    id: "ORD-24815105", client: "PaperWorld Distributors", clientColor: "#276749", clientInitial: "A",
    poNumber: "-", requester: "Arjun Mehta", requesterRole: "Procurement Manager", requesterInitial: "A", requesterColor: "#276749",
    assigned: "Anita Desai", assignedRole: "Procurement Manager", assignedInitial: "A", assignedColor: "#276749",
    orderDate: "Apr 10, 2026", orderTime: "03:20 PM", status: "Draft",
    slaTime: null, slaAlert: false, totalAmount: "$0.00",
  },
  {
    id: "ORD-24815001", client: "Global Industrial", clientColor: "#276749", clientInitial: "G",
    poNumber: "PO-10040", requester: "Sneha Iyer", requesterRole: "Admin", requesterInitial: "S", requesterColor: "#276749",
    assigned: "Priya Nair", assignedRole: "Admin", assignedInitial: "P", assignedColor: "#c05621",
    orderDate: "Apr 09, 2026", orderTime: "01:05 PM", status: "Processing",
    slaTime: "01:05", slaAlert: true, totalAmount: "$875.75",
  },
];

const STATUS_STYLE: Record<OrderStatus, { bg: string; color: string; border: string }> = {
  Processing:           { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  "Partially Shipped":  { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  "Partially Delivered":{ bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Delivered:            { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Cancelled:            { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  Draft:                { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
};

const ALL_TABS = [
  { key: "All Orders", label: "All Orders", count: 36 },
  { key: "Draft", label: "Draft", count: 4 },
  { key: "Processing", label: "Processing", count: 8 },
  { key: "Partially Shipped", label: "Partially Shipped", count: 6 },
  { key: "Partially Delivered", label: "Partially Delivered", count: 5 },
  { key: "Delivered", label: "Delivered", count: 13 },
  { key: "Cancelled", label: "Cancelled", count: 0 },
];

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
  const s = STATUS_STYLE[status];
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

interface FilterState {
  orderId: string; poNumber: string; masterOrderId: string; clientOrderRef: string;
  requestTitle: string; client: string; orderStatus: string; assignedTo: string;
  slaStatus: string; slaFrom: string; slaTo: string; orderDate: string;
  delivery: string; minAmount: string; maxAmount: string; requester: string;
  vendorStatus: string; priority: string; paymentStatus: string;
  attachments: string; tags: string;
}

const EMPTY_FILTERS: FilterState = {
  orderId: "", poNumber: "", masterOrderId: "", clientOrderRef: "",
  requestTitle: "", client: "", orderStatus: "", assignedTo: "",
  slaStatus: "", slaFrom: "", slaTo: "", orderDate: "",
  delivery: "", minAmount: "", maxAmount: "", requester: "",
  vendorStatus: "", priority: "", paymentStatus: "", attachments: "", tags: "",
};

const labelSt: React.CSSProperties = { display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 500 };
const inputSt: React.CSSProperties = {
  width: "100%", padding: "7px 10px", border: "1px solid #d1d5db",
  borderRadius: 6, fontSize: 13, color: "#374151", background: "#fff",
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
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, height: "100vh", width: 320,
      background: "#fff", boxShadow: "-2px 0 20px rgba(0,0,0,0.10)",
      zIndex: 300, display: "flex", flexDirection: "column", fontFamily: "inherit",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Filters</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onClear} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Clear All</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#9ca3af", lineHeight: 1, padding: 0 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Order Information</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Inp label="Order ID" fkey="orderId" placeholder="Enter order ID" {...p} />
          <Inp label="PO Number" fkey="poNumber" placeholder="Enter PO number" {...p} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Inp label="Master Order ID" fkey="masterOrderId" placeholder="Enter master order ID" {...p} />
          <Inp label="Client Order Reference" fkey="clientOrderRef" placeholder="Enter reference" {...p} />
        </div>
        <Inp label="Request Title / Description" fkey="requestTitle" placeholder="Enter request title or description" {...p} />
        <Sel label="Client" fkey="client" placeholder="Select Client"
          options={["TechHub Solutions", "OfficeMart Supplies", "PaperWorld Distributors", "Global Industrial"]} {...p} />
        <Sel label="Order Status" fkey="orderStatus" placeholder="Select status"
          options={["Processing", "Partially Shipped", "Partially Delivered", "Delivered", "Cancelled", "Draft"]} {...p} />
        <Sel label="Assigned To" fkey="assignedTo" placeholder="Select users"
          options={["Sneha Iyer", "Priya Nair", "Arjun Mehta", "Rahul Verma", "Sanjay Patel", "Anita Desai"]} {...p} />
        <Sel label="SLA Status" fkey="slaStatus" placeholder="Select SLA status"
          options={["On Track", "At Risk", "Breached"]} {...p} />
        <div>
          <label style={labelSt}>Remaining SLA Time</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>From</div>
              <div style={{ position: "relative" }}>
                <input style={inputSt} type="time" value={filters.slaFrom}
                  onChange={e => setFilters({ ...filters, slaFrom: e.target.value })} />
              </div>
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

      <div style={{ padding: "14px 20px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 10 }}>
        <button onClick={onClear} style={{
          flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7,
          background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Clear All</button>
        <button onClick={onApply} style={{
          flex: 1, padding: "9px 0", border: "none", borderRadius: 7,
          background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
        }}>Apply Filters</button>
      </div>
    </div>
  );
}

function ActionDropdown({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: "⬆️", label: "Export" },
    { icon: "+", label: "Create Order" },
    { icon: "⟳", label: "Bulk Update Status" },
    { icon: "✎", label: "Bulk Update Notes" },
  ];
  return (
    <div style={{
      position: "absolute", top: 40, right: 0, background: "#fff",
      boxShadow: "0 4px 20px rgba(0,0,0,0.13)", borderRadius: 10, zIndex: 200,
      minWidth: 210, border: "1px solid #e5e7eb", overflow: "hidden",
    }}>
      {items.map(item => (
        <button key={item.label} onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          padding: "11px 18px", border: "none", background: "none",
          cursor: "pointer", fontSize: 14, color: "#374151", textAlign: "left", fontFamily: "inherit",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

const thSt: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 600,
  color: "#6b7280", letterSpacing: 0.4, whiteSpace: "nowrap", userSelect: "none" as const,
};
const tdSt: React.CSSProperties = { padding: "14px 16px", verticalAlign: "middle" };

export default function MyOrderPage() {
  const [activeTab, setActiveTab] = useState("All Orders");
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set(
    ["ORD-24815779", "ORD-24815678", "ORD-24815560", "ORD-24815321", "ORD-24815001"]
  ));
  const [currentPage, setCurrentPage] = useState(1);
  const actionsRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v !== "").length;

  const filteredOrders = useMemo(() => {
    return ORDERS.filter(o => {
      if (activeTab !== "All Orders" && o.status !== activeTab) return false;
      const q = search.toLowerCase();
      if (q && !o.id.toLowerCase().includes(q) && !o.client.toLowerCase().includes(q) &&
        !o.poNumber.toLowerCase().includes(q) && !o.requester.toLowerCase().includes(q)) return false;
      if (appliedFilters.client && o.client !== appliedFilters.client) return false;
      if (appliedFilters.orderStatus && o.status !== appliedFilters.orderStatus) return false;
      if (appliedFilters.requester && !o.requester.toLowerCase().includes(appliedFilters.requester.toLowerCase())) return false;
      if (appliedFilters.assignedTo && !o.assigned.toLowerCase().includes(appliedFilters.assignedTo.toLowerCase())) return false;
      if (appliedFilters.minAmount) {
        const min = parseFloat(appliedFilters.minAmount.replace(/,/g, ""));
        const amt = parseFloat(o.totalAmount.replace(/[$,]/g, ""));
        if (!isNaN(min) && amt < min) return false;
      }
      if (appliedFilters.maxAmount) {
        const max = parseFloat(appliedFilters.maxAmount.replace(/,/g, ""));
        const amt = parseFloat(o.totalAmount.replace(/[$,]/g, ""));
        if (!isNaN(max) && amt > max) return false;
      }
      return true;
    });
  }, [activeTab, search, appliedFilters]);

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

  return (
    <div
      style={{ fontFamily: "'Inter','Segoe UI',sans-serif", minHeight: "100vh", background: "#fff", color: "#111827" }}
      onClick={e => {
        if (showActions && actionsRef.current && !actionsRef.current.contains(e.target as Node))
          setShowActions(false);
      }}
    >
      {/* Page */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 40px" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111827" }}>Orders</h1>
            <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13.5 }}>Manage and track all purchase orders</p>
          </div>
          <div ref={actionsRef} style={{ position: "relative" }}>
            <button
              onClick={e => { e.stopPropagation(); setShowActions(v => !v); }}
              style={{
                border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8,
                width: 36, height: 36, cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center", color: "#374151",
              }}
            >⋮</button>
            {showActions && <ActionDropdown onClose={() => setShowActions(false)} />}
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 16, pointerEvents: "none" }}>
              🔍
            </span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by order ID, client name, PO number, or requester..."
              style={{
                width: "100%", padding: "10px 14px 10px 38px", border: "1px solid #e5e7eb",
                borderRadius: 8, fontSize: 13.5, color: "#374151", boxSizing: "border-box",
                outline: "none", fontFamily: "inherit", background: "#fff",
              }}
            />
          </div>
          <button
            onClick={() => setShowFilter(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              border: "1px solid #e5e7eb", borderRadius: 8,
              background: showFilter ? "#eff6ff" : "#fff",
              cursor: "pointer", fontSize: 14, fontWeight: 500,
              color: showFilter ? "#2563eb" : "#374151", fontFamily: "inherit",
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
        <div style={{ display: "flex", borderBottom: "2px solid #f3f4f6", marginBottom: 0, overflowX: "auto" }}>
          {ALL_TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                style={{
                  padding: "11px 0", marginRight: 28, border: "none", background: "none", cursor: "pointer",
                  fontSize: 14, fontWeight: active ? 700 : 400,
                  color: active ? "#2563eb" : "#6b7280",
                  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: -2, whiteSpace: "nowrap", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {tab.label}
                <span style={{ fontSize: 13, color: active ? "#2563eb" : "#9ca3af", fontWeight: 400 }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ ...thSt, width: 44 }}>
                    <input
                      type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll} style={{ cursor: "pointer", width: 15, height: 15 }}
                    />
                  </th>
                  {["ORDER ID", "CLIENT", "PO NUMBER", "REQUESTER", "ASSIGNED", "ORDER DATE ↓", "STATUS", "SLA TIME ⓘ", "TOTAL AMOUNT"].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => {
                  const isSel = selected.has(order.id);
                  return (
                    <tr key={order.id}
                      style={{ borderBottom: i < filteredOrders.length - 1 ? "1px solid #f3f4f6" : "none", background: isSel ? "#f0f7ff" : "#fff", transition: "background 0.1s" }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#fafafa"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSel ? "#f0f7ff" : "#fff"; }}>
                      <td style={tdSt}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(order.id)} style={{ cursor: "pointer", width: 15, height: 15 }} />
                      </td>
                      <td style={tdSt}>
                        <a href="#" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }} onClick={e => e.preventDefault()}>
                          {order.id}
                        </a>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.clientInitial} color={order.clientColor} size={28} />
                          <span style={{ fontWeight: 500, color: "#111827" }}>{order.client}</span>
                        </div>
                      </td>
                      <td style={tdSt}>
                        {order.poNumber !== "-" ? (
                          <a href="#" style={{ color: "#2563eb", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.preventDefault()}>
                            {order.poNumber} <span style={{ fontSize: 11 }}>↗</span>
                          </a>
                        ) : <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.requesterInitial} color={order.requesterColor} size={28} />
                          <div>
                            <div style={{ fontWeight: 500, color: "#111827" }}>{order.requester}</div>
                            <div style={{ color: "#9ca3af", fontSize: 12 }}>{order.requesterRole}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar initial={order.assignedInitial} color={order.assignedColor} size={28} />
                          <div>
                            <div style={{ fontWeight: 500, color: "#111827" }}>{order.assigned}</div>
                            <div style={{ color: "#9ca3af", fontSize: 12 }}>{order.assignedRole}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <div style={{ color: "#111827" }}>{order.orderDate}</div>
                        <div style={{ color: "#9ca3af", fontSize: 12 }}>{order.orderTime}</div>
                      </td>
                      <td style={tdSt}><StatusBadge status={order.status} /></td>
                      <td style={tdSt}>
                        {order.slaTime ? (
                          <span style={{ color: order.slaAlert ? "#dc2626" : "#374151", fontWeight: order.slaAlert ? 700 : 400 }}>
                            {order.slaTime}
                          </span>
                        ) : (
                          <span style={{ color: "#d1d5db" }}>-</span>
                        )}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 600, color: "#111827" }}>{order.totalAmount}</td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>
                      No orders match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderTop: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 10 }}>
              {selectedCount > 0 && (
                <>
                  <span style={{ color: "#111827", fontWeight: 500 }}>{selectedCount} rows selected</span>
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
                <span style={{ color: "#9ca3af" }}>· Showing 1 to {filteredOrders.length} of {filteredOrders.length} orders</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button style={{ width: 30, height: 30, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 14, color: "#6b7280" }}>‹</button>
              {[1, 2, 3, 4, 5].map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} style={{
                  width: 30, height: 30, border: currentPage === p ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  borderRadius: 6, background: currentPage === p ? "#eff6ff" : "#fff",
                  color: currentPage === p ? "#2563eb" : "#374151", cursor: "pointer",
                  fontWeight: currentPage === p ? 700 : 400, fontSize: 13, fontFamily: "inherit",
                }}>{p}</button>
              ))}
              <button style={{ width: 30, height: 30, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 14, color: "#6b7280" }}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Overlay */}
      {showFilter && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 299 }} onClick={() => setShowFilter(false)} />
          <FilterPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilter(false)} onApply={handleApply} onClear={handleClear} />
        </>
      )}
    </div>
  );
}
