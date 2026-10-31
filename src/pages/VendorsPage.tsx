import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Star,
  X,
  Building2,
  Mail,
  MapPin,
  Calendar,
  Award,
  Users,
  AlertTriangle,
  IndianRupee,
  Edit,
  Archive,
  MoreVertical,
  CheckCircle,
  Clock,
  PauseCircle,
  XCircle,
  Phone,
  Plus,
  Download,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getVendors, saveVendors, type StoredVendor, type VendorStatus } from "@/lib/vendorDataStore";
import { useAuth } from "@/contexts/AuthContext";
import { getVendorUpdateAuditFields } from "@/lib/vendorAudit";
import * as XLSX from "xlsx";

type Vendor = StoredVendor;

const formatCrores = (val: number) => {
  const cr = val / 10000000;
  return cr >= 100 ? `₹${(cr / 100).toFixed(1)}K Cr` : `₹${cr.toFixed(1)} Cr`;
};
const formatLakhs = (val: number) => {
  if (val === 0) return "—";
  const lakh = val / 100000;
  return lakh >= 100 ? `₹${(lakh / 100).toFixed(1)} Cr` : `₹${lakh.toFixed(1)} L`;
};

const statusColors: Record<VendorStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-500",
  "On Hold": "bg-amber-100 text-amber-700",
  Pending: "bg-blue-100 text-blue-700",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
      <span className="text-xs font-semibold text-gray-800">{rating.toFixed(1)}</span>
    </div>
  );
}
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

