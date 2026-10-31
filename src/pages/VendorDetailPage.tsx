import { useState, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  Star, Phone, Mail, MessageSquare, ChevronLeft, Building2, MapPin,
  CreditCard, FileText, Package, ShoppingCart, TrendingUp, ClipboardList,
  Newspaper, DollarSign, AlertCircle, CheckCircle2, Clock, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import VendorProductsPage from "./VendorProductsPage";
import VendorOrdersPage from "./VendorOrdersPage";
import VendorContractsPage from "./VendorContractsPage";
import VendorPaymentsPage from "./VendorPaymentsPage";
import VendorServicesPage from "./VendorServicesPage";
import VendorNewsActivityPage from "./VendorNewsActivityPage";
import VendorPerformancePage from "./VendorPerformancePage";
import VendorConfigurationTab from "./VendorConfigurationTab";
import { getVendorById, type StoredVendor } from "@/lib/vendorDataStore";
import { getAllPOs, getPODisplayStatus, type StoredPO } from "@/lib/purchaseOrderStore";

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function ProgressBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  );
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value);
  const isoDate = new Date(raw);
  if (!Number.isNaN(isoDate.getTime())) return isoDate;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function poBelongsToVendor(po: StoredPO, vendor: StoredVendor) {
  return normalize(po.vendorId) === normalize(vendor.id)
    || normalize(po.vendorName) === normalize(vendor.name);
}

function getVendorPurchaseOrders(vendor: StoredVendor) {
  return getAllPOs().filter(po => poBelongsToVendor(po, vendor));
}

function getPOAmount(po: StoredPO) {
  return Number(po.grandTotal ?? po.subtotal ?? 0) || 0;
}

function formatRelativeTime(value: unknown) {
  const date = parseDate(value);
  if (!date) return "Date unavailable";
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDate(value: unknown) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";
}

function getVendorContracts(vendor: StoredVendor): any[] {
  const directContracts = [
    (vendor as any).contracts,
    (vendor as any).activeContracts,
  ].find(value => Array.isArray(value));
  if (directContracts) return directContracts;

  // Support contract records saved by contract-management flows without
  // treating an unrelated global contract list as belonging to this vendor.
  try {
    const raw = localStorage.getItem(`nido_vendor_contracts_${vendor.id}`);
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function getContractProgress(contract: any) {
  const start = parseDate(contract.startDate || contract.start_date);
  const end = parseDate(contract.endDate || contract.end_date);
  if (!start || !end || end <= start) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100)));
}

function formatContractValue(value: unknown) {
  if (typeof value === "number") return fmt(value);
  return value ? String(value) : "Value not recorded";
}

function buildSpendData(purchaseOrders: StoredPO[]) {
  const now = new Date();
  const totals = new Map<string, number>();
  for (const po of purchaseOrders) {
    const date = parseDate(po.createdOn || po.createdOnDisplay);
    if (!date || po.status === "Draft" || po.status === "Cancelled") continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    totals.set(key, (totals.get(key) || 0) + getPOAmount(po));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      spend: Math.round((totals.get(key) || 0) / 100000),
    };
  });
}

function getRecentActivities(vendor: StoredVendor, purchaseOrders: StoredPO[], contracts: any[]) {
  const poActivities = purchaseOrders.map(po => ({
    icon: po.status === "Delivered"
      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      : <ShoppingCart className="w-4 h-4 text-blue-500" />,
    text: `Purchase order ${po.poNumber} is ${getPODisplayStatus(po.status).toLowerCase()}`,
    time: formatRelativeTime(po.createdOn || po.createdOnDisplay),
    color: po.status === "Delivered" ? "bg-emerald-50" : "bg-blue-50",
    sortDate: parseDate(po.createdOn || po.createdOnDisplay)?.getTime() || 0,
  }));
  const contractActivities = contracts
    .filter(contract => contract.updatedOn || contract.updatedAt || contract.createdOn || contract.createdAt)
    .map(contract => ({
      icon: <FileText className="w-4 h-4 text-purple-500" />,
      text: `Contract ${contract.name || contract.id || "record"} updated`,
      time: formatRelativeTime(contract.updatedOn || contract.updatedAt || contract.createdOn || contract.createdAt),
      color: "bg-purple-50",
      sortDate: parseDate(contract.updatedOn || contract.updatedAt || contract.createdOn || contract.createdAt)?.getTime() || 0,
    }));
  const activities = [...poActivities, ...contractActivities]
    .sort((a, b) => b.sortDate - a.sortDate)
    .slice(0, 5);
  if (activities.length) return activities;
  return vendor.onboardedDate
    ? [{
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        text: "Vendor onboarded",
        time: formatRelativeTime(vendor.onboardedDate),
        color: "bg-emerald-50",
        sortDate: parseDate(vendor.onboardedDate)?.getTime() || 0,
      }]
    : [];
}

