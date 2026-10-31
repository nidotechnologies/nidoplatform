import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { nanoid } from "nanoid";
import {
  saveCustomReport,
  generateReportId,
  getCustomReports,
  getBuiltinReportView,
  type ReportFormat,
  type ReportFrequency,
} from "@/lib/reportStore";
import { toast } from "@/hooks/use-toast";
import { useLiveReportRevision } from "@/hooks/useLiveReportRevision";
import {
  applyStoredReportFilters,
  getReportFieldValue,
  getReportRecords,
  type ReportRecord,
} from "@/lib/reportData";
import { loadApprovalBootstrap, type ApprovalRequest } from "@/lib/approvalEngine";
import { buildOrderReportRows, type OrderReportRow } from "@/lib/orderCsvExport";
import {
  getMasterOrderReportValue,
  isMasterOrderReport,
  normalizeReportColumns,
  readMasterReportOrders,
} from "@/lib/customReportOrderData";
import type { MyOrder } from "@/contexts/MyOrdersContext";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  X,
  BarChart2,
  Table2,
  TrendingUp,
  LayoutGrid,
  FileText,
  Wrench,
  Users,
  Building2,
  Package,
  ShoppingCart,
  Layers,
  HeadphonesIcon,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Calendar,
  Clock,
  Save,
  InboxIcon,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: "Summary Report",  desc: "Summarized data with key metrics",    icon: <BarChart2 className="w-4 h-4 text-blue-500" /> },
  { value: "Detailed Report", desc: "Detailed row-level data",             icon: <FileText className="w-4 h-4 text-indigo-500" /> },
  { value: "Tabular Report",  desc: "Display data in table format",        icon: <Table2 className="w-4 h-4 text-purple-500" /> },
  { value: "Pivot Report",    desc: "Analyze data in pivot table format",  icon: <LayoutGrid className="w-4 h-4 text-pink-500" /> },
  { value: "Trend Report",    desc: "Track data trends over time",         icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> },
  { value: "Custom Report",   desc: "Build a report from scratch",         icon: <Wrench className="w-4 h-4 text-orange-500" /> },
];

const MODULES = [
  { value: "All Modules",    desc: "Include data from all modules",       icon: <Layers className="w-4 h-4 text-blue-500" /> },
  { value: "Clients",        desc: "Client and related data",             icon: <Users className="w-4 h-4 text-emerald-500" /> },
  { value: "Users",          desc: "Internal platform users",             icon: <Users className="w-4 h-4 text-blue-500" /> },
  { value: "Vendors",        desc: "Vendor and related data",             icon: <Building2 className="w-4 h-4 text-purple-500" /> },
  { value: "Catalog",        desc: "All catalog data",                    icon: <Package className="w-4 h-4 text-orange-500" /> },
  { value: "Orders",         desc: "Order and related data",              icon: <ShoppingCart className="w-4 h-4 text-blue-600" /> },
  { value: "Services",       desc: "Services and requests data",          icon: <Wrench className="w-4 h-4 text-pink-500" /> },
  { value: "Support Tickets",desc: "Support tickets and resolutions",     icon: <HeadphonesIcon className="w-4 h-4 text-red-500" /> },
];