// ----- Row Actions Menu -----
function RowActionsMenu({ vendor, onEdit, onArchive, onSetStatus }: {
  vendor: Vendor;
  onEdit: () => void;
  onArchive: () => void;
  onSetStatus: (s: VendorStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setStatusOpen(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const statuses: { label: VendorStatus; icon: React.ReactNode; color: string }[] = [
    { label: "Active", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-600" },
    { label: "On Hold", icon: <PauseCircle className="w-3.5 h-3.5" />, color: "text-amber-600" },
    { label: "Pending", icon: <Clock className="w-3.5 h-3.5" />, color: "text-blue-600" },
    { label: "Inactive", icon: <XCircle className="w-3.5 h-3.5" />, color: "text-gray-500" },
  ];

  return (
    <div ref={ref} className="relative flex justify-center">
      <button onClick={() => { setOpen(p => !p); setStatusOpen(false); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
          <button onClick={() => { onEdit(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left">
            <Edit className="w-3.5 h-3.5 opacity-60" /> Edit Vendor
          </button>
          <div className="relative">
            <button onClick={() => setStatusOpen(p => !p)} className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 opacity-60" /> Set Status</span>
              <ChevronDown className={`w-3 h-3 opacity-40 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
            </button>
            {statusOpen && (
              <div className="absolute right-full top-0 mr-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                {statuses.map(s => (
                  <button key={s.label} onClick={() => { onSetStatus(s.label); setOpen(false); setStatusOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left ${s.color} ${vendor.status === s.label ? "font-bold" : ""}`}>
                    {s.icon} {s.label} {vendor.status === s.label && <span className="ml-auto opacity-50">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 my-0.5" />
          <button onClick={() => { onArchive(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left">
            <Archive className="w-3.5 h-3.5 opacity-70" /> Archive Vendor
          </button>
        </div>
      )}
    </div>
  );
}

// ----- Top 3-dot menu -----
function TopMenu({ onArchived, onOnboarding }: { onArchived: () => void; onOnboarding: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm transition-colors">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
          {[
            { label: "Vendor Onboarding", icon: <Users className="w-4 h-4" />, onClick: onOnboarding },
            { label: "Export Vendors", icon: <IndianRupee className="w-4 h-4" />, onClick: () => {} },
            { label: "Archived Vendors", icon: <Archive className="w-4 h-4" />, onClick: onArchived },
          ].map((o, i) => (
            <button key={i} onClick={() => { o.onClick(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
              <span className="text-gray-400">{o.icon}</span>{o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Vendor Overview Popup -----
function VendorOverviewPopup({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-2 py-2 flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium mb-1">{vendor.id}</p>
            <h2 className="text-white text-xl font-semibold">{vendor.name}</h2>
            <p className="text-blue-200 text-sm mt-0.5">{vendor.category} · {vendor.region}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "Rating", value: `${vendor.rating}/5`, icon: <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> },
            { label: "Score", value: `${vendor.score}/5`, icon: <Award className="w-4 h-4 text-blue-500" /> },
            { label: "Issues", value: vendor.complianceIssues, icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-2 gap-1">
              {s.icon}
              <p className="text-lg font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="p-2 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</h3>
            {[
              { icon: <Users className="w-3.5 h-3.5 text-blue-400" />, v: vendor.primaryContact },
              { icon: <Mail className="w-3.5 h-3.5 text-blue-400" />, v: vendor.email },
              { icon: <Phone className="w-3.5 h-3.5 text-blue-400" />, v: vendor.phone },
              { icon: <MapPin className="w-3.5 h-3.5 text-blue-400" />, v: vendor.address },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">{r.icon}</span>
                <p className="text-sm text-gray-700 break-all">{r.v}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Financials</h3>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">Total Spend</p>
              <p className="text-base font-bold text-gray-800">{formatCrores(vendor.totalSpend)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5">This Month</p>
              <p className="text-base font-bold text-gray-800">{formatLakhs(vendor.monthSpend)}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Onboarded</p>
                <p className="text-sm font-medium text-gray-700">{vendor.onboardedDate}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className={statusColors[vendor.status]}>{vendor.status}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Archived Vendors Modal -----
function ArchivedModal({ vendors, onClose, onVendorClick }: { vendors: Vendor[]; onClose: () => void; onVendorClick: (v: Vendor) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full  max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Archived Vendors</h2>
            <p className="text-xs text-gray-400 mt-0.5">{vendors.length} {vendors.length === 1 ? "vendor" : "vendors"} · Read only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto flex-1">
          {vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Archive className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No archived vendors yet</p>
            </div>
          ) : (
            <table className="w-full table-fixed text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[10%]">Vendor ID</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[20%]">Vendor Name</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Category</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[16%]">Primary Contact</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[9%]">Rating</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[9%]">Region</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[9%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-3">
                      <button onClick={() => onVendorClick(v)} className="text-blue-600 font-bold hover:underline text-xs">{v.id}</button>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">{v.name[0]}</div>
                        <span className="font-medium text-gray-800 truncate">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-gray-500 truncate">{v.category}</td>
                    <td className="px-2 py-3 text-gray-500 truncate">{v.primaryContact}</td>
                    <td className="px-2 py-3"><StarRating rating={v.rating} /></td>
                    <td className="px-2 py-3 text-gray-500">{v.region}</td>
                    <td className="px-2 py-3"><Badge className="bg-gray-100 text-gray-500">Archived</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-2 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <p className="text-xs text-gray-400">This list is read-only. No actions can be performed on archived vendors.</p>
        </div>
      </div>
    </div>
  );
}

// ----- Main App -----
export default function App() {
  const navigate = useNavigate();
  const { currentAuthenticatedUser } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());
  const [overviewVendor, setOverviewVendor] = useState<Vendor | null>(null);
  const [archiveConfirmVendor, setArchiveConfirmVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    // Re-read on mount to always pick up latest store data
    setVendors(getVendors());
    const onUpdate = () => setVendors(getVendors());
    window.addEventListener('nidoVendorsUpdated', onUpdate);
    return () => window.removeEventListener('nidoVendorsUpdated', onUpdate);
  }, []);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedOverview, setArchivedOverview] = useState<Vendor | null>(null);
  const [activeTileFilter, setActiveTileFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const activeVendors = vendors.filter(v => !v.archived);
  const archivedVendors = vendors.filter(v => v.archived);

  const totalSpend = activeVendors.reduce((s, v) => s + v.totalSpend, 0);
  const avgRating = activeVendors.length ? activeVendors.reduce((s, v) => s + v.rating, 0) / activeVendors.length : 0;
  const avgScore = activeVendors.length ? activeVendors.reduce((s, v) => s + v.score, 0) / activeVendors.length : 0;
  const complianceIssues = activeVendors.reduce((s, v) => s + v.complianceIssues, 0);
  const activeCount = activeVendors.filter(v => v.status === "Active").length;

  const filteredVendors = activeVendors.filter(v => {
    switch (activeTileFilter) {
      case "Active":     return v.status === "Active";
      case "On Hold":    return v.status === "On Hold";
      case "Pending":    return v.status === "Pending";
      case "Compliance": return v.complianceIssues > 0;
      case "HasSpend":   return v.totalSpend > 0;
      default:           return true;
    }
  });

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedVendors = filteredVendors.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleTileClick = (filterKey: string) => {
    setActiveTileFilter(prev => prev === filterKey ? "All" : filterKey);
    setCurrentPage(1);
  };

  const requestArchiveVendor = (id: string) => {
    const vendor = vendors.find(v => v.id === id);
    if (vendor) setArchiveConfirmVendor(vendor);
  };
  const confirmArchiveVendor = () => {
    if (!archiveConfirmVendor) return;
    const auditFields = getVendorUpdateAuditFields(currentAuthenticatedUser);
    const updated = vendors.map(v => v.id === archiveConfirmVendor.id ? { ...v, ...auditFields, archived: true } : v);
    saveVendors(updated);
    setVendors(updated);
    setArchiveConfirmVendor(null);
  };
  const setVendorStatus = (id: string, status: VendorStatus) => {
    const auditFields = getVendorUpdateAuditFields(currentAuthenticatedUser);
    const updated = vendors.map(v => v.id === id ? { ...v, ...auditFields, status } : v);
    saveVendors(updated);
    setVendors(updated);
  };
  const exportVendors = () => {
    const rows = activeVendors.map(vendor => {
      const flattened: Record<string, string | number | boolean> = {};
      const addValue = (key: string, value: unknown) => {
        if (value === null || value === undefined) {
          flattened[key] = "";
        } else if (Array.isArray(value)) {
          flattened[key] = JSON.stringify(value);
        } else if (typeof value === "object") {
          Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
            addValue(`${key}.${childKey}`, childValue);
          });
        } else {
          flattened[key] = value;
        }
      };

      Object.entries(vendor).forEach(([key, value]) => addValue(key, value));
      return flattened;
    });
    const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    const headers = columns.map(column =>
      column.split(".").map(part => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .map(part => part.replace(/\bId\b/g, "ID"))
        .join(" / ")
    );
    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      ...rows.map(row => columns.map(column => row[column] ?? "")),
    ]);
    worksheet["!cols"] = headers.map(header => ({ wch: Math.min(Math.max(header.length + 2, 14), 36) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors");
    XLSX.writeFile(workbook, "vendors-export.xlsx");
  };

  const onHoldCount = activeVendors.filter(v => v.status === "On Hold").length;
  const pendingCount = activeVendors.filter(v => v.status === "Pending").length;

  const stats = [
    { label: "Total Vendors",     filterKey: "All",        value: activeVendors.length,       color: "text-gray-900",   icon: <Building2    className="text-gray-400"   /> },
    { label: "Active Vendors",    filterKey: "Active",     value: activeCount,                color: "text-green-600",  icon: <Users        className="text-green-400"  /> },
    { label: "On Hold",           filterKey: "On Hold",    value: onHoldCount,                color: "text-orange-600", icon: <PauseCircle  className="text-orange-400" /> },
    { label: "Pending",           filterKey: "Pending",    value: pendingCount,               color: "text-blue-600",   icon: <Clock        className="text-blue-400"   /> },
    { label: "Compliance Issues", filterKey: "Compliance", value: complianceIssues,           color: "text-red-600",    icon: <AlertTriangle className="text-red-400"   /> },
    { label: "Total Spend",       filterKey: "HasSpend",   value: formatCrores(totalSpend),   color: "text-purple-700", icon: <IndianRupee  className="text-purple-400" /> },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div className="bg-transparent border-b border-gray-200/70">
        <div className="w-full px-2 py-3 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Vendors / Vendor List</p>
            <h1 className="text-2xl font-bold">Vendors</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/vendors/onboarding')}>
                <Plus className="h-4 w-4 mr-2" /> Vendor Onboarding
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={exportVendors}>
                <Download className="h-4 w-4 mr-2" /> Export Vendors
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowArchived(true)}>
                <Archive className="h-4 w-4 mr-2" /> Archived Vendors
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="w-full px-2 py-2">
        {/* Stats tiles — each acts as a filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {stats.map(s => {
            const isActive = activeTileFilter === s.filterKey;
            return (
              <Card
                key={s.label}
                onClick={() => handleTileClick(s.filterKey)}
                className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-blue-500 shadow-md" : ""}`}
              >
                <CardContent className="p-2 flex justify-between items-start">
                  <div>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                  {s.icon}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Table Card */}
        <Card>
          <CardContent className="p-0">
            {/* Active filter indicator */}
            {activeTileFilter !== "All" && (
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-blue-50">
                <span className="text-xs text-blue-700 font-medium">Filtered: {activeTileFilter === "HasSpend" ? "Has Spend" : activeTileFilter === "Compliance" ? "Compliance Issues" : activeTileFilter}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{filteredVendors.length} of {activeVendors.length} vendors</span>
                <button onClick={() => { setActiveTileFilter("All"); setCurrentPage(1); }} className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium">Clear ✕</button>
              </div>
            )}

            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-600">
                  <th className="px-3 py-3 text-left">Vendor ID</th>
                  <th className="px-3 py-3 text-left">Vendor Name</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Primary Contact</th>
                  <th className="px-3 py-3 text-left">Rating</th>
                  <th className="px-3 py-3 text-left">Region</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">This Month</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedVendors.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-gray-400">
                      <Building2 className="w-8 h-8  mb-2 opacity-30" />
                      <p className="text-sm">No vendors match the current filters</p>
                    </td>
                  </tr>
                ) : pagedVendors.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td
                      className="px-3 py-3 text-blue-600 font-medium cursor-pointer hover:underline text-sm truncate"
                      onClick={() => navigate(`/vendors/${v.id}`)}
                    >
                      {v.id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">{v.name[0]}</div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 text-sm leading-tight truncate">{v.name}</p>
                          <p className="text-xs text-gray-400 leading-tight truncate">{v.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium truncate block max-w-full">{v.category}</span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-gray-700 font-medium leading-tight truncate">{v.primaryContact}</p>
                      <p className="text-xs text-gray-400 leading-tight truncate">{v.phone}</p>
                    </td>
                    <td className="px-3 py-3"><StarRating rating={v.rating} /></td>
                    <td className="px-3 py-3 text-sm text-gray-600 truncate">{v.region}</td>
                    <td className="px-3 py-3">
                      <Badge className={statusColors[v.status]}>{v.status}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-sm font-semibold ${v.monthSpend > 0 ? "text-gray-800" : "text-gray-300"}`}>{formatLakhs(v.monthSpend)}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <RowActionsMenu vendor={v} onEdit={() => navigate(`/vendors/${v.id}/edit`)} onArchive={() => requestArchiveVendor(v.id)} onSetStatus={s => setVendorStatus(v.id, s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-2 py-3 flex items-center justify-between text-sm text-gray-600 border-t">
              <span>
                {filteredVendors.length === 0 ? "0 vendors" : `${(safePage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(safePage * ITEMS_PER_PAGE, filteredVendors.length)} of ${filteredVendors.length} vendors`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >←</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded border text-xs font-medium transition-colors ${p === safePage ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50"}`}
                  >{p}</button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >→</button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Overview Popup */}
      {overviewVendor && <VendorOverviewPopup vendor={overviewVendor} onClose={() => setOverviewVendor(null)} />}

      {/* Archived Vendors Modal */}
      {showArchived && <ArchivedModal vendors={archivedVendors} onClose={() => setShowArchived(false)} onVendorClick={v => setArchivedOverview(v)} />}

      {/* Archived vendor overview popup */}
      {archivedOverview && <VendorOverviewPopup vendor={archivedOverview} onClose={() => setArchivedOverview(null)} />}

      {/* Archive confirmation popup */}
      {archiveConfirmVendor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={() => setArchiveConfirmVendor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-vendor-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                <Archive className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 id="archive-vendor-title" className="text-base font-semibold text-gray-900">
                  Archive vendor?
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Are you sure you want to archive <strong className="text-gray-700">{archiveConfirmVendor.name}</strong>?
                </p>
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-gray-500">
              This vendor will be removed from the active vendor list and moved to Archived Vendors.
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 rounded-b-2xl">
              <Button variant="outline" onClick={() => setArchiveConfirmVendor(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmArchiveVendor}>
                <Archive className="mr-2 h-4 w-4" /> Archive Vendor
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
