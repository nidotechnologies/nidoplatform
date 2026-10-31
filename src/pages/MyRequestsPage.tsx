import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Filter,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  Clock,
  CheckSquare,
  XCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import { serviceRequestBelongsToPortalUser } from "@/lib/serviceRequestAccess";
import {
  getServiceRequests,
  updateServiceRequest,
} from "@/lib/serviceRequestsStore";

// ─── Types ────────────────────────────────────────────────────────────────────
type RequestStatus = string;
type RequestPriority = string;

interface ServiceRequest {
  id: string;
  requestType: string;
  itemAsset: string;
  assetTag: string;
  location: string;
  requestDate: string;       // "DD Mon YYYY"
  requestDateTs: number;     // Unix ms for filtering
  status: RequestStatus;
  priority: RequestPriority;
  nextAppointment: string;
  requestedBy: string;
  clientId?: string;
  requestedById?: string;
  requestedByEmail?: string;
  payload?: Record<string, unknown>;
}

// ─── Date helper ─────────────────────────────────────────────────────────────
function parseDate(s: string): number {
  const timestamp = new Date(s).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function loadAllRequests(): ServiceRequest[] {
  return getServiceRequests().map(s => ({
    id:              s.id,
    requestType:     s.requestType || "Service Request",
    itemAsset:       s.itemAsset || "—",
    assetTag:        s.assetTag || "",
    location:        s.location || "—",
    requestDate:     s.requestDate || "—",
    requestDateTs:   s.requestDateTs || parseDate(s.requestDate),
    status:          s.status || "Pending",
    priority:        s.priority || "Medium",
    nextAppointment: s.nextAppointment || "—",
    requestedBy:     s.requestedBy || "—",
    clientId:        s.clientId || (typeof s.payload?.clientId === "string" ? s.payload.clientId : undefined),
    requestedById:   s.requestedById || (typeof s.payload?.requestedById === "string" ? s.payload.requestedById : undefined),
    requestedByEmail:s.requestedByEmail || (typeof s.payload?.requestedByEmail === "string" ? s.payload.requestedByEmail : undefined),
    payload:         s.payload,
  }));
}

// ─── Date-range options ───────────────────────────────────────────────────────
const DATE_RANGES = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "This Year", "All Time"] as const;
type DateRange = typeof DATE_RANGES[number];

function dateRangeCutoff(range: DateRange, now = Date.now()): number {
  switch (range) {
    case "Last 7 Days":  return now - 7  * 86400000;
    case "Last 30 Days": return now - 30 * 86400000;
    case "Last 90 Days": return now - 90 * 86400000;
    case "This Year":    return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    default:             return 0;
  }
}

// ─── Colours ──────────────────────────────────────────────────────────────────
const statusColors: Record<RequestStatus, string> = {
  "In Progress": "bg-blue-100 text-blue-700",
  "Active":      "bg-emerald-100 text-emerald-700",
  "Scheduled":   "bg-purple-100 text-purple-700",
  "Completed":   "bg-green-100 text-green-700",
  "Cancelled":   "bg-red-100 text-red-600",
  "Pending":     "bg-amber-100 text-amber-700",
};

