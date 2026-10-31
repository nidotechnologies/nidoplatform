import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePageMeta } from "@/contexts/PageMetaContext";
import {
  getBuiltinReportView,
  getBuiltinReportSchedule,
  getCustomReports,
  saveBuiltinReportSchedule,
  saveCustomReport,
  type BuiltinReportSchedule,
  type BuiltinReportView,
  type CustomReport,
  type ReportFormat,
  type ReportFrequency,
} from "@/lib/reportStore";
import { getOrders, type StoredSalesOrder } from "@/lib/salesOrderStore";
import type { MyOrder } from "@/contexts/MyOrdersContext";
import { loadApprovalBootstrap, type ApprovalRequest } from "@/lib/approvalEngine";
import { buildOrderReportRows } from "@/lib/orderCsvExport";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getMasterOrderReportValue,
  isMasterOrderReport as hasMasterOrderColumns,
  normalizeReportColumns,
  readMasterReportOrders,
} from "@/lib/customReportOrderData";
import { useI18n } from "@/i18n/I18nProvider";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Download, Calendar, Pencil, ChevronLeft, ChevronRight,
  FileSpreadsheet, FileText, Users, ShoppingCart, Building2,
  Package, HeadphonesIcon, Settings2, CheckCircle2, XCircle,
  Clock, BarChart3, ChevronDown, Filter, Eye, MoreVertical, Copy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLiveReportRevision } from "@/hooks/useLiveReportRevision";
import {
  applyStoredReportFilters,
  getReportFieldValue,
  getReportRecordDate,
  getReportRecords,
  type ReportRecord,
} from "@/lib/reportData";