const FIELDS_BY_MODULE: Record<string, { group: string; fields: string[] }[]> = {
  "All Modules": [
    { group: "COMMON",  fields: ["ID", "Created On", "Created By"] },
    { group: "CLIENTS", fields: ["Client Name", "Contact Person", "Client Email", "Client Phone", "Client City", "Client Status"] },
    { group: "USERS",   fields: ["User Name", "User Email", "User Role", "User Department", "User Status"] },
    { group: "VENDORS", fields: ["Vendor Name", "Vendor Email", "Vendor Category"] },
    { group: "ORDERS",  fields: ["Order Date", "Order Status", "Amount"] },
    { group: "CATALOG", fields: ["Item Name", "SKU", "Category", "Price"] },
    { group: "SERVICES",fields: ["Service Name", "Request Date", "Status"] },
    { group: "SUPPORT", fields: ["Ticket ID", "Subject", "Priority"] },
  ],
  Clients: [
    { group: "CLIENTS", fields: ["ID", "Client Name", "Contact Person", "Client Email", "Client Phone", "Client City", "Client Status", "Client Tier", "Contract Start", "Contract End"] },
  ],
  Users: [
    { group: "USERS", fields: ["ID", "Created On", "User Name", "User Email", "User Role", "User Department", "User Status", "Job Title", "Date Joined", "Last Login"] },
  ],
  Vendors: [
    { group: "VENDORS", fields: ["ID", "Created On", "Created By", "Vendor Name", "Vendor Email", "Vendor Phone", "Vendor Category", "Vendor Status", "Rating"] },
  ],
  Catalog: [
    { group: "CATALOG", fields: ["ID", "Item Name", "SKU", "Category", "Price"] },
  ],
  Orders: [
    {
      group: "ORDER DETAILS",
      fields: [
        "Master Order ID", "Sub Order ID", "Order ID", "PO Reference",
        "Created By", "Created On", "Order Date", "Order Time",
      ],
    },
    {
      group: "CLIENT & ASSIGNMENT",
      fields: [
        "Client", "Client Name", "Client ID", "Requester", "Requester Role",
        "Ordered For", "Assigned To", "Assigned Role",
      ],
    },
    {
      group: "STATUS, APPROVAL & SLA",
      fields: [
        "Order Status", "Approval Status", "Approval Workflow",
        "Approval Requested By", "Approval Date", "Approved By", "Updated By",
        "Last Updated By", "Last Updated At", "Updated At", "Update Count",
        "SLA Time", "SLA Alert",
      ],
    },
    {
      group: "PAYMENT & DELIVERY",
      fields: [
        "Amount", "Tax", "Total", "Payment Method", "Payment Terms",
        "Delivery Attention", "Delivery Address", "City", "State", "Country",
        "ZIP Code", "Delivery Phone", "Delivery Notes", "Order Notes", "Cancel Reason",
      ],
    },
    {
      group: "ITEMS & FULFILLMENT",
      fields: [
        "Item Name", "SKU / Product Code", "Category", "Quantity", "Unit Price",
        "Line Amount", "Item Status", "Reference Number", "Serial Number",
        "Tracking Number", "Tracking Carrier", "Tracking Note", "Selected Vendor",
      ],
    },
    {
      group: "VENDOR PURCHASE ORDERS",
      fields: ["Vendor PO Numbers", "PO Created At", "Vendor PO Statuses", "Last Comment"],
    },
  ],
  Services: [
    { group: "SERVICES", fields: ["ID", "Service Name", "Request Date", "Client Name", "Status", "Priority", "Assigned To"] },
  ],
  "Support Tickets": [
    { group: "SUPPORT", fields: ["ID", "Created On", "Ticket ID", "Subject", "Client Name", "Priority", "Status", "Agent"] },
  ],
};

const TIMEZONES = ["(IST) Asia/Kolkata", "(UTC) Universal", "(EST) America/New_York", "(PST) America/Los_Angeles", "(GMT) Europe/London", "(CST) Asia/Shanghai"];

const FREQUENCIES: { value: ReportFrequency; desc: string; icon: React.ReactNode }[] = [
  { value: "One Time",  desc: "Run once on selected date",   icon: <CalendarCheck className="w-4 h-4 text-blue-500" /> },
  { value: "Daily",     desc: "Run report every day",        icon: <CalendarDays className="w-4 h-4 text-indigo-500" /> },
  { value: "Weekly",    desc: "Run report every week",       icon: <CalendarRange className="w-4 h-4 text-purple-500" /> },
  { value: "Monthly",   desc: "Run report every month",      icon: <Calendar className="w-4 h-4 text-pink-500" /> },
  { value: "Quarterly", desc: "Run report every quarter",    icon: <Clock className="w-4 h-4 text-orange-500" /> },
];

const FORMATS: { value: ReportFormat; label: string }[] = [
  { value: "Excel", label: "Excel (.xlsx)" },
  { value: "CSV",   label: "CSV (.csv)"   },
  { value: "PDF",   label: "PDF (.pdf)"   },
];