function OverviewTab({ vendor }: { vendor: StoredVendor }) {
  const purchaseOrders = getVendorPurchaseOrders(vendor);
  const activeContracts = getVendorContracts(vendor).filter(contract =>
    ["active", "expiring soon"].includes(normalize(contract.status || "Active"))
  );
  const spendOrders = purchaseOrders.filter(po => po.status !== "Draft" && po.status !== "Cancelled");
  const poSpend = spendOrders.reduce((sum, po) => sum + getPOAmount(po), 0);
  const totalSpend = fmt(poSpend || vendor.totalSpend || 0);
  const avgOrderValue = spendOrders.length
    ? fmt(Math.round(poSpend / spendOrders.length))
    : "—";
  const spendData = buildSpendData(purchaseOrders);
  const recentActivities = getRecentActivities(vendor, purchaseOrders, activeContracts);

  const qualityScore = vendor.performanceQuality ?? 82;
  const deliveryScore = vendor.performanceDelivery ?? 88;
  const responsivenessScore = vendor.performanceResponsiveness ?? 79;
  const complianceScore = vendor.performanceCompliance ?? 91;
  const grandScore = Math.round((qualityScore + deliveryScore + responsivenessScore + complianceScore) / 4);

  return (
    <div className="flex flex-col gap-5">
      {/* Top 3-column info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Vendor Information</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Address", value: vendor.addressLine1 || vendor.address || "—" },
              { label: "City", value: vendor.city || "—" },
              { label: "State / Province", value: vendor.state || "—" },
              { label: "Zip / Postal Code", value: vendor.zipCode || "—" },
              { label: "Country", value: vendor.country || "India" },
              { label: "Website", value: vendor.website || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
                <span className="text-xs font-medium text-gray-700 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Additional Information</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Registration No.", value: vendor.registrationNo || "—" },
              { label: "Tax ID / GST", value: vendor.taxId || "—" },
              { label: "PAN Number", value: vendor.pan || "—" },
              { label: "Founded", value: vendor.founded || "—" },
              { label: "Employees", value: vendor.employees || "—" },
              { label: "Annual Revenue", value: vendor.annualRevenue || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
                <span className="text-xs font-medium text-gray-700 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Payment & Bank Details</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Payment Mode", value: vendor.paymentMode || "—" },
              { label: "Payment Terms", value: vendor.paymentTerms || "—" },
              { label: "Bank Account", value: vendor.bankAccount || "—" },
              { label: "IFSC Code", value: vendor.ifscCode || "—" },
              { label: "Bank Name", value: vendor.bankName || "—" },
              { label: "Branch", value: vendor.bankBranch || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
                <span className="text-xs font-medium text-gray-700 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Billing / Shipping + Performance */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Billing Address</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Address Line 1", value: vendor.billingAddressLine1 || vendor.addressLine1 || "—" },
              { label: "Address Line 2", value: vendor.billingAddressLine2 || vendor.addressLine2 || "—" },
              { label: "City", value: vendor.billingCity || vendor.city || "—" },
              { label: "State", value: vendor.billingState || vendor.state || "—" },
              { label: "Zip Code", value: vendor.billingZip || vendor.zipCode || "—" },
              { label: "Country", value: vendor.billingCountry || vendor.country || "India" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
                <span className="text-xs font-medium text-gray-700 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-800">Shipping Address</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Address Line 1", value: vendor.shippingAddressLine1 || vendor.addressLine1 || "—" },
              { label: "Address Line 2", value: vendor.shippingAddressLine2 || vendor.addressLine2 || "—" },
              { label: "City", value: vendor.shippingCity || vendor.city || "—" },
              { label: "State", value: vendor.shippingState || vendor.state || "—" },
              { label: "Zip Code", value: vendor.shippingZip || vendor.zipCode || "—" },
              { label: "Country", value: vendor.shippingCountry || vendor.country || "India" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
                <span className="text-xs font-medium text-gray-700 text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Vendor Performance</h3>
          </div>
          <div className="flex flex-col gap-3.5">
            {[
              { label: "Quality", value: qualityScore, color: "bg-blue-500" },
              { label: "Delivery", value: deliveryScore, color: "bg-emerald-500" },
              { label: "Responsiveness", value: responsivenessScore, color: "bg-purple-500" },
              { label: "Compliance", value: complianceScore, color: "bg-indigo-500" },
            ].map(m => (
              <div key={m.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
                <ProgressBar value={m.value} color={m.color} />
              </div>
            ))}
            <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">Grand Score</span>
              <span className="text-sm font-bold text-blue-600">{grandScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Contracts + Recent Activity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">Active Contracts</h3>
            </div>
            <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">{activeContracts.length} Active</span>
          </div>
          <div className="flex flex-col gap-4">
            {activeContracts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
                <p className="text-xs font-medium text-gray-500">No active contracts recorded</p>
                <p className="text-xs text-gray-400 mt-1">Contract records will appear here when linked to this vendor.</p>
              </div>
            ) : activeContracts.map((c, i) => {
              const status = c.status || "Active";
              const endDate = c.endDate || c.end_date;
              const progress = getContractProgress(c);
              return (
                <div key={c.id || i} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{c.name || c.title || c.id || "Untitled contract"}</p>
                      <p className="text-xs text-gray-400">{formatContractValue(c.value || c.contractValue)} · Ends {formatDate(endDate)}</p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Recent Activity</h3>
          </div>
          <div className="flex flex-col gap-0">
            {recentActivities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
                <p className="text-xs font-medium text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">New vendor and purchase-order activity will appear here.</p>
              </div>
            ) : recentActivities.map((a, i) => (
              <div key={i} className="flex gap-3 relative pb-4 last:pb-0">
                {i < recentActivities.length - 1 && (
                  <div className="absolute left-4 top-7 bottom-0 w-px bg-gray-100" />
                )}
                <div className={`w-8 h-8 rounded-full ${a.color} flex items-center justify-center flex-shrink-0 z-10`}>
                  {a.icon}
                </div>
                <div className="pt-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug">{a.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spend Summary + Spend Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800">Spend Summary</h3>
            </div>
            <span className="text-xs text-gray-400">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={spendData} barSize={18} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}L`} />
              <Tooltip
                formatter={(v: number) => [`₹${v} L`, "Spend"]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}
              />
              <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {spendOrders.length === 0 && (
            <p className="text-center text-xs text-gray-400 -mt-2">No completed or confirmed purchase-order spend in this period.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Spend Metrics</h3>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { label: "Total Spend", value: totalSpend, highlight: true },
              { label: "Category", value: vendor.category, highlight: false },
              { label: "Avg Order Value", value: avgOrderValue, highlight: false },
              { label: "Purchase Orders", value: String(spendOrders.length), highlight: false },
              { label: "Onboarded", value: vendor.onboardedDate, highlight: false },
              { label: "Region", value: vendor.region, highlight: false },
            ].map(m => (
              <div key={m.label} className="flex flex-col gap-0.5">
                <p className="text-xs text-gray-400">{m.label}</p>
                <p className={`text-sm font-bold ${m.highlight ? "text-blue-600" : "text-gray-800"}`}>{m.value}</p>
                {m.label !== "Region" && <div className="h-px bg-gray-50 mt-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview", icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: "products", label: "Products", icon: <Package className="w-3.5 h-3.5" /> },
  { key: "orders", label: "Orders", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { key: "services", label: "Services", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "performance", label: "Performance", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "contracts", label: "Contracts", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "configuration", label: "Configuration", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "payments", label: "Payments", icon: <CreditCard className="w-3.5 h-3.5" /> },
  { key: "news", label: "News & Activity", icon: <Newspaper className="w-3.5 h-3.5" /> },
];

export default function VendorDetailPage() {
  const { id: vendorId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [dataVersion, setDataVersion] = useState(0);

  const vendor = vendorId ? getVendorById(vendorId) : undefined;

  useEffect(() => {
    const refresh = () => setDataVersion(version => version + 1);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === "nido_vendors_v2"
        || event.key === "nido_all_purchase_orders"
        || event.key === `nido_vendor_contracts_${vendorId}`
      ) {
        refresh();
      }
    };
    window.addEventListener("nidoVendorsUpdated", refresh);
    window.addEventListener("poCreated", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("nidoVendorsUpdated", refresh);
      window.removeEventListener("poCreated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [vendorId]);

  useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab) {
      setActiveTab(state.tab);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Vendor not found</h2>
          <p className="text-sm text-gray-400 mt-1">No vendor with ID <span className="font-mono">{vendorId}</span> exists.</p>
        </div>
        <button
          onClick={() => navigate("/vendors")}
          className="flex items-center gap-1.5 px-2 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Vendors
        </button>
      </div>
    );
  }

  const initials = vendor.name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const qualityScore = vendor.performanceQuality ?? 82;
  const deliveryScore = vendor.performanceDelivery ?? 88;
  const responsivenessScore = vendor.performanceResponsiveness ?? 79;
  const complianceScore = vendor.performanceCompliance ?? 91;
  const grandScore = Math.round((qualityScore + deliveryScore + responsivenessScore + complianceScore) / 4);

  const stats = [
    { label: "Rating", value: `${vendor.rating}/5`, sub: "★".repeat(Math.round(vendor.rating)), accent: "text-amber-500" },
    { label: "Total Spend", value: vendor.totalSpend ? fmt(vendor.totalSpend) : "₹0", sub: "+12% YoY", accent: "text-blue-600" },
    { label: "Category", value: vendor.category, sub: vendor.region, accent: "text-gray-800" },
    { label: "On-Time Delivery", value: `${deliveryScore}%`, sub: "Last 12 months", accent: "text-emerald-600" },
    { label: "Quality Score", value: `${grandScore}%`, sub: "Avg last 3 reviews", accent: "text-indigo-600" },
    { label: "Status", value: vendor.status, sub: vendor.onboardedDate, accent: vendor.status === "Active" ? "text-emerald-600" : "text-gray-600" },
  ];

  const statusColor = {
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-gray-100 text-gray-500",
    "On Hold": "bg-amber-100 text-amber-700",
    Pending: "bg-blue-100 text-blue-700",
  }[vendor.status] || "bg-gray-100 text-gray-500";

  if (activeTab === "contracts") {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8fafc] font-[Inter,sans-serif]">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.16em] text-blue-600">{vendor.id}</p>
            <h1 className="text-sm font-bold leading-tight text-gray-900">{vendor.name}</h1>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-800"
          >
            <ChevronLeft className="h-3 w-3" /> Overview
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          <VendorContractsPage vendorId={vendor.id} vendorName={vendor.name} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-[Inter,sans-serif] flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        {/* Vendor identity row */}
        <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate("/vendors")}
              className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900">{vendor.name}</h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${statusColor}`}>
                  {vendor.status === "Active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {vendor.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {[vendor.id, vendor.category, vendor.region, `Onboard: ${vendor.onboardedDate}`].map((item, i) => (
                  <span key={i} className="text-xs text-gray-500 flex items-center gap-1">
                    {i > 0 && <span className="text-gray-300">·</span>}
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Primary contact + action */}
          <div className="flex items-start gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Primary Contact</p>
              <p className="text-sm font-semibold text-gray-800">{vendor.primaryContact}</p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{vendor.phone}</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <Mail className="w-3 h-3 text-gray-400" />
                <a href={`mailto:${vendor.email}`} className="text-xs text-blue-500 hover:underline">{vendor.email}</a>
              </div>
            </div>
            <button className="flex items-center gap-2 px-2 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm mt-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Message Vendor
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-6 pb-3">
          <div className="grid grid-cols-6 divide-x divide-gray-100 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center py-2 px-2 text-center">
                <p className={`text-base font-bold ${s.accent}`}>{s.value}</p>
                <p className="text-xs text-gray-500 font-medium leading-tight mt-0.5">{s.label}</p>
                <p className="text-xs text-gray-400 leading-tight">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="relative">
          <div className="flex items-center px-2 gap-0 overflow-x-auto no-scrollbar border-t border-gray-100">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200"
                }`}
              >
                <span className={activeTab === tab.key ? "text-blue-600" : "text-gray-400"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 overflow-auto">
        {activeTab === "overview" && <div className="px-6 py-5"><OverviewTab key={dataVersion} vendor={vendor} /></div>}
        {activeTab === "products" && <VendorProductsPage />}
        {activeTab === "orders" && <VendorOrdersPage vendorId={vendor.id} vendorName={vendor.name} />}
        {activeTab === "services" && <VendorServicesPage vendorId={vendor.id} vendorName={vendor.name} />}
        {activeTab === "performance" && <VendorPerformancePage vendor={vendor} />}
        {activeTab === "contracts" && <VendorContractsPage vendorId={vendor.id} vendorName={vendor.name} />}
        {activeTab === "configuration" && <div className="px-6 py-5"><VendorConfigurationTab vendorId={vendor.id} /></div>}
        {activeTab === "payments" && <VendorPaymentsPage vendorId={vendor.id} vendorName={vendor.name} />}
        {activeTab === "news" && <VendorNewsActivityPage vendorId={vendor.id} vendorName={vendor.name} />}
      </div>
    </div>
  );
}