function dateKey(value: string): string {
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrderValue(order: StoredSalesOrder, column: string): string {
  switch (column) {
    case "ID":
    case "Order ID":
      return order.orderNumber || order.id;
    case "Created On":
    case "Created At":
      return formatDate(order.createdAt);
    case "Order Date":
      return formatDate(order.orderDate);
    case "Created By":
      return order.createdBy || "—";
    case "Client Name":
      return order.clientName || "—";
    case "Vendor Name":
      return "—";
    case "Order Status":
    case "Current Order Status":
    case "Status":
      return order.status;
    case "Amount":
      return formatCurrency(order.subtotal);
    case "Tax":
      return formatCurrency(order.totalTax);
    case "Total":
    case "Order Total":
      return formatCurrency(order.grandTotal);
    default:
      return "—";
  }
}

function getMyOrderTotal(order: MyOrder): number {
  const total = Number(order.totalAmountNum);
  if (Number.isFinite(total)) return total;
  const parsed = Number(String(order.totalAmount || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

const REPORT_FREQUENCIES: ReportFrequency[] = ["One Time", "Daily", "Weekly", "Monthly", "Quarterly"];

function toTimeInputValue(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return "08:00";
  let hours = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    hours %= 12;
    if (meridiem === "PM") hours += 12;
  }
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function toStoredTime(value: string): string {
  const [hoursRaw, minutes] = value.split(":");
  const hours = Number(hoursRaw);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minutes} ${suffix}`;
}

// ── Module KPI configs ─────────────────────────────────────────────────────────

interface KpiConfig {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  valColor?: string;
}

function getKpis(module: string, orders: Array<{ status: string; grandTotal: number }> = []): KpiConfig[] {
  switch (module) {
    case "Orders": {
      const completed = orders.filter((order) => ["Completed", "Delivered"].includes(order.status)).length;
      const pending = orders.filter((order) =>
        ["Draft", "Confirmed", "Processing", "Pending Shipping", "Partially Shipped", "Shipped", "Partially Delivered"].includes(order.status)
      ).length;
      const cancelled = orders.filter((order) => order.status === "Cancelled").length;
      const totalValue = orders.reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0);
      return [
        { label: "Total Orders", value: orders.length.toLocaleString(), icon: <ShoppingCart className="w-5 h-5 text-blue-500" />, iconBg: "bg-blue-50" },
        { label: "Total Order Value", value: formatCurrency(totalValue, undefined, { compact: true }), icon: <BarChart3 className="w-5 h-5 text-green-500" />, iconBg: "bg-green-50" },
        { label: "Completed Orders", value: completed.toLocaleString(), icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Pending Orders", value: pending.toLocaleString(), icon: <Clock className="w-5 h-5 text-amber-500" />, iconBg: "bg-amber-50", valColor: "text-amber-600" },
        { label: "Cancelled Orders", value: cancelled.toLocaleString(), icon: <XCircle className="w-5 h-5 text-red-400" />, iconBg: "bg-red-50", valColor: "text-red-500" },
      ];
    }
    case "Clients":
      return [
        { label: "Total Clients",        value: "58",   icon: <Users className="w-5 h-5 text-blue-500" />,      iconBg: "bg-blue-50" },
        { label: "Completed Activities", value: "968",  icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Pending Activities",   value: "214",  icon: <Clock className="w-5 h-5 text-amber-500" />,       iconBg: "bg-amber-50",   valColor: "text-amber-600" },
        { label: "Cancelled Activities", value: "66",   icon: <XCircle className="w-5 h-5 text-red-400" />,       iconBg: "bg-red-50",     valColor: "text-red-500" },
        { label: "Total Activities",     value: "1,248",icon: <BarChart3 className="w-5 h-5 text-indigo-500" />,  iconBg: "bg-indigo-50",  valColor: "text-indigo-600" },
      ];
    case "Vendors":
      return [
        { label: "Total Vendors",    value: "142",  icon: <Building2 className="w-5 h-5 text-purple-500" />,  iconBg: "bg-purple-50" },
        { label: "Active Vendors",   value: "118",  icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Inactive Vendors", value: "24",   icon: <XCircle className="w-5 h-5 text-red-400" />,         iconBg: "bg-red-50",     valColor: "text-red-500" },
        { label: "Avg Rating",       value: "4.2",  icon: <BarChart3 className="w-5 h-5 text-amber-500" />,     iconBg: "bg-amber-50" },
        { label: "Total POs",        value: "3,124",icon: <ShoppingCart className="w-5 h-5 text-blue-500" />,   iconBg: "bg-blue-50" },
      ];
    case "Services":
      return [
        { label: "Total Requests",    value: "1,875", icon: <Settings2 className="w-5 h-5 text-cyan-500" />,    iconBg: "bg-cyan-50" },
        { label: "Completed",         value: "1,340", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Pending",           value: "412",   icon: <Clock className="w-5 h-5 text-amber-500" />,         iconBg: "bg-amber-50",   valColor: "text-amber-600" },
        { label: "Cancelled",         value: "123",   icon: <XCircle className="w-5 h-5 text-red-400" />,         iconBg: "bg-red-50",     valColor: "text-red-500" },
        { label: "Avg Resolution",    value: "2.4 days", icon: <BarChart3 className="w-5 h-5 text-blue-500" />,  iconBg: "bg-blue-50" },
      ];
    case "Support Tickets":
      return [
        { label: "Total Tickets",  value: "3,124",icon: <HeadphonesIcon className="w-5 h-5 text-rose-500" />,   iconBg: "bg-rose-50" },
        { label: "Resolved",       value: "2,580",icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,  iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Open",           value: "412",  icon: <Clock className="w-5 h-5 text-amber-500" />,            iconBg: "bg-amber-50",   valColor: "text-amber-600" },
        { label: "Critical",       value: "132",  icon: <XCircle className="w-5 h-5 text-red-400" />,            iconBg: "bg-red-50",     valColor: "text-red-500" },
        { label: "Avg Resolution", value: "1.8 days", icon: <BarChart3 className="w-5 h-5 text-blue-500" />,    iconBg: "bg-blue-50" },
      ];
    case "Catalog":
      return [
        { label: "Total Items",    value: "12,856", icon: <Package className="w-5 h-5 text-orange-500" />,      iconBg: "bg-orange-50" },
        { label: "Active Items",   value: "11,204", icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, iconBg: "bg-emerald-50", valColor: "text-emerald-600" },
        { label: "Low Stock",      value: "234",    icon: <Clock className="w-5 h-5 text-amber-500" />,           iconBg: "bg-amber-50",   valColor: "text-amber-600" },
        { label: "Out of Stock",   value: "68",     icon: <XCircle className="w-5 h-5 text-red-400" />,           iconBg: "bg-red-50",     valColor: "text-red-500" },
        { label: "Categories",     value: "48",     icon: <BarChart3 className="w-5 h-5 text-indigo-500" />,     iconBg: "bg-indigo-50" },
      ];
    default: // All Modules
      return [
        { label: "Total Records",  value: "1,248",  icon: <BarChart3 className="w-5 h-5 text-blue-500" />,       iconBg: "bg-blue-50" },
        { label: "Clients",        value: "58",     icon: <Users className="w-5 h-5 text-emerald-500" />,         iconBg: "bg-emerald-50" },
        { label: "Vendors",        value: "142",    icon: <Building2 className="w-5 h-5 text-purple-500" />,      iconBg: "bg-purple-50" },
        { label: "Orders",         value: "1,248",  icon: <ShoppingCart className="w-5 h-5 text-blue-600" />,    iconBg: "bg-blue-50" },
        { label: "Support Tickets",value: "3,124",  icon: <HeadphonesIcon className="w-5 h-5 text-rose-500" />,  iconBg: "bg-rose-50" },
      ];
  }
}

// ── Filter configs ─────────────────────────────────────────────────────────────

function getFilters(module: string, orders: Array<{ clientName: string; status: string }> = []) {
  const base = [
    {
      label: "Date Range",
      type: "daterange" as const,
      value: "Jul 01, 2026 – Jul 31, 2026",
    },
  ];
  switch (module) {
    case "Orders": {
      const clients = [...new Set(orders.map((order) => order.clientName).filter(Boolean))].sort();
      const statuses = [...new Set(orders.map((order) => order.status))].sort();
      return [
        ...base,
        { label: "Client", type: "select" as const, options: ["All Clients", ...clients], value: "All Clients" },
        { label: "Status", type: "select" as const, options: ["All Status", ...statuses], value: "All Status" },
      ];
    }
    case "Clients":
      return [
        ...base,
        { label: "Client", type: "select" as const, options: ["All Clients", ...getReportRecords("Clients").map((record) => String(record.name ?? "")).filter(Boolean)], value: "All Clients" },
        { label: "Activity Type", type: "select" as const, options: ["All Activities", "Orders", "Invoices", "Requests"], value: "All Activities" },
        { label: "Status", type: "select" as const, options: ["All Status", "Active", "Inactive"], value: "All Status" },
      ];
    case "Vendors":
      return [
        ...base,
        { label: "Vendor",   type: "select" as const, options: ["All Vendors",   ...getReportRecords("Vendors").map((record) => String(record.name ?? "")).filter(Boolean)], value: "All Vendors" },
        { label: "Category", type: "select" as const, options: ["All Categories","Electronics","Office Supplies","Furniture","Logistics"], value: "All Categories" },
        { label: "Status",   type: "select" as const, options: ["All Status", "Active", "Inactive"], value: "All Status" },
      ];
    default:
      return [
        ...base,
        { label: "Module", type: "select" as const, options: ["All Modules","Clients","Vendors","Orders","Services"], value: "All Modules" },
        { label: "Status", type: "select" as const, options: ["All Status","Active","Inactive","Completed","Pending"], value: "All Status" },
      ];
  }
}

function getLiveFilters(module: string, records: ReportRecord[]) {
  const unique = (values: unknown[]) =>
    [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))].sort();
  const statuses = unique(records.map((record) => record.status));
  const base = [{ label: "Date Range", type: "daterange" as const, value: "Select a date range" }];

  if (module === "Orders") {
    return [
      ...base,
      { label: "Client", type: "select" as const, options: ["All Clients", ...unique(records.map((record) => record.clientName ?? record.client))], value: "All Clients" },
      { label: "Status", type: "select" as const, options: ["All Status", ...statuses], value: "All Status" },
    ];
  }
  if (module === "Clients") {
    return [
      ...base,
      { label: "Client", type: "select" as const, options: ["All Clients", ...unique(records.map((record) => record.name))], value: "All Clients" },
      { label: "Status", type: "select" as const, options: ["All Status", ...statuses], value: "All Status" },
    ];
  }
  if (module === "Vendors") {
    return [
      ...base,
      { label: "Vendor", type: "select" as const, options: ["All Vendors", ...unique(records.map((record) => record.name))], value: "All Vendors" },
      { label: "Category", type: "select" as const, options: ["All Categories", ...unique(records.map((record) => record.category))], value: "All Categories" },
      { label: "Status", type: "select" as const, options: ["All Status", ...statuses], value: "All Status" },
    ];
  }
  return [
    ...base,
    ...(module === "All Modules" ? [{
      label: "Module",
      type: "select" as const,
      options: ["All Modules", ...unique(records.map((record) => record.__module))],
      value: "All Modules",
    }] : []),
    { label: "Status", type: "select" as const, options: ["All Status", ...statuses], value: "All Status" },
  ];
}

function getLiveKpis(records: ReportRecord[]): KpiConfig[] {
  const statusCounts = new Map<string, number>();
  records.forEach((record) => {
    const status = String(record.status ?? "").trim();
    if (status) statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  });
  const amountKeys = ["grandTotal", "totalAmount", "amount", "subtotal", "total"];
  const amountRecords = records.filter((record) => amountKeys.some((key) => record[key] !== undefined && record[key] !== null));
  const amountTotal = amountRecords.reduce((sum, record) => {
    const raw = amountKeys.map((key) => Number(record[key])).find(Number.isFinite);
    return sum + (raw ?? 0);
  }, 0);
  return [
    { label: "Total Records", value: records.length.toLocaleString(), icon: <BarChart3 className="w-5 h-5 text-blue-500" />, iconBg: "bg-blue-50" },
    ...[...statusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, value]) => ({
      label,
      value: value.toLocaleString(),
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      iconBg: "bg-emerald-50",
    })),
    ...(amountRecords.length ? [{
      label: "Total Amount",
      value: formatCurrency(amountTotal, undefined, { compact: true }),
      icon: <ShoppingCart className="w-5 h-5 text-green-500" />,
      iconBg: "bg-green-50",
    }] : []),
  ];
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Completed:  "bg-emerald-100 text-emerald-700",
    Active:     "bg-emerald-100 text-emerald-700",
    Resolved:   "bg-emerald-100 text-emerald-700",
    Pending:    "bg-amber-100 text-amber-700",
    Open:       "bg-amber-100 text-amber-700",
    Inactive:   "bg-gray-100 text-gray-600",
    Cancelled:  "bg-red-100 text-red-600",
    Critical:   "bg-red-100 text-red-600",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ReportScheduleDialog({ reportId, reportName, onClose, onSaved }: {
  reportId: string;
  reportName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const customReport = getCustomReports().find((item) => item.id === reportId);
  const savedBuiltin = getBuiltinReportSchedule(reportId);
  const [frequency, setFrequency] = useState<ReportFrequency>(
    customReport?.frequency ?? savedBuiltin?.frequency ?? "Daily"
  );
  const [time, setTime] = useState(toTimeInputValue(customReport?.time ?? savedBuiltin?.time ?? "08:00 AM"));
  const [timeZone, setTimeZone] = useState(customReport?.timeZone ?? savedBuiltin?.timeZone ?? "(IST) Asia/Kolkata");
  const [emailOn, setEmailOn] = useState(customReport?.deliveryEmail ?? savedBuiltin?.deliveryEmail ?? false);
  const [recipients, setRecipients] = useState(customReport?.emailRecipients ?? savedBuiltin?.emailRecipients ?? "");

  const handleSave = () => {
    const emails = recipients.split(",").map((email) => email.trim()).filter(Boolean);
    if (emailOn && (!emails.length || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
      toast({ title: "Enter valid recipient email addresses", variant: "destructive" });
      return;
    }
    const schedule: BuiltinReportSchedule = {
      frequency,
      time: toStoredTime(time),
      timeZone,
      deliveryEmail: emailOn,
      emailRecipients: emails.join(", "),
    };
    if (customReport) saveCustomReport({ ...customReport, ...schedule });
    else saveBuiltinReportSchedule(reportId, schedule);
    toast({ title: "Schedule updated", description: `Schedule saved for ${reportName}.` });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Schedule report</h2>
            <p className="mt-0.5 text-xs text-gray-500">{reportName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close schedule settings" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block text-xs font-medium text-gray-700">
            Frequency
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as ReportFrequency)} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              {REPORT_FREQUENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-700">
              Run time
              <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Time zone
              <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                {["(IST) Asia/Kolkata", "(UTC) Universal", "UTC", "EST (UTC-5)", "CST (UTC-6)", "MST (UTC-7)", "PST (UTC-8)", "(EST) America/New_York", "(PST) America/Los_Angeles", "(GMT) Europe/London"].map((zone) => <option key={zone}>{zone}</option>)}
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={emailOn} onChange={(event) => setEmailOn(event.target.checked)} />
              Email report
            </label>
            {emailOn && (
              <input value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="name@example.com, another@example.com" className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save Schedule</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLS = new Set([
  "Client Status","Vendor Status","Order Status","Current Order Status","Approval Status","Item Status","Status","Priority",
]);

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useI18n();
  const reportRevision = useLiveReportRevision();

  const report: CustomReport | BuiltinReportView | undefined = useMemo(
    () => {
      void reportRevision;
      return id ? getCustomReports().find((r) => r.id === id) ?? getBuiltinReportView(id) : undefined;
    },
    [id, reportRevision],
  );
  const liveReportRecords = useMemo(
    () => {
      void reportRevision;
      return report ? getReportRecords(report.module) : [];
    },
    [report, reportRevision],
  );

  usePageMeta({ title: report?.name ?? "Report Detail" });

  const [orders, setOrders] = useState<StoredSalesOrder[]>(() => getOrders());
  const [masterOrders, setMasterOrders] = useState<MyOrder[]>(() => readMasterReportOrders());
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [approvalLoadError, setApprovalLoadError] = useState("");
  const [masterDataRevision, setMasterDataRevision] = useState(0);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [appliedFilterValues, setAppliedFilterValues] = useState<Record<string, string>>({});
  const [draftDateRange, setDraftDateRange] = useState({ from: "", to: "" });
  const [appliedDateRange, setAppliedDateRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rowMenuOrderId, setRowMenuOrderId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 10;
  const isMasterOrderReport = Boolean(
    report
    && report.module === "Orders"
    && "reportType" in report
    && hasMasterOrderColumns(report.module, report.selectedColumns),
  );

  useEffect(() => {
    const refresh = () => setOrders(getOrders());
    window.addEventListener("nidoSalesOrdersUpdated", refresh);
    return () => window.removeEventListener("nidoSalesOrdersUpdated", refresh);
  }, []);

  useEffect(() => {
    if (!isMasterOrderReport) return;
    let disposed = false;
    const refreshOrders = () => setMasterOrders(readMasterReportOrders());
    const refreshRelatedData = () => setMasterDataRevision((revision) => revision + 1);
    const refreshApprovals = async () => {
      try {
        const bootstrap = await loadApprovalBootstrap();
        if (disposed) return;
        setApprovalRequests(Array.isArray(bootstrap.requests) ? bootstrap.requests : []);
        setApprovalLoadError("");
      } catch (error) {
        if (disposed) return;
        console.error("Unable to load approval data for the order report.", error);
        setApprovalRequests([]);
        setApprovalLoadError("Approval fields could not be loaded. Other order data is still available.");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "nido_my_orders") refreshOrders();
      if (!event.key || event.key === "nido_all_purchase_orders") refreshRelatedData();
      if (!event.key || event.key === "nido_local_approval_engine") void refreshApprovals();
    };
    const onOrderActivity = () => {
      refreshRelatedData();
      void refreshApprovals();
    };

    refreshOrders();
    void refreshApprovals();
    window.addEventListener("storage", onStorage);
    window.addEventListener("orderFulfillmentStatusUpdated", refreshOrders);
    window.addEventListener("orderSubItemsUpdated", refreshRelatedData);
    window.addEventListener("poCreated", refreshRelatedData);
    window.addEventListener("poActivityUpdated", refreshRelatedData);
    window.addEventListener("orderNotesUpdated", onOrderActivity);
    return () => {
      disposed = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("orderFulfillmentStatusUpdated", refreshOrders);
      window.removeEventListener("orderSubItemsUpdated", refreshRelatedData);
      window.removeEventListener("poCreated", refreshRelatedData);
      window.removeEventListener("poActivityUpdated", refreshRelatedData);
      window.removeEventListener("orderNotesUpdated", onOrderActivity);
    };
  }, [isMasterOrderReport]);

  const masterReportRows = useMemo(
    () => {
      // The row builder reads related PO, fulfillment, and activity data from
      // localStorage, so this revision invalidates the cached snapshot.
      void masterDataRevision;
      return isMasterOrderReport
        ? buildOrderReportRows(masterOrders, { approvalRequests })
        : [];
    },
    [isMasterOrderReport, masterOrders, approvalRequests, masterDataRevision],
  );

  useEffect(() => {
    if (!rowMenuOrderId) return;
    const closeOutside = (event: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
        setRowMenuOrderId(null);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [rowMenuOrderId]);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-700">Report Not Found</h2>
        <p className="text-sm text-gray-400">This report may have been deleted or the link is invalid.</p>
        <button
          onClick={() => navigate("/reports")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const columns = normalizeReportColumns(
    report.module,
    report.selectedColumns.length > 0 ? report.selectedColumns : ["ID", "Created On", "Status"],
  );
  const isOrderReport = report.module === "Orders";
  const savedFilters = "reportType" in report ? report.filters : [];
  const filterRecords = isMasterOrderReport
    ? masterOrders.map((order) => ({ ...order, clientName: order.client }) as ReportRecord)
    : isOrderReport ? orders as unknown as ReportRecord[] : liveReportRecords;
  const filterConfig = getLiveFilters(report.module, filterRecords);
  const filteredOrders = isOrderReport && !isMasterOrderReport
    ? orders.filter((order) => {
        const client = appliedFilterValues.Client;
        const status = appliedFilterValues.Status;
        const orderDate = dateKey(order.orderDate || order.createdAt);
        if (client && client !== "All Clients" && order.clientName !== client) return false;
        if (status && status !== "All Status" && order.status !== status) return false;
        if (appliedDateRange.from && (!orderDate || orderDate < appliedDateRange.from)) return false;
        if (appliedDateRange.to && (!orderDate || orderDate > appliedDateRange.to)) return false;
        return applyStoredReportFilters([order as unknown as ReportRecord], savedFilters).length > 0;
      })
    : [];
  const filteredMasterOrders = isMasterOrderReport
    ? masterOrders.filter((order) => {
        const client = appliedFilterValues.Client;
        const status = appliedFilterValues.Status;
        const orderDate = dateKey(order.orderDate || order.createdAt || "");
        if (client && client !== "All Clients" && order.client !== client) return false;
        if (status && status !== "All Status" && order.status !== status) return false;
        if (appliedDateRange.from && (!orderDate || orderDate < appliedDateRange.from)) return false;
        if (appliedDateRange.to && (!orderDate || orderDate > appliedDateRange.to)) return false;
        return true;
      })
    : [];
  const filteredMasterRows = isMasterOrderReport
    ? masterReportRows.filter((row) =>
        filteredMasterOrders.some((order) => order.id === row.order.id)
        && applyStoredReportFilters([{ ...row.order, ...row.fields } as ReportRecord], savedFilters).length > 0
      )
    : [];
  const filteredReportRecords = !isOrderReport
    ? applyStoredReportFilters(liveReportRecords, savedFilters).filter((record) => {
        const status = appliedFilterValues.Status;
        const client = appliedFilterValues.Client;
        const vendor = appliedFilterValues.Vendor;
        const category = appliedFilterValues.Category;
        const module = appliedFilterValues.Module;
        const recordStatus = String(record.status ?? "");
        const recordClient = String(record.clientName ?? record.client ?? (report.module === "Clients" ? record.name : ""));
        const recordVendor = String(record.vendorName ?? record.vendor ?? (report.module === "Vendors" ? record.name : ""));
        const recordCategory = String(record.category ?? "");
        const recordModule = String(record.__module ?? "");
        const recordDate = getReportRecordDate(record);
        if (status && status !== "All Status" && recordStatus !== status) return false;
        if (client && client !== "All Clients" && recordClient !== client) return false;
        if (vendor && vendor !== "All Vendors" && recordVendor !== vendor) return false;
        if (category && category !== "All Categories" && recordCategory !== category) return false;
        if (module && module !== "All Modules" && recordModule !== module) return false;
        if (appliedDateRange.from && (!recordDate || recordDate < appliedDateRange.from)) return false;
        if (appliedDateRange.to && (!recordDate || recordDate > appliedDateRange.to)) return false;
        return true;
      })
    : [];
  const totalRows = isMasterOrderReport
    ? filteredMasterRows.length
    : isOrderReport ? filteredOrders.length : filteredReportRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const startRow = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, totalRows);
  const pageOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageMasterRows = filteredMasterRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageReportRecords = filteredReportRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  type ReportTableRow = {
    index: number;
    rowKey: string;
    values: string[];
    order?: StoredSalesOrder;
    masterOrderId?: string;
    orderDisplayId?: string;
  };
  const rows: ReportTableRow[] = isMasterOrderReport
    ? pageMasterRows.map((row, index) => ({
        index: (page - 1) * PAGE_SIZE + index,
        rowKey: `master:${row.order.id}:${row.itemIndex}`,
        masterOrderId: row.order.id,
        orderDisplayId: row.order.id,
        values: columns.map((column) => getMasterOrderReportValue(row, column)),
      }))
    : isOrderReport
    ? pageOrders.map((order, index) => ({
        index: (page - 1) * PAGE_SIZE + index,
        rowKey: `sales:${order.id}`,
        order,
        orderDisplayId: order.orderNumber || order.id,
        values: columns.map((column) => getOrderValue(order, column)),
      }))
    : pageReportRecords.map((record, index) => ({
        index: (page - 1) * PAGE_SIZE + index,
        rowKey: `${String(record.__module ?? report.module)}:${String(record.id ?? record.number ?? index)}`,
        values: columns.map((column) => getReportFieldValue(record, column)),
      }));
  const kpiRecords: ReportRecord[] = isMasterOrderReport
    ? [...new Map(filteredMasterRows.map((row) => [row.order.id, row.order])).values()].map((order) => ({
        ...order,
        status: order.status,
        grandTotal: getMyOrderTotal(order),
      }))
    : isOrderReport ? filteredOrders as unknown as ReportRecord[] : filteredReportRecords;
  const kpis = getLiveKpis(kpiRecords);
  const genStr = `${formatDate(new Date())} ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  const exportRows = isMasterOrderReport
    ? filteredMasterRows.map((row) => columns.map((column) => getMasterOrderReportValue(row, column)))
    : isOrderReport
    ? filteredOrders.map((order) => columns.map((column) => getOrderValue(order, column)))
    : filteredReportRecords.map((record) => columns.map((column) => getReportFieldValue(record, column)));
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4));

  const handleApplyFilters = () => {
    if (draftDateRange.from && draftDateRange.to && draftDateRange.from > draftDateRange.to) {
      toast({ title: "Date range is invalid", description: "The start date must be on or before the end date.", variant: "destructive" });
      return;
    }
    setAppliedFilterValues(filterValues);
    setAppliedDateRange(draftDateRange);
    setPage(1);
    setRowMenuOrderId(null);
    toast({ title: "Filters applied" });
  };

  const handleExport = (format: ReportFormat) => {
    const filename = report.name.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "report";
    const safeRows = exportRows.map((row) => row.map((value) => String(value ?? "")));
    if (format === "CSV") {
      const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const csv = [columns, ...safeRows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
      const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } else if (format === "PDF") {
      const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
      doc.text(report.name, 14, 15);
      autoTable(doc, { head: [columns], body: safeRows, startY: 22, styles: { fontSize: 8 } });
      doc.save(`${filename}.pdf`);
    } else {
      const worksheet = XLSX.utils.aoa_to_sheet([columns, ...safeRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    }
    toast({ title: `${format} export started`, description: `${safeRows.length} filtered report rows exported.` });
  };

  const handleApplySchedule = () => setScheduleOpen(true);
  const handleEditReport = () => {
    const isCustom = "reportType" in report;
    navigate(isCustom
      ? `/reports/create?edit=${encodeURIComponent(report.id)}`
      : `/reports/create?clone=${encodeURIComponent(report.id)}`);
  };

  const sectionLabel = (() => {
    switch (report.module) {
      case "Orders":          return "Order Details";
      case "Clients":         return "Client Activity Details";
      case "Vendors":         return "Vendor Details";
      case "Services":        return "Service Request Details";
      case "Support Tickets": return "Support Ticket Details";
      case "Catalog":         return "Catalog Details";
      default:                return "Report Details";
    }
  })();

  const copyOrderNumber = async (orderNumber: string) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      toast({ title: "Order number copied", description: orderNumber });
    } catch {
      toast({ title: "Could not copy order number", variant: "destructive" });
    }
    setRowMenuOrderId(null);
  };

  return (
    <div className="space-y-5 pb-8">

      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <button onClick={() => navigate("/reports")} className="hover:text-blue-600 transition-colors">
          Reports
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => navigate("reportType" in report ? "/reports?module=custom" : "/reports")} className="hover:text-blue-600 transition-colors">
          {"reportType" in report ? "Custom Reports" : "All Reports"}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-800 font-medium truncate">{report.name}</span>
      </nav>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {report.description || `Summary of all ${report.module.toLowerCase()} data across the platform.`}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleExport(report.format)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={handleApplySchedule}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Calendar className="w-4 h-4" /> Schedule
          </button>
          <button
            onClick={handleEditReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Pencil className="w-4 h-4" /> {"reportType" in report ? "Edit Report" : "Customize Report"}
          </button>
        </div>
      </div>
      {scheduleOpen && (
        <ReportScheduleDialog
          reportId={report.id}
          reportName={report.name}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => setScheduleOpen(false)}
        />
      )}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          {filterConfig.map((f, fi) => (
            <div key={fi} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{f.label}</label>
              {f.type === "daterange" ? (
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Start date"
                    type="date"
                    value={draftDateRange.from}
                    onChange={(event) => setDraftDateRange((range) => ({ ...range, from: event.target.value }))}
                    className="min-w-[145px] rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-700"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    aria-label="End date"
                    type="date"
                    value={draftDateRange.to}
                    onChange={(event) => setDraftDateRange((range) => ({ ...range, to: event.target.value }))}
                    className="min-w-[145px] rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-700"
                  />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={filterValues[f.label] ?? f.value}
                    onChange={(e) => setFilterValues((p) => ({ ...p, [f.label]: e.target.value }))}
                    className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[130px]"
                  >
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-transparent select-none">apply</label>
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Filter className="w-3.5 h-3.5" /> Apply Filters
            </button>
          </div>
        </div>
      </div>

      {isMasterOrderReport && approvalLoadError && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {approvalLoadError}
        </p>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className={`grid gap-3 ${kpis.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {kpis.map((k, ki) => (
          <div key={ki} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${k.iconBg} flex items-center justify-center shrink-0`}>
              {k.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-tight">{k.label}</p>
              <p className={`text-xl font-bold leading-tight mt-0.5 ${k.valColor ?? "text-gray-900"}`}>{k.value}</p>
              {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Data Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table header row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{sectionLabel}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              Showing {startRow} to {endRow} of {totalRows.toLocaleString()} records
            </span>
            {/* Pagination controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => firstVisiblePage + i).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-medium transition-colors ${
                    pg === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {pg}
                </button>
              ))}
              {totalPages > 5 && <span className="text-xs text-gray-400 px-1">...</span>}
              {totalPages > 5 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-medium transition-colors ${
                    page === totalPages
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center text-sm text-gray-400">
                    No orders match the selected filters.
                  </td>
                </tr>
              )}
              {rows.map(({ index, rowKey, values, order, masterOrderId, orderDisplayId }) => (
                <tr
                  key={rowKey}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                >
                  {columns.map((col, ci) => {
                    const val = values[ci];
                    const isStatus = STATUS_COLS.has(col);
                    const isAmount = ["Amount", "Total", "Tax", "Price", "Order Total", "Unit Price", "Line Amount"].includes(col);
                    const isName = ["Client", "Client Name", "Vendor Name", "Selected Vendor"].includes(col);
                    return (
                      <td key={col} className="py-3 px-4 whitespace-nowrap">
                        {isStatus ? (
                          <StatusBadge status={val} />
                        ) : isName ? (
                          <span className="text-blue-600 font-medium text-sm">{val}</span>
                        ) : isAmount ? (
                          <span className="text-sm font-medium text-gray-800">{val}</span>
                        ) : (
                          <span className="text-sm text-gray-700">{val}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4">
                    {(order || masterOrderId) && (
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Actions for ${orderDisplayId || order?.id || masterOrderId}`}
                          onClick={() => setRowMenuOrderId((current) => current === rowKey ? null : rowKey)}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {rowMenuOrderId === rowKey && (
                          <div ref={rowMenuRef} className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-gray-100 bg-white py-1 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setRowMenuOrderId(null);
                                navigate(masterOrderId ? `/orders/${masterOrderId}` : `/sales/orders/${order?.id}`);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-3.5 w-3.5" /> View order
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyOrderNumber(orderDisplayId || order?.orderNumber || order?.id || masterOrderId || "")}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy order number
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Report generated on {genStr} &nbsp;|&nbsp; All times are in (IST) Asia/Kolkata
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("Excel")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export Excel
          </button>
          <button
            onClick={() => handleExport("PDF")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500" /> Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