const priorityColors: Record<RequestPriority, string> = {
  High:   "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low:    "bg-gray-100 text-gray-500",
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────
function RowActions({
  onView,
  onEdit,
  onCancel,
  cancelDisabled,
}: {
  onView: () => void;
  onEdit: () => void;
  onCancel: () => void;
  cancelDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const calculateMenuPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    const menuWidth = 176;
    const menuHeight = 112;
    const margin = 8;
    const left = Math.min(
      Math.max(buttonRect.right - menuWidth, margin),
      Math.max(margin, window.innerWidth - menuWidth - margin),
    );
    let top = buttonRect.bottom + 4;
    if (top + menuHeight > window.innerHeight - margin) {
      top = buttonRect.top - menuHeight - 4;
    }
    top = Math.min(
      Math.max(top, margin),
      Math.max(margin, window.innerHeight - menuHeight - margin),
    );
    setMenuPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => calculateMenuPosition();
    document.addEventListener("mousedown", h);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, calculateMenuPosition]);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    calculateMenuPosition();
    setOpen(true);
  };

  const actions = [
    { label: "View Details", action: onView, disabled: false, cls: "text-gray-700 hover:bg-gray-50" },
    { label: "Edit Request", action: onEdit, disabled: false, cls: "text-gray-700 hover:bg-gray-50" },
    {
      label: "Cancel Request",
      action: onCancel,
      disabled: cancelDisabled,
      cls: cancelDisabled ? "text-gray-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50",
    },
  ];
  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Request actions"
        aria-expanded={open}
        onClick={toggleMenu}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          className="fixed w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
          style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 1000 }}
        >
          {actions.map(({ label, action, disabled, cls }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => { action(); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors disabled:bg-transparent ${cls}`}
            >
              {label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
interface Filters {
  requestType: string;
  priority: string;
  location: string;
  requestedBy: string;
}

const EMPTY_FILTERS: Filters = { requestType: "All", priority: "All", location: "All", requestedBy: "All" };

function FilterPanel({
  open, onClose, filters, onApply, requests,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (f: Filters) => void;
  requests: ServiceRequest[];
}) {
  const [local, setLocal] = useState<Filters>(filters);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocal(filters); }, [filters, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);

  if (!open) return null;

  const requestTypes = ["All", ...Array.from(new Set(requests.map(r => r.requestType).filter(Boolean)))];
  const priorities   = ["All", "High", "Medium", "Low"];
  const locations    = ["All", ...Array.from(new Set(requests.map(r => r.location).filter(value => value && value !== "—")))];
  const requestedBys = ["All", ...Array.from(new Set(requests.map(r => r.requestedBy).filter(value => value && value !== "—")))];

  const Field = ({ label, field, options }: { label: string; field: keyof Filters; options: string[] }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <select
          value={local[field]}
          onChange={e => setLocal(p => ({ ...p, [field]: e.target.value }))}
          className="w-full appearance-none pl-2.5 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  const hasChanges = JSON.stringify(local) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Filters</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="space-y-3">
        <Field label="Request Type" field="requestType" options={requestTypes} />
        <Field label="Priority"     field="priority"    options={priorities} />
        <Field label="Location"     field="location"    options={locations} />
        <Field label="Requested By" field="requestedBy" options={requestedBys} />
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => { setLocal(EMPTY_FILTERS); onApply(EMPTY_FILTERS); onClose(); }}
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={() => { onApply(local); onClose(); }}
          className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Apply Filters
        </button>
      </div>
      {hasChanges && (
        <p className="text-xs text-blue-500 mt-2 text-center">Unsaved changes</p>
      )}
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(rows: ServiceRequest[]) {
  const headers = ["Request ID", "Request Type", "Item / Asset", "Asset Tag", "Location", "Request Date", "Status", "Priority", "Next Appointment", "Requested By"];
  const csvRows = rows.map(r => [
    r.id, r.requestType, r.itemAsset, r.assetTag, r.location, r.requestDate,
    r.status, r.priority, r.nextAppointment.replace("\n", " "), r.requestedBy,
  ].map(v => `"${v}"`).join(","));
  const blob = new Blob([headers.join(",") + "\n" + csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-requests-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { user, isClientPortalUser } = useAuth();
  const myServicesPath = isClientPortalUser ? "/portal/my-services" : "/my-services";
  const ITEMS_PER_PAGE = 10;

  const [currentPage,  setCurrentPage]  = useState(1);
  const [tileFilter,   setTileFilter]   = useState("All");
  const [dateRange,    setDateRange]     = useState<DateRange>("All Time");
  const [filters,      setFilters]       = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [allRequests,  setAllRequests]  = useState<ServiceRequest[]>(() => loadAllRequests());
  const filterBtnRef = useRef<HTMLDivElement>(null);

  // Keep the list current after submissions, edits, or cancellations.
  useEffect(() => {
    const refresh = () => setAllRequests(loadAllRequests());
    refresh();
    window.addEventListener("serviceRequestsUpdated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("serviceRequestsUpdated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const portalClientUsers = isClientPortalUser && user?.clientId
    ? getPortalUsersByClient(user.clientId)
    : [];
  const visibleRequests = isClientPortalUser && user
    ? allRequests.filter((request) => serviceRequestBelongsToPortalUser(request, user, portalClientUsers))
    : isClientPortalUser
      ? []
      : allRequests;

  // ── Apply all filters ──
  const now = Date.now();
  const cutoff = dateRangeCutoff(dateRange, now);

  const filtered = visibleRequests.filter(r => {
    if (tileFilter === "Pending / Scheduled" && !["Pending", "Scheduled", "Active"].includes(r.status)) return false;
    if (tileFilter !== "All" && tileFilter !== "Pending / Scheduled" && r.status !== tileFilter) return false;
    if (dateRange !== "All Time" && (r.requestDateTs < cutoff || r.requestDateTs > now)) return false;
    if (filters.requestType !== "All" && r.requestType !== filters.requestType) return false;
    if (filters.priority    !== "All" && r.priority    !== filters.priority)    return false;
    if (filters.location    !== "All" && r.location    !== filters.location)    return false;
    if (filters.requestedBy !== "All" && r.requestedBy !== filters.requestedBy) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(currentPage, totalPages);
  const paged      = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleTile = (key: string) => {
    setTileFilter(prev => prev === key ? "All" : key);
    setCurrentPage(1);
  };

  const handleCancelRequest = (request: ServiceRequest) => {
    if (["completed", "cancelled", "closed"].includes(request.status.toLowerCase())) return;
    if (!window.confirm(`Cancel service request ${request.id}?`)) return;
    const updated = updateServiceRequest(request.id, {
      status: "Cancelled",
      payload: { ...(request.payload ?? {}), status: "Cancelled" },
    });
    if (!updated) {
      toast.error("This request is no longer available.");
      return;
    }
    toast.success("Request cancelled.");
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== "All").length;
  const hasAnyFilter = tileFilter !== "All" || activeFilterCount > 0;

  const clearAll = () => {
    setTileFilter("All");
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  };

  // ── Stats (dynamic) ──
  const stats = [
    { label: "Total Requests",      value: visibleRequests.length,                                                       filterKey: "All",        icon: <ClipboardList className="w-5 h-5 text-blue-500" />,   iconBg: "bg-blue-50",    border: "border-blue-100",    valueColor: "text-gray-900"    },
    { label: "In Progress",         value: visibleRequests.filter(r => r.status === "In Progress").length,               filterKey: "In Progress", icon: <CheckCircle2  className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", border: "border-emerald-100", valueColor: "text-emerald-600" },
    { label: "Pending / Scheduled", value: visibleRequests.filter(r => ["Pending", "Scheduled", "Active"].includes(r.status)).length, filterKey: "Pending / Scheduled", icon: <Clock className="w-5 h-5 text-amber-500" />, iconBg: "bg-amber-50", border: "border-amber-100", valueColor: "text-amber-600" },
    { label: "Completed",           value: visibleRequests.filter(r => r.status === "Completed").length,                 filterKey: "Completed",   icon: <CheckSquare   className="w-5 h-5 text-purple-500" />,  iconBg: "bg-purple-50",  border: "border-purple-100",  valueColor: "text-purple-600"  },
    { label: "Cancelled",           value: visibleRequests.filter(r => r.status === "Cancelled").length,                 filterKey: "Cancelled",   icon: <XCircle       className="w-5 h-5 text-red-400" />,     iconBg: "bg-red-50",     border: "border-red-100",     valueColor: "text-red-500"     },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and track all your service requests</p>
        </div>
      </div>

      <div className="w-full px-4 py-4">
        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {stats.map(s => {
            const isActive = tileFilter === s.filterKey;
            return (
              <Card
                key={s.label}
                onClick={() => handleTile(s.filterKey)}
                className={`cursor-pointer transition-all hover:shadow-md border ${s.border} ${isActive ? "ring-2 ring-blue-500 shadow-md" : ""}`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                    {s.icon}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold leading-none ${s.valueColor}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Table Card ── */}
        <Card>
          <CardContent className="p-0">

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 flex-wrap">
              {/* Active filter chips */}
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {tileFilter !== "All" && (
                  <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full font-medium">
                    Status: {tileFilter}
                    <button onClick={() => { setTileFilter("All"); setCurrentPage(1); }} className="text-blue-400 hover:text-blue-700 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {filters.requestType !== "All" && (
                  <span className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full font-medium">
                    Type: {filters.requestType}
                    <button onClick={() => { setFilters(p => ({ ...p, requestType: "All" })); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {filters.priority !== "All" && (
                  <span className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full font-medium">
                    Priority: {filters.priority}
                    <button onClick={() => { setFilters(p => ({ ...p, priority: "All" })); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {filters.location !== "All" && (
                  <span className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full font-medium">
                    Location: {filters.location}
                    <button onClick={() => { setFilters(p => ({ ...p, location: "All" })); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {filters.requestedBy !== "All" && (
                  <span className="flex items-center gap-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full font-medium">
                    By: {filters.requestedBy}
                    <button onClick={() => { setFilters(p => ({ ...p, requestedBy: "All" })); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {hasAnyFilter && (
                  <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">Clear all</button>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Filter */}
                <div ref={filterBtnRef} className="relative">
                  <button
                    onClick={() => setFilterOpen(p => !p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                      filterOpen || activeFilterCount > 0
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <FilterPanel
                    open={filterOpen}
                    onClose={() => setFilterOpen(false)}
                    filters={filters}
                    requests={visibleRequests}
                    onApply={f => { setFilters(f); setCurrentPage(1); }}
                  />
                </div>

                {/* Export */}
                <button
                  onClick={() => exportCSV(filtered)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>

                {/* Date range */}
                <div className="relative">
                  <select
                    value={dateRange}
                    onChange={e => { setDateRange(e.target.value as DateRange); setCurrentPage(1); }}
                    className="appearance-none pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer font-medium hover:bg-gray-50 transition-colors"
                  >
                    {DATE_RANGES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <Calendar className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ── Table ── */}
            <div className="w-full">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "9%" }}  />
                  <col style={{ width: "8%" }}  />
                  <col style={{ width: "7%" }}  />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "6%" }}  />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-600 font-semibold">
                    <th className="px-3 py-3 text-left">Request ID</th>
                    <th className="px-3 py-3 text-left">Request Type</th>
                    <th className="px-3 py-3 text-left">Item / Asset</th>
                    <th className="px-3 py-3 text-left">Location</th>
                    <th className="px-3 py-3 text-left">Request Date</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Priority</th>
                    <th className="px-3 py-3 text-left">Next Appointment</th>
                    <th className="px-3 py-3 text-left">Requested By</th>
                    <th className="px-3 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-gray-400">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No requests match the current filters</p>
                        {hasAnyFilter && (
                          <button onClick={clearAll} className="mt-2 text-xs text-blue-600 hover:underline">Clear all filters</button>
                        )}
                      </td>
                    </tr>
                  ) : paged.map(req => (
                    <tr key={req.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => navigate(`${myServicesPath}/requests/${req.id}`)}
                          className="text-blue-600 font-semibold hover:underline text-xs truncate block max-w-full text-left"
                        >
                          {req.id}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-800 truncate">{req.requestType}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-800 truncate">{req.itemAsset}</p>
                        {req.assetTag && <p className="text-gray-400 text-xs">{req.assetTag}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 truncate">{req.location}</td>
                      <td className="px-3 py-3 text-gray-600">{req.requestDate}</td>
                      <td className="px-3 py-3">
                        <Badge className={statusColors[req.status] ?? "bg-gray-100 text-gray-600"}>{req.status}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={priorityColors[req.priority] ?? "bg-gray-100 text-gray-600"}>{req.priority}</Badge>
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-pre-line leading-tight text-xs">{req.nextAppointment}</td>
                      <td className="px-3 py-3 text-gray-700 truncate">{req.requestedBy}</td>
                      <td className="px-3 py-3">
                        <RowActions
                          onView={() => navigate(`${myServicesPath}/requests/${req.id}`)}
                          onEdit={() => navigate(`${myServicesPath}/requests/${req.id}/edit`)}
                          onCancel={() => handleCancelRequest(req)}
                          cancelDisabled={["completed", "cancelled", "closed"].includes(req.status.toLowerCase())}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="px-3 py-3 flex items-center justify-between border-t">
              <span className="text-xs text-gray-500">
                {filtered.length === 0
                  ? "No entries"
                  : `Showing ${(safePage - 1) * ITEMS_PER_PAGE + 1} to ${Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} entries`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded border text-xs font-medium transition-colors ${p === safePage ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
