import { useState, useMemo, useEffect } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { belongsToVendor, hasVendorScope, type VendorScope } from "@/lib/vendorScope";
import { getReceipts } from "@/lib/paymentReceiptStore";
import { POLink } from "@/components/shared/IdLinks";
import {
  Wallet, CheckCircle, Clock, AlertTriangle, TrendingUp,
  Eye, Download, MoreVertical, ChevronDown, Calendar, ArrowUpRight, X,
} from "lucide-react";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type PaymentMethod = "Bank Transfer" | "NEFT" | "RTGS" | "UPI" | "Cheque" | "-";

interface Payment {
  id: string;
  poRef: string;
  invoiceDate: string;
  dueDate: string;
  paymentDate: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
}

const ALL_PAYMENTS: Payment[] = [
  { id: "INV-2024-0187", poRef: "PO-10032", invoiceDate: "Apr 25, 2024", dueDate: "May 25, 2024", paymentDate: "May 20, 2024", method: "Bank Transfer", amount: 2450000, status: "Paid" },
  { id: "INV-2024-0156", poRef: "PO-10021", invoiceDate: "Mar 28, 2024", dueDate: "Apr 27, 2024", paymentDate: "Apr 25, 2024", method: "Bank Transfer", amount: 1875000, status: "Paid" },
  { id: "INV-2024-0123", poRef: "PO-10009", invoiceDate: "Feb 25, 2024", dueDate: "Mar 26, 2024", paymentDate: "Mar 22, 2024", method: "NEFT", amount: 3280000, status: "Paid" },
  { id: "INV-2024-0091", poRef: "PO-09987", invoiceDate: "Jan 24, 2024", dueDate: "Feb 23, 2024", paymentDate: "Feb 20, 2024", method: "RTGS", amount: 1560000, status: "Paid" },
  { id: "INV-2024-0220", poRef: "PO-10041", invoiceDate: "May 15, 2024", dueDate: "Jun 14, 2024", paymentDate: "-", method: "-", amount: 1240000, status: "Pending" },
  { id: "INV-2024-0218", poRef: "PO-10040", invoiceDate: "May 10, 2024", dueDate: "Jun 09, 2024", paymentDate: "-", method: "-", amount: 825600, status: "Pending" },
  { id: "INV-2024-0205", poRef: "PO-10036", invoiceDate: "Apr 30, 2024", dueDate: "May 30, 2024", paymentDate: "-", method: "-", amount: 615960, status: "Pending" },
  { id: "INV-2024-0190", poRef: "PO-10033", invoiceDate: "Apr 20, 2024", dueDate: "May 20, 2024", paymentDate: "May 28, 2024", method: "Bank Transfer", amount: 920000, status: "Overdue" },
  { id: "INV-2024-0188", poRef: "PO-10032", invoiceDate: "Apr 18, 2024", dueDate: "May 18, 2024", paymentDate: "-", method: "-", amount: 925230, status: "Overdue" },
  { id: "INV-2024-0175", poRef: "PO-10029", invoiceDate: "Mar 30, 2024", dueDate: "Apr 29, 2024", paymentDate: "-", method: "-", amount: 920000, status: "Overdue" },
  { id: "INV-2024-0168", poRef: "PO-10025", invoiceDate: "Mar 15, 2024", dueDate: "Apr 14, 2024", paymentDate: "Apr 10, 2024", method: "NEFT", amount: 1650000, status: "Paid" },
  { id: "INV-2024-0162", poRef: "PO-10022", invoiceDate: "Mar 08, 2024", dueDate: "Apr 07, 2024", paymentDate: "Apr 05, 2024", method: "Bank Transfer", amount: 2100000, status: "Paid" },
  { id: "INV-2024-0155", poRef: "PO-10019", invoiceDate: "Mar 01, 2024", dueDate: "Mar 31, 2024", paymentDate: "Mar 28, 2024", method: "RTGS", amount: 3450000, status: "Paid" },
  { id: "INV-2024-0148", poRef: "PO-10015", invoiceDate: "Feb 20, 2024", dueDate: "Mar 21, 2024", paymentDate: "Mar 18, 2024", method: "Bank Transfer", amount: 1820000, status: "Paid" },
  { id: "INV-2024-0141", poRef: "PO-10011", invoiceDate: "Feb 12, 2024", dueDate: "Mar 13, 2024", paymentDate: "Mar 10, 2024", method: "NEFT", amount: 975000, status: "Paid" },
  { id: "INV-2024-0135", poRef: "PO-10007", invoiceDate: "Feb 05, 2024", dueDate: "Mar 06, 2024", paymentDate: "Mar 04, 2024", method: "Bank Transfer", amount: 2250000, status: "Paid" },
  { id: "INV-2024-0128", poRef: "PO-10003", invoiceDate: "Jan 28, 2024", dueDate: "Feb 27, 2024", paymentDate: "Feb 24, 2024", method: "RTGS", amount: 1380000, status: "Paid" },
  { id: "INV-2024-0119", poRef: "PO-09999", invoiceDate: "Jan 18, 2024", dueDate: "Feb 17, 2024", paymentDate: "Feb 14, 2024", method: "Bank Transfer", amount: 1750000, status: "Paid" },
  { id: "INV-2024-0110", poRef: "PO-09993", invoiceDate: "Jan 10, 2024", dueDate: "Feb 09, 2024", paymentDate: "Feb 07, 2024", method: "NEFT", amount: 865000, status: "Paid" },
  { id: "INV-2024-0102", poRef: "PO-09989", invoiceDate: "Jan 03, 2024", dueDate: "Feb 02, 2024", paymentDate: "Jan 30, 2024", method: "Bank Transfer", amount: 1420000, status: "Paid" },
  { id: "INV-2023-0298", poRef: "PO-09975", invoiceDate: "Dec 20, 2023", dueDate: "Jan 19, 2024", paymentDate: "Jan 16, 2024", method: "Bank Transfer", amount: 2800000, status: "Paid" },
  { id: "INV-2023-0285", poRef: "PO-09961", invoiceDate: "Dec 08, 2023", dueDate: "Jan 07, 2024", paymentDate: "Jan 05, 2024", method: "RTGS", amount: 1960000, status: "Paid" },
  { id: "INV-2023-0272", poRef: "PO-09947", invoiceDate: "Nov 25, 2023", dueDate: "Dec 25, 2023", paymentDate: "Dec 22, 2023", method: "Bank Transfer", amount: 1540000, status: "Paid" },
  { id: "INV-2023-0259", poRef: "PO-09933", invoiceDate: "Nov 12, 2023", dueDate: "Dec 12, 2023", paymentDate: "Dec 09, 2023", method: "NEFT", amount: 870000, status: "Paid" },
  { id: "INV-2023-0246", poRef: "PO-09919", invoiceDate: "Oct 30, 2023", dueDate: "Nov 29, 2023", paymentDate: "Nov 26, 2023", method: "Bank Transfer", amount: 2350000, status: "Paid" },
  { id: "INV-2023-0233", poRef: "PO-09905", invoiceDate: "Oct 17, 2023", dueDate: "Nov 16, 2023", paymentDate: "Nov 14, 2023", method: "RTGS", amount: 1680000, status: "Paid" },
  { id: "INV-2023-0220", poRef: "PO-09891", invoiceDate: "Oct 04, 2023", dueDate: "Nov 03, 2023", paymentDate: "Oct 31, 2023", method: "Bank Transfer", amount: 1290000, status: "Paid" },
  { id: "INV-2023-0207", poRef: "PO-09877", invoiceDate: "Sep 21, 2023", dueDate: "Oct 21, 2023", paymentDate: "Oct 18, 2023", method: "NEFT", amount: 765000, status: "Paid" },
  { id: "INV-2023-0194", poRef: "PO-09863", invoiceDate: "Sep 08, 2023", dueDate: "Oct 08, 2023", paymentDate: "Oct 05, 2023", method: "Bank Transfer", amount: 2100000, status: "Paid" },
  { id: "INV-2023-0181", poRef: "PO-09849", invoiceDate: "Aug 26, 2023", dueDate: "Sep 25, 2023", paymentDate: "Sep 22, 2023", method: "Bank Transfer", amount: 1440000, status: "Paid" },
  { id: "INV-2023-0168", poRef: "PO-09835", invoiceDate: "Aug 13, 2023", dueDate: "Sep 12, 2023", paymentDate: "Sep 09, 2023", method: "RTGS", amount: 3100000, status: "Paid" },
  { id: "INV-2023-0155", poRef: "PO-09821", invoiceDate: "Jul 31, 2023", dueDate: "Aug 30, 2023", paymentDate: "Aug 27, 2023", method: "Bank Transfer", amount: 1870000, status: "Paid" },
  { id: "INV-2023-0142", poRef: "PO-09807", invoiceDate: "Jul 18, 2023", dueDate: "Aug 17, 2023", paymentDate: "Aug 14, 2023", method: "NEFT", amount: 940000, status: "Paid" },
  { id: "INV-2023-0129", poRef: "PO-09793", invoiceDate: "Jul 05, 2023", dueDate: "Aug 04, 2023", paymentDate: "Aug 01, 2023", method: "Bank Transfer", amount: 1620000, status: "Paid" },
  { id: "INV-2023-0116", poRef: "PO-09779", invoiceDate: "Jun 22, 2023", dueDate: "Jul 22, 2023", paymentDate: "Jul 19, 2023", method: "Bank Transfer", amount: 2460000, status: "Paid" },
  { id: "INV-2023-0103", poRef: "PO-09765", invoiceDate: "Jun 09, 2023", dueDate: "Jul 09, 2023", paymentDate: "Jul 06, 2023", method: "RTGS", amount: 1350000, status: "Paid" },
  { id: "INV-2023-0090", poRef: "PO-09751", invoiceDate: "May 27, 2023", dueDate: "Jun 26, 2023", paymentDate: "Jun 23, 2023", method: "Bank Transfer", amount: 1780000, status: "Paid" },
  { id: "INV-2023-0077", poRef: "PO-09737", invoiceDate: "May 14, 2023", dueDate: "Jun 13, 2023", paymentDate: "Jun 10, 2023", method: "NEFT", amount: 690000, status: "Paid" },
  { id: "INV-2023-0064", poRef: "PO-09723", invoiceDate: "May 01, 2023", dueDate: "May 31, 2023", paymentDate: "May 28, 2023", method: "Bank Transfer", amount: 2050000, status: "Paid" },
  { id: "INV-2023-0051", poRef: "PO-09709", invoiceDate: "Apr 18, 2023", dueDate: "May 18, 2023", paymentDate: "May 15, 2023", method: "Bank Transfer", amount: 1230000, status: "Paid" },
  { id: "INV-2023-0038", poRef: "PO-09695", invoiceDate: "Apr 05, 2023", dueDate: "May 05, 2023", paymentDate: "May 02, 2023", method: "RTGS", amount: 3560000, status: "Paid" },
  { id: "INV-2023-0025", poRef: "PO-09681", invoiceDate: "Mar 23, 2023", dueDate: "Apr 22, 2023", paymentDate: "Apr 19, 2023", method: "Bank Transfer", amount: 1490000, status: "Paid" },
  { id: "INV-2023-0012", poRef: "PO-09667", invoiceDate: "Mar 10, 2023", dueDate: "Apr 09, 2023", paymentDate: "Apr 06, 2023", method: "NEFT", amount: 820000, status: "Paid" },
  { id: "INV-2022-0399", poRef: "PO-09653", invoiceDate: "Feb 25, 2023", dueDate: "Mar 27, 2023", paymentDate: "Mar 24, 2023", method: "Bank Transfer", amount: 1960000, status: "Paid" },
  { id: "INV-2022-0386", poRef: "PO-09639", invoiceDate: "Feb 12, 2023", dueDate: "Mar 14, 2023", paymentDate: "Mar 11, 2023", method: "Bank Transfer", amount: 2340000, status: "Paid" },
  { id: "INV-2022-0373", poRef: "PO-09625", invoiceDate: "Jan 30, 2023", dueDate: "Mar 01, 2023", paymentDate: "Feb 26, 2023", method: "RTGS", amount: 1170000, status: "Paid" },
  { id: "INV-2022-0360", poRef: "PO-09611", invoiceDate: "Jan 17, 2023", dueDate: "Feb 16, 2023", paymentDate: "Feb 13, 2023", method: "Bank Transfer", amount: 2680000, status: "Paid" },
  { id: "INV-2022-0347", poRef: "PO-09597", invoiceDate: "Jan 04, 2023", dueDate: "Feb 03, 2023", paymentDate: "Jan 31, 2023", method: "NEFT", amount: 950000, status: "Paid" },
  { id: "INV-2022-0334", poRef: "PO-09583", invoiceDate: "Dec 22, 2022", dueDate: "Jan 21, 2023", paymentDate: "Jan 18, 2023", method: "Bank Transfer", amount: 1760000, status: "Paid" },
  { id: "INV-2022-0321", poRef: "PO-09569", invoiceDate: "Dec 09, 2022", dueDate: "Jan 08, 2023", paymentDate: "Jan 05, 2023", method: "Bank Transfer", amount: 3200000, status: "Paid" },
  { id: "INV-2022-0308", poRef: "PO-09555", invoiceDate: "Nov 26, 2022", dueDate: "Dec 26, 2022", paymentDate: "Dec 23, 2022", method: "RTGS", amount: 1410000, status: "Paid" },
  { id: "INV-2022-0295", poRef: "PO-09541", invoiceDate: "Nov 13, 2022", dueDate: "Dec 13, 2022", paymentDate: "Dec 10, 2022", method: "Bank Transfer", amount: 1840000, status: "Paid" },
  { id: "INV-2022-0282", poRef: "PO-09527", invoiceDate: "Oct 31, 2022", dueDate: "Nov 30, 2022", paymentDate: "Nov 27, 2022", method: "NEFT", amount: 720000, status: "Paid" },
  { id: "INV-2022-0269", poRef: "PO-09513", invoiceDate: "Oct 18, 2022", dueDate: "Nov 17, 2022", paymentDate: "Nov 14, 2022", method: "Bank Transfer", amount: 2190000, status: "Paid" },
  { id: "INV-2022-0256", poRef: "PO-09499", invoiceDate: "Oct 05, 2022", dueDate: "Nov 04, 2022", paymentDate: "Nov 01, 2022", method: "Bank Transfer", amount: 1550000, status: "Paid" },
  { id: "INV-2022-0243", poRef: "PO-09485", invoiceDate: "Sep 22, 2022", dueDate: "Oct 22, 2022", paymentDate: "Oct 19, 2022", method: "RTGS", amount: 2870000, status: "Paid" },
  { id: "INV-2022-0230", poRef: "PO-09471", invoiceDate: "Sep 09, 2022", dueDate: "Oct 09, 2022", paymentDate: "Oct 06, 2022", method: "Bank Transfer", amount: 1320000, status: "Paid" },
];