const FILTER_OPERATORS = ["equals", "not equals", "contains", "greater than", "less than", "is empty", "is not empty"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function toFormTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return "09:00";
  let hours = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    hours %= 12;
    if (meridiem === "PM") hours += 12;
  }
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function SectionBadge({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-600" : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ── Reusable rich dropdown ─────────────────────────────────────────────────────

function RichDropdown<T extends string>({
  value, placeholder, options, onChange, className = "",
}: {
  value: T | "";
  placeholder: string;
  options: { value: T; desc?: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
        <span className={selected ? "flex items-center gap-2 text-gray-900" : "text-gray-400"}>
          {selected ? (
            <>{selected.icon}<span className="font-medium">{selected.value}</span></>
          ) : placeholder}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 max-h-72 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors ${value === opt.value ? "bg-blue-50" : ""}`}>
              <span className="mt-0.5 shrink-0">{opt.icon}</span>
              <span>
                <span className={`block text-sm font-medium ${value === opt.value ? "text-blue-700" : "text-gray-800"}`}>{opt.value}</span>
                {opt.desc && <span className="block text-xs text-gray-400 mt-0.5">{opt.desc}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simple dropdown (no icons, e.g. timezone) ─────────────────────────────────

function SimpleDropdown({
  value, options, onChange, className = "",
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
        <span className="text-gray-900">{value}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 max-h-56 overflow-y-auto">
          {options.map(opt => (
            <button key={opt} type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 ${value === opt ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-800"}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Format dropdown ────────────────────────────────────────────────────────────

function FormatDropdown({ value, onChange }: { value: ReportFormat; onChange: (v: ReportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = FORMATS.find(f => f.value === value)?.label ?? "Excel (.xlsx)";

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
        <span className="text-gray-900">{label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
          {FORMATS.map(f => (
            <button key={f.value} type="button"
              onClick={() => { onChange(f.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 ${value === f.value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-800"}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Select Columns dropdown panel ─────────────────────────────────────────────

function SelectColumnsPanel({
  module,
  selectedColumns,
  onToggle,
  onToggleAll,
}: {
  module: string;
  selectedColumns: string[];
  onToggle: (f: string) => void;
  onToggleAll: (fields: string[], allChecked: boolean) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [colSearch, setColSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const activeModule = module || "All Modules";
  const fieldGroups  = FIELDS_BY_MODULE[activeModule] ?? FIELDS_BY_MODULE["All Modules"];
  const allFields    = fieldGroups.flatMap(g => g.fields);

  const visibleGroups = fieldGroups.map(g => ({
    ...g,
    fields: g.fields.filter(f => !colSearch || f.toLowerCase().includes(colSearch.toLowerCase())),
  })).filter(g => g.fields.length > 0);

  const allVisible  = visibleGroups.flatMap(g => g.fields);
  const allChecked  = allVisible.length > 0 && allVisible.every(f => selectedColumns.includes(f));
  const someChecked = allVisible.some(f => selectedColumns.includes(f));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-sm font-medium text-gray-700">Selected Columns</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">Drag to reorder columns</p>

      <div ref={ref} className="relative">
        {/* Trigger button */}
        <button type="button" onClick={() => setOpen(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
          <span className="text-gray-400">
            {selectedColumns.length > 0 ? (
              <span className="text-gray-800 font-medium">{selectedColumns.length} column{selectedColumns.length !== 1 ? "s" : ""} selected</span>
            ) : "Select columns"}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col max-h-72">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={colSearch} onChange={e => setColSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="flex-1 text-xs outline-none bg-transparent placeholder:text-gray-400" />
              </div>
            </div>

            {/* Select All */}
            <label className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={() => onToggleAll(allVisible, allChecked)}
                className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5" />
              <span className="text-xs font-medium text-gray-700">Select All</span>
            </label>

            {/* Groups */}
            <div className="overflow-y-auto flex-1">
              {visibleGroups.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">No columns match</div>
              ) : visibleGroups.map(g => (
                <div key={g.group}>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                    {g.group}
                  </div>
                  {g.fields.map(f => (
                    <label key={f} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={selectedColumns.includes(f)} onChange={() => onToggle(f)}
                        className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5" />
                      <span className="text-xs text-gray-700">{f}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected tags (below dropdown) */}
      {selectedColumns.length > 0 && !open && (
        <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
          {selectedColumns.map(c => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-200">
              {c}
              <button type="button" onClick={() => onToggle(c)} className="hover:text-blue-900 transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Empty state when nothing selected and dropdown closed */}
      {selectedColumns.length === 0 && !open && (
        <div className="mt-2 border border-dashed border-gray-200 rounded-lg min-h-[130px] flex flex-col items-center justify-center text-center p-4">
          <InboxIcon className="w-8 h-8 text-gray-300 mb-2" />
          <p className="text-xs font-medium text-gray-400">No columns selected</p>
          <p className="text-xs text-gray-300 mt-0.5">Add columns from the left panel</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CreateReportPage() {
  const reportRevision = useLiveReportRevision();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get("edit");
  const cloningId = searchParams.get("clone");
  const isEditing = Boolean(editingId);
  const isCloning = Boolean(cloningId);
  usePageMeta({ title: isEditing ? "Edit Report" : isCloning ? "Customize Report" : "Create Report" });
  const navigate = useNavigate();

  // Form state
  const [reportName,       setReportName]       = useState("");
  const [description,      setDescription]      = useState("");
  const [reportType,       setReportType]        = useState<string>("");
  const [module,           setModule]            = useState<string>("");
  const [fieldTab,         setFieldTab]          = useState<"all" | "selected">("all");
  const [fieldSearch,      setFieldSearch]       = useState("");
  const [selectedColumns,  setSelectedColumns]   = useState<string[]>([]);
  const [filters,          setFilters]           = useState<{ id: string; field: string; operator: string; value: string }[]>([]);
  const [frequency,        setFrequency]         = useState<ReportFrequency>("One Time");
  const [startDate,        setStartDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [time,             setTime]              = useState("09:00");
  const [timezone,         setTimezone]          = useState("(IST) Asia/Kolkata");
  const [deliveryEmail,    setDeliveryEmail]     = useState(true);
  const [deliveryDownload, setDeliveryDownload]  = useState(false);
  const [emailRecipients,  setEmailRecipients]   = useState("");
  const [format,           setFormat]            = useState<ReportFormat>("Excel");
  const [includeCharts,    setIncludeCharts]     = useState(true);
  const [includeSummary,   setIncludeSummary]    = useState(true);
  const [masterOrders, setMasterOrders] = useState<MyOrder[]>(() => readMasterReportOrders());
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    if (editingId) {
      const existing = getCustomReports().find((report) => report.id === editingId);
      if (!existing) {
        toast({ title: "Report not found", description: "This report may have been deleted.", variant: "destructive" });
        navigate("/reports");
        return;
      }
      setReportName(existing.name);
      setDescription(existing.description);
      setReportType(existing.reportType);
      setModule(existing.module);
      setSelectedColumns(normalizeReportColumns(existing.module, existing.selectedColumns));
      setFilters(existing.filters);
      setFrequency(existing.frequency);
      setStartDate(existing.startDate);
      setTime(toFormTime(existing.time));
      setTimezone(existing.timeZone);
      setDeliveryEmail(existing.deliveryEmail);
      setDeliveryDownload(existing.deliveryDownload);
      setEmailRecipients(existing.emailRecipients);
      setFormat(existing.format);
      setIncludeCharts(existing.includeCharts);
      setIncludeSummary(existing.includeSummary);
      return;
    }

    if (cloningId) {
      const source = getBuiltinReportView(cloningId);
      if (!source) {
        toast({ title: "Built-in report not found", variant: "destructive" });
        navigate("/reports");
        return;
      }
      setReportName(`${source.name} (Custom)`);
      setDescription(source.description);
      setReportType("Detailed Report");
      setModule(source.module);
      setSelectedColumns(normalizeReportColumns(source.module, source.selectedColumns));
      setFilters([]);
      setFrequency("Daily");
      setStartDate(new Date().toISOString().slice(0, 10));
      setTime("08:00");
      setTimezone("(IST) Asia/Kolkata");
      setDeliveryEmail(false);
      setDeliveryDownload(false);
      setEmailRecipients("");
      setFormat(source.format);
      setIncludeCharts(true);
      setIncludeSummary(true);
    }
  }, [editingId, cloningId, navigate]);

  // Derived field list
  const activeModule  = module || "All Modules";
  const fieldGroups   = FIELDS_BY_MODULE[activeModule] ?? FIELDS_BY_MODULE["All Modules"];
  const allFields     = fieldGroups.flatMap(g => g.fields);
  const reportColumns = normalizeReportColumns(activeModule, selectedColumns);
  const usesMasterOrderRows = isMasterOrderReport(activeModule, reportColumns);

  useEffect(() => {
    if (
      reportColumns.length !== selectedColumns.length
      || reportColumns.some((column, index) => column !== selectedColumns[index])
    ) {
      setSelectedColumns(reportColumns);
    }
  }, [activeModule, reportColumns, selectedColumns]);

  useEffect(() => {
    if (!usesMasterOrderRows) return;
    let active = true;
    setMasterOrders(readMasterReportOrders());
    loadApprovalBootstrap()
      .then((bootstrap) => {
        if (active) setApprovalRequests(bootstrap.requests);
      })
      .catch(() => {
        if (active) setApprovalRequests([]);
      });
    return () => { active = false; };
  }, [usesMasterOrderRows, reportRevision]);

  const livePreview = useMemo(() => {
    void reportRevision;
    if (!reportColumns.length) return { rows: [] as string[][], count: 0 };

    if (usesMasterOrderRows) {
      const filtered = buildOrderReportRows(masterOrders, { approvalRequests }).filter((row) => {
        const filterRecord = { ...row.order, ...row.fields, __module: "Orders" } as ReportRecord;
        return applyStoredReportFilters([filterRecord], filters).length > 0;
      });
      return {
        count: filtered.length,
        rows: filtered.slice(0, 8).map((row) =>
          reportColumns.map((column) => getMasterOrderReportValue(row, column))
        ),
      };
    }

    const filtered = applyStoredReportFilters(getReportRecords(activeModule), filters);
    return {
      count: filtered.length,
      rows: filtered.slice(0, 8).map((record) =>
        reportColumns.map((column) => getReportFieldValue(record, column))
      ),
    };
  }, [
    activeModule,
    approvalRequests,
    filters,
    masterOrders,
    reportRevision,
    reportColumns,
    usesMasterOrderRows,
  ]);

  const visibleGroups = fieldGroups.map(g => ({
    ...g,
    fields: g.fields.filter(f =>
      fieldTab === "selected"
        ? selectedColumns.includes(f)
        : !fieldSearch || f.toLowerCase().includes(fieldSearch.toLowerCase())
    ),
  })).filter(g => g.fields.length > 0);

  const toggleField = (f: string) => setSelectedColumns(p => p.includes(f) ? p.filter(c => c !== f) : [...p, f]);

  const moveToSelected = () => {
    const checked = allFields.filter(f => {
      const el = document.getElementById(`field-${f}`) as HTMLInputElement | null;
      return el?.checked && !selectedColumns.includes(f);
    });
    if (checked.length) setSelectedColumns(p => [...p, ...checked]);
  };

  const moveFromSelected = () => {
    const checked = selectedColumns.filter(f => {
      const el = document.getElementById(`selcol-${f}`) as HTMLInputElement | null;
      return el?.checked;
    });
    if (checked.length) setSelectedColumns(p => p.filter(c => !checked.includes(c)));
  };

  const handleToggleAll = (fields: string[], allChecked: boolean) => {
    if (allChecked) setSelectedColumns(p => p.filter(c => !fields.includes(c)));
    else            setSelectedColumns(p => [...new Set([...p, ...fields])]);
  };

  // Filters
  const addFilter    = () => setFilters(p => [...p, { id: nanoid(), field: "", operator: "equals", value: "" }]);
  const removeFilter = (id: string) => setFilters(p => p.filter(f => f.id !== id));
  const updateFilter = (id: string, key: "field" | "operator" | "value", val: string) =>
    setFilters(p => p.map(f => f.id === id ? { ...f, [key]: val } : f));

  // Save
  const handleSave = () => {
    if (!reportName.trim()) { toast({ title: "Report name is required", variant: "destructive" }); return; }
    if (!reportType)        { toast({ title: "Report type is required",  variant: "destructive" }); return; }
    const existing = editingId
      ? getCustomReports().find((report) => report.id === editingId)
      : undefined;
    if (editingId && !existing) {
      toast({ title: "Report not found", description: "This report may have been deleted.", variant: "destructive" });
      navigate("/reports");
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const reportId = existing?.id ?? generateReportId();
    saveCustomReport({
      ...existing,
      id: reportId,
      name: reportName.trim(),
      description: description.trim(),
      reportType,
      module: activeModule,
      selectedColumns: reportColumns,
      filters,
      frequency,
      startDate,
      time: new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      timeZone: timezone,
      deliveryEmail,
      deliveryDownload,
      emailRecipients,
      format,
      includeCharts,
      includeSummary,
      createdBy: existing?.createdBy ?? "Current User",
      createdAt: existing?.createdAt ?? `${dateStr} ${timeStr}`,
      lastRunDate: existing?.lastRunDate,
      lastRunStatus: existing?.lastRunStatus,
    });
    toast({
      title: existing ? "Report updated" : isCloning ? "Custom report created" : "Report saved!",
      description: existing
        ? `"${reportName.trim()}" has been updated.`
        : `"${reportName.trim()}" has been added to your reports.`,
    });
    navigate(`/reports/custom/${encodeURIComponent(reportId)}`);
  };

  return (
    <div className="space-y-5 pb-10">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? "Edit Report" : isCloning ? "Customize Report" : "Create New Report"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing ? "Update this report’s settings and save your changes." : "Build a custom report to view and analyze your business data."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(editingId ? `/reports/custom/${encodeURIComponent(editingId)}` : "/reports")}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            {isEditing ? "Save Changes" : isCloning ? "Create Custom Copy" : "Save & Next"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Report Details ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <SectionBadge n={1} />
          <h2 className="text-base font-semibold text-gray-900">Report Details</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Report Name + Report Type */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Report Name <span className="text-red-500">*</span>
              </label>
              <input value={reportName} onChange={e => setReportName(e.target.value)}
                placeholder="Enter report name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Report Type <span className="text-red-500">*</span>
              </label>
              <RichDropdown<string>
                value={reportType}
                placeholder="Select report type"
                options={REPORT_TYPES.map(r => ({ value: r.value, desc: r.desc, icon: r.icon }))}
                onChange={v => setReportType(v)}
              />
            </div>
          </div>
          {/* Right: Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal text-xs">(Optional)</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Enter report description" rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 resize-none" />
          </div>
        </div>
      </div>

      {/* ── Sections 2 / 3 / 4 row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4 items-start">

        {/* ── Section 2: Data Source (3/5) ─────────────────────────────────── */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <SectionBadge n={2} />
            <h2 className="text-base font-semibold text-gray-900">Data Source</h2>
          </div>
          <p className="text-xs text-gray-400 ml-8 mb-4">Select the module and fields for your report.</p>

          {/* Module dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Module / Data Source <span className="text-red-500">*</span>
            </label>
            <RichDropdown<string>
              value={module}
              placeholder="Select module"
              options={MODULES.map(m => ({ value: m.value, desc: m.desc, icon: m.icon }))}
              onChange={v => { setModule(v); setSelectedColumns([]); setFieldSearch(""); }}
            />
          </div>

          {/* Fields + arrows + Select Columns */}
          <div className="flex gap-2 items-start">

            {/* Left: field list */}
            <div className="w-[250px] shrink-0 border border-gray-200 rounded-lg overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button onClick={() => setFieldTab("all")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${fieldTab === "all" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30" : "text-gray-500 hover:text-gray-700"}`}>
                  All Fields
                </button>
                <button onClick={() => setFieldTab("selected")}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${fieldTab === "selected" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30" : "text-gray-500 hover:text-gray-700"}`}>
                  Selected Fields ({selectedColumns.length})
                </button>
              </div>
              {/* Search */}
              <div className="px-2 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2 py-1.5 bg-white">
                  <input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="flex-1 text-xs outline-none placeholder:text-gray-400 min-w-0" />
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </div>
              </div>
              {/* Field rows */}
              <div className="max-h-52 overflow-y-auto">
                {visibleGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">No fields found</div>
                ) : visibleGroups.map(g => (
                  <div key={g.group}>
                    {fieldGroups.length > 1 && (
                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                        {g.group}
                      </div>
                    )}
                    {g.fields.map(f => (
                      <label key={f} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input id={`field-${f}`} type="checkbox"
                          checked={selectedColumns.includes(f)} onChange={() => toggleField(f)}
                          className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5" />
                        <span className="text-xs text-gray-700">{f}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow buttons */}
            <div className="flex flex-col gap-2 pt-14 shrink-0">
              <button type="button" onClick={moveToSelected} title="Add to columns"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition-colors">
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>
              <button type="button" onClick={moveFromSelected} title="Remove from columns"
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Right: Select Columns dropdown */}
            <SelectColumnsPanel
              module={module}
              selectedColumns={selectedColumns}
              onToggle={toggleField}
              onToggleAll={handleToggleAll}
            />
          </div>
        </div>

        {/* Right column: Section 3 + Section 4 stacked */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* ── Section 3: Filters ───────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2">
                <SectionBadge n={3} />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Filters <span className="text-sm font-normal text-gray-400">(Optional)</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Add filters to narrow down your report data.</p>
                </div>
              </div>
              <button type="button" onClick={addFilter}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add Filter
              </button>
            </div>
            {filters.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">
                No filters added. Click "+ Add Filter" to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <select value={f.field} onChange={e => updateFilter(f.id, "field", e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0">
                      <option value="">Select field</option>
                      {allFields.map(field => <option key={field} value={field}>{field}</option>)}
                    </select>
                    <select value={f.operator} onChange={e => updateFilter(f.id, "operator", e.target.value)}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0">
                      {FILTER_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input value={f.value} onChange={e => updateFilter(f.id, "value", e.target.value)}
                      placeholder="Value"
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0" />
                    <button onClick={() => removeFilter(f.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Section 4: Schedule & Delivery ───────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <SectionBadge n={4} />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Schedule &amp; Delivery</h2>
                <p className="text-xs text-gray-400 mt-0.5">Set how often and where the report should be delivered.</p>
              </div>
            </div>

            {/* Frequency / Start Date / Time */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <RichDropdown
                  value={frequency}
                  placeholder="Frequency"
                  options={FREQUENCIES.map(f => ({ value: f.value, desc: f.desc, icon: f.icon }))}
                  onChange={v => setFrequency(v)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <div className="relative">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                <div className="relative">
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Time Zone</label>
              <SimpleDropdown value={timezone} options={TIMEZONES} onChange={setTimezone} />
            </div>

            {/* Delivery Method */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Delivery Method</label>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={deliveryEmail} onChange={e => setDeliveryEmail(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5" />
                  <span className="text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={deliveryDownload} onChange={e => setDeliveryDownload(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5" />
                  <span className="text-sm text-gray-700">Download</span>
                </label>
              </div>
            </div>

            {/* Email Recipients */}
            {deliveryEmail && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email Recipients</label>
                <input value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)}
                  placeholder="Enter email addresses separated by comma"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400" />
                <p className="text-xs text-gray-400 mt-1">e.g., admin@nido-tech.com, manager@nido-tech.com</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Output & Format ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left label */}
          <div className="flex items-center gap-2">
            <SectionBadge n={5} />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Output &amp; Format</h2>
              <p className="text-xs text-gray-400">Choose the format in which the report will be generated.</p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Format</span>
              <div className="w-40">
                <FormatDropdown value={format} onChange={setFormat} />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Include Charts</span>
              <Toggle checked={includeCharts} onChange={setIncludeCharts} />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Include Summary</span>
              <Toggle checked={includeSummary} onChange={setIncludeSummary} />
            </div>
            <button type="button" onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors ml-2">
              <Save className="w-4 h-4" /> {isEditing ? "Save Changes" : isCloning ? "Create Custom Copy" : "Save Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Live data preview ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Live Data Preview</h2>
            <p className="text-xs text-gray-500 mt-1">
              Values come from the selected platform module and update when its records change.
              The same fields and filters are used when this report is opened or exported.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {livePreview.count} {livePreview.count === 1 ? "record" : "records"}
          </span>
        </div>

        {reportColumns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            Select one or more columns to preview live report data.
          </div>
        ) : livePreview.count === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No live records match this module and its current filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {reportColumns.map((column) => (
                      <th key={column} className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-600">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {livePreview.rows.map((row, rowIndex) => (
                    <tr key={`preview-${rowIndex}`} className="hover:bg-gray-50/70">
                      {row.map((value, columnIndex) => (
                        <td key={`${rowIndex}-${columnIndex}`} className="max-w-[280px] truncate whitespace-nowrap px-3 py-2.5 text-gray-700">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {livePreview.count > livePreview.rows.length && (
              <p className="mt-2 text-right text-xs text-gray-400">
                Showing the first {livePreview.rows.length} of {livePreview.count} matching records.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