function getLivePayments(scope: VendorScope): Payment[] {
  try {
    const raw = localStorage.getItem("nido_purchase_payments_made_v1");
    const purchaseEntries = raw ? JSON.parse(raw) : [];
    const entries = [
      ...(Array.isArray(purchaseEntries) ? purchaseEntries : []),
      ...getReceipts().filter(receipt => !receipt.archived),
    ];
    return entries
      .filter(entry => belongsToVendor(entry, scope))
      .map(entry => ({
        id: String(entry.paymentNumber || entry.id || ""),
        poRef: String(entry.billNumber || entry.invoiceNumber || entry.referenceNumber || "—"),
        invoiceDate: String(entry.date || entry.paymentDate || "—"),
        dueDate: String(entry.dueDate || entry.paymentDate || "—"),
        paymentDate: String(entry.date || entry.paymentDate || "—"),
        method: (entry.mode || entry.paymentMode || "-") as PaymentMethod,
        amount: Number(entry.amount || entry.amountReceived || 0),
        status: entry.status === "PAID" || entry.status === "paid" ? "Paid" : "Pending",
      }));
  } catch {
    return [];
  }
}

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  Paid: "bg-green-100 text-green-700",
  Pending: "bg-orange-100 text-orange-600",
  Overdue: "bg-red-100 text-red-600",
};

const STATUS_OPTIONS = ["All", "Paid", "Pending", "Overdue"];
const METHOD_OPTIONS = ["All", "Bank Transfer", "NEFT", "RTGS", "UPI", "Cheque"];
const DATE_OPTIONS = ["This Year", "Last Year", "Last 6 Months", "Last 3 Months", "All Time"];
const PAGE_SIZES = [10, 25, 50];

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="appearance-none border border-gray-200 rounded-lg px-2 py-2 pr-8 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function VendorPaymentsPage(scope: VendorScope = {}) {
  const { config } = useConfig();
  const invPrefix = config.prefixes.find(p => p.key === "invoice")?.value || "INV-";
  const poPrefix  = config.prefixes.find(p => p.key === "purchaseOrder")?.value || "PO-";
  const scoped = hasVendorScope(scope);
  const [livePayments, setLivePayments] = useState<Payment[]>(() => getLivePayments(scope));

  useEffect(() => {
    const refresh = () => setLivePayments(getLivePayments(scope));
    window.addEventListener("storage", refresh);
    window.addEventListener("nidoPurchasePaymentsUpdated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("nidoPurchasePaymentsUpdated", refresh);
    };
  }, [scope.vendorId, scope.vendorName]);

  // Remap hardcoded prefixes to whatever is configured right now
  const remappedPayments = useMemo(
    () => (scoped ? livePayments : ALL_PAYMENTS).map(p => ({
      ...p,
      id:    p.id.replace(/^INV-/, invPrefix),
      poRef: p.poRef.replace(/^PO-/, poPrefix),
    })),
    [invPrefix, poPrefix, scoped, livePayments]
  );

  const [statusFilter, setStatusFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [dateRange, setDateRange] = useState("This Year");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return remappedPayments.filter(p => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (methodFilter !== "All" && p.method !== methodFilter) return false;
      return true;
    });
  }, [remappedPayments, statusFilter, methodFilter, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalPaid = remappedPayments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = remappedPayments.filter(p => p.status === "Pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = remappedPayments.filter(p => p.status === "Overdue").reduce((s, p) => s + p.amount, 0);
  const totalAll = totalPaid + totalPending + totalOverdue;
  const thisMonth = remappedPayments
    .filter(p => p.paymentDate !== "-" && new Date(p.paymentDate).getMonth() === new Date().getMonth())
    .reduce((sum, payment) => sum + payment.amount, 0);
  const percentage = (value: number) => totalAll ? `${((value / totalAll) * 100).toFixed(1)}% of Total` : "0.0% of Total";

  const allOnPage = paginated.every(p => selected.has(p.id));
  const toggleAll = () => {
    if (allOnPage) {
      const next = new Set(selected);
      paginated.forEach(p => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paginated.forEach(p => next.add(p.id));
      setSelected(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const stats = [
    {
      label: "Total Payments", value: fmt(totalAll), sub: "All Time",
      icon: <Wallet className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", accent: "text-gray-900",
    },
    {
      label: "Paid Amount", value: fmt(totalPaid), sub: percentage(totalPaid),
      icon: <CheckCircle className="w-5 h-5 text-green-500" />, bg: "bg-green-50", accent: "text-green-700",
    },
    {
      label: "Pending Amount", value: fmt(totalPending), sub: percentage(totalPending),
      icon: <Clock className="w-5 h-5 text-orange-400" />, bg: "bg-orange-50", accent: "text-orange-600",
    },
    {
      label: "Overdue Amount", value: fmt(totalOverdue), sub: percentage(totalOverdue),
      icon: <AlertTriangle className="w-5 h-5 text-purple-500" />, bg: "bg-purple-50", accent: "text-purple-700",
    },
    {
      label: "This Month Payments", value: fmt(thisMonth), sub: null, trend: "+12.6% vs last month",
      icon: <TrendingUp className="w-5 h-5 text-teal-500" />, bg: "bg-teal-50", accent: "text-gray-900",
    },
  ];

  const pageNums = (() => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
      if (page < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  })();

  return (
    <div className="min-h-screen bg-white font-sans" onClick={() => setOpenRowMenu(null)}>
      <div className="max-w-[1280px]px-2 py-2 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                {s.icon}
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.accent}`}>{s.value}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              {s.trend && (
                <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />{s.trend}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Filters row */}
          <div className="px-5 py-2 border-b border-gray-100 flex items-end gap-2 flex-wrap">
            <FilterSelect label="Payment Status" value={statusFilter} options={STATUS_OPTIONS} onChange={v => { setStatusFilter(v); setPage(1); }} />
            <FilterSelect label="Payment Method" value={methodFilter} options={METHOD_OPTIONS} onChange={v => { setMethodFilter(v); setPage(1); }} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Date Range</label>
              <div className="relative">
                <select value={dateRange} onChange={e => setDateRange(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]">
                  {DATE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Active filter badges */}
            <div className="flex items-end gap-2 flex-1">
              {statusFilter !== "All" && (
                <button onClick={() => { setStatusFilter("All"); setPage(1); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  Status: {statusFilter} <X className="w-3 h-3" />
                </button>
              )}
              {methodFilter !== "All" && (
                <button onClick={() => { setMethodFilter("All"); setPage(1); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  Method: {methodFilter} <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button className="ml-auto flex items-center gap-1.5 px-2 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-2 w-10">
                    <input type="checkbox" checked={allOnPage && paginated.length > 0} onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600" />
                  </th>
                  {["Invoice No.", "PO / Ref No.", "Invoice Date", "Due Date", "Payment Date", "Payment Method", "Amount", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-sm text-gray-400">No payments match the selected filters.</td></tr>
                ) : paginated.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selected.has(p.id) ? "bg-blue-50/30" : ""}`}>
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600" />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-blue-600 font-semibold text-sm hover:underline cursor-pointer">{p.id}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm"><POLink id={p.poRef} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-sm">{p.invoiceDate}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-sm">{p.dueDate}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-500 text-sm">{p.paymentDate}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-500 text-sm">{p.method === "-" ? <span className="text-gray-300">–</span> : p.method}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-gray-800 text-sm">{fmt(p.amount)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                        <div className="relative">
                          <button onClick={() => setOpenRowMenu(openRowMenu === p.id ? null : p.id)}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openRowMenu === p.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                              <button className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">View Invoice</button>
                              <button className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Download PDF</button>
                              <button className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Mark as Paid</button>
                              <div className="my-1 border-t border-gray-100" />
                              <button className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">Dispute</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of <span className="font-semibold text-gray-700">{filtered.length}</span> payments
            </p>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm">
                ‹
              </button>
              {pageNums.map((n, i) =>
                n === "…" ? (
                  <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${page === n ? "bg-blue-600 text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {n}
                  </button>
                )
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm">
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
