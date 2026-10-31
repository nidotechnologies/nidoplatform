import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Download,
  Users,
  DollarSign,
  Construction,
  ShoppingCart,
  Building2,
  Globe,
  ChevronRight,
  FileText,
  Clock,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import RolesPage from "./ClientRolesPage";
import UsersPage from "./ClientUsersPage";
import OrdersPage from "./ClientOrdersPage";
import ServicesPage from "./ClientServicesPage";
import CatalogPage from "./ClientCatalogPage";
import ActivityPage from "./ClientActivityPage";
import ConfigurationPage from "./ClientConfigurationPage";
import ContractsPage from "./ClientContractsPage";
import DocumentsPage from "./ClientDocumentsPage";
import { getClients } from "@/lib/clientStore";
import {
  getClientActivities,
  getClientContract,
  getClientDocuments,
  getClientOrders,
  getClientServices,
  type ClientActivityRecord,
  type ClientDocumentRecord,
  type ClientOrderRecord,
  type ClientServiceRecord,
} from "@/lib/clientDataStore";
import { getPortalUsersByClient } from "@/lib/portalUserStore";

const ADMIN_TABS = ["Overview", "Roles", "Users", "Orders", "Services", "Contracts", "Catalog", "Activity", "Configuration", "Documents"];
const PORTAL_TABS = ["Overview"];

type SpendCategory = { name: string; value: number; amount: string; color: string };
export type ClientDateRange = { start: string; end: string };

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDate(value?: string): string {
  return value?.slice(0, 10) || "";
}

function isDateInRange(value: string | undefined, range: ClientDateRange): boolean {
  const date = normalizeDate(value);
  return Boolean(date && range.start && range.end && range.start <= range.end && date >= range.start && date <= range.end);
}

function overlapsDateRange(startValue: string | undefined, endValue: string | undefined, range: ClientDateRange): boolean {
  const start = normalizeDate(startValue);
  const end = normalizeDate(endValue || startValue);
  return Boolean(start && end && range.start && range.end && range.start <= range.end && start <= range.end && end >= range.start);
}

function formatDateRange(range: ClientDateRange): string {
  if (!range.start || !range.end) return "Choose start and end dates";
  const format = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${format(range.start)} – ${format(range.end)}`;
}

function DonutChart({ categories, size }: { categories: SpendCategory[]; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.45;
  const innerR = size * 0.28;
  const total = categories.reduce((s, c) => s + c.value, 0);
  let angle = -Math.PI / 2;

  const slices = categories.map((cat) => {
    const sweep = (cat.value / total) * 2 * Math.PI;
    const x1 = cx + outerR * Math.cos(angle);
    const y1 = cy + outerR * Math.sin(angle);
    const x2 = cx + outerR * Math.cos(angle + sweep);
    const y2 = cy + outerR * Math.sin(angle + sweep);
    const ix1 = cx + innerR * Math.cos(angle + sweep);
    const iy1 = cy + innerR * Math.sin(angle + sweep);
    const ix2 = cx + innerR * Math.cos(angle);
    const iy2 = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
    angle += sweep;
    return { d, color: cat.color, name: cat.name };
  });

  return (
    <svg width={size} height={size}>
      {slices.map((s) => (
        <path key={s.name} d={s.d} fill={s.color} stroke="white" strokeWidth={1} />
      ))}
    </svg>
  );
}

function PlaceholderPage({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
        <Construction size={28} className="text-blue-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{tab}</h2>
        <p className="text-sm text-gray-400 mt-1">This section is ready — data coming soon.</p>
      </div>
    </div>
  );
}

function NotFoundPage({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-2 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <Building2 size={28} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Client not found</h2>
        <p className="text-sm text-gray-400 mt-1">No client with ID <span className="font-mono">{id}</span> exists.</p>
      </div>
      <button
        onClick={() => navigate("/clients")}
        className="flex items-center gap-1.5 px-2 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        <ChevronLeft size={14} /> Back to Clients
      </button>
    </div>
  );
}

interface ClientDetailProps {
  /** When true, renders the portal-mode view: injects clientId from auth,
   *  shows only the Overview tab, and hides admin-only controls. */
  portalMode?: boolean;
}

export default function App({ portalMode = false }: ClientDetailProps) {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const today = new Date();
  const todayInput = toDateInputValue(today);
  const thisYearRange: ClientDateRange = {
    start: `${today.getFullYear()}-01-01`,
    end: todayInput,
  };
  const [periodPreset, setPeriodPreset] = useState<"thisYear" | "custom">("thisYear");
  const [customStartDate, setCustomStartDate] = useState(thisYearRange.start);
  const [customEndDate, setCustomEndDate] = useState(thisYearRange.end);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  // In portal mode use the authenticated user's clientId; otherwise use the route param.
  const clientId = portalMode ? (user?.clientId ?? "") : (params.id ?? "");

  const tabs = portalMode ? PORTAL_TABS : ADMIN_TABS;

  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  const [liveOrders, setLiveOrders] = useState<ClientOrderRecord[]>(() => getClientOrders(clientId));
  const [liveServices, setLiveServices] = useState<ClientServiceRecord[]>(() => getClientServices(clientId));
  const [liveActivities, setLiveActivities] = useState<ClientActivityRecord[]>(() => getClientActivities(clientId));
  const [liveDocuments, setLiveDocuments] = useState<ClientDocumentRecord[]>(() => getClientDocuments(clientId));
  const [liveContract, setLiveContract] = useState(() => getClientContract(clientId));
  const [portalUserCount, setPortalUserCount] = useState(() => getPortalUsersByClient(clientId).length);

  useEffect(() => {
    const reload = () => {
      setLiveOrders(getClientOrders(clientId, client?.name));
      setLiveServices(getClientServices(clientId));
      setLiveActivities(getClientActivities(clientId));
      setLiveDocuments(getClientDocuments(clientId));
      setLiveContract(getClientContract(clientId));
      setPortalUserCount(getPortalUsersByClient(clientId).length);
    };
    reload();
    window.addEventListener("nidoClientDataUpdated", reload);
    window.addEventListener("nidoPortalUsersUpdated", reload);
    return () => {
      window.removeEventListener("nidoClientDataUpdated", reload);
      window.removeEventListener("nidoPortalUsersUpdated", reload);
    };
  }, [clientId, client?.name]);

  if (!client) {
    return <NotFoundPage id={clientId || ""} />;
  }

  const initials = client.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const selectedDateRange: ClientDateRange = periodPreset === "thisYear"
    ? thisYearRange
    : { start: customStartDate, end: customEndDate };
  const validDateRange = Boolean(
    selectedDateRange.start &&
    selectedDateRange.end &&
    selectedDateRange.start <= selectedDateRange.end,
  );
  const periodOrders = validDateRange
    ? liveOrders.filter((order) => isDateInRange(order.date, selectedDateRange))
    : [];
  const periodServices = validDateRange
    ? liveServices.filter((service) => overlapsDateRange(service.startDate, service.endDate, selectedDateRange))
    : [];

  const monthlySpend: { month: string; value: number }[] = [];
  if (validDateRange) {
    const cursor = new Date(`${selectedDateRange.start}T00:00:00`);
    const endMonth = new Date(`${selectedDateRange.end}T00:00:00`);
    cursor.setDate(1);
    endMonth.setDate(1);
    while (cursor <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      monthlySpend.push({
        month: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: periodOrders
          .filter((order) => normalizeDate(order.date).startsWith(key))
          .reduce((sum, order) => sum + Number(order.amountNum || 0), 0),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const totalSpend = periodOrders.reduce((sum, order) => sum + Number(order.amountNum || 0), 0);
  const spendByCategory = periodServices.reduce<Record<string, number>>((result, service) => {
    const amount = Number(String(service.amount).replace(/[^\d.-]/g, "")) || 0;
    result[service.category || "Services"] = (result[service.category || "Services"] || 0) + amount;
    return result;
  }, {});
  if (totalSpend > 0) spendByCategory.Orders = (spendByCategory.Orders || 0) + totalSpend;
  const categoryColors = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#06b6d4"];
  const categoryTotal = Object.values(spendByCategory).reduce((sum, value) => sum + value, 0);
  const spendCategories: SpendCategory[] = Object.entries(spendByCategory).map(([name, amount], index) => ({
    name,
    value: categoryTotal ? Math.round((amount / categoryTotal) * 100) : 0,
    amount: `₹${amount.toLocaleString("en-IN")}`,
    color: categoryColors[index % categoryColors.length],
  }));
  const openOrders = periodOrders.filter((order) => !["delivered", "completed", "cancelled"].includes(order.status.toLowerCase())).length;
  const activeServiceCount = periodServices.filter((service) => service.status.toLowerCase() === "active").length;

  const contractStart = client.contractStartDate
    ? new Date(client.contractStartDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "N/A";
  const contractEnd = client.contractEndDate
    ? new Date(client.contractEndDate)
    : null;
  const daysLeft = contractEnd
    ? Math.max(0, Math.round((contractEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const contractProgress = contractEnd && client.contractStartDate
    ? Math.min(100, Math.round(
        ((today.getTime() - new Date(client.contractStartDate).getTime()) /
          (contractEnd.getTime() - new Date(client.contractStartDate).getTime())) * 100
      ))
    : 100;

  const isOverview = activeTab === "Overview";
  const address = [client.billingAddress, client.billingCity, client.billingState, client.billingPincode]
    .filter(Boolean)
    .join(", ") || "No address";

  const shippingAddress = [client.shipping_address || client.shippingAddress, client.shipping_city || client.shippingCity, client.shipping_state || client.shippingState, client.shipping_pincode || client.shippingPincode]
    .filter(Boolean)
    .join(", ") || null;

  function handleDownloadProfile() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = 0;

    // Header band
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 42, "F");

    // Avatar circle
    doc.setFillColor(255, 255, 255);
    doc.circle(margin + 12, 21, 12, "F");
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(initials, margin + 12, 24.5, { align: "center" });

    // Client name & ID
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(client.name, margin + 30, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Client ID: ${client.id}`, margin + 30, 25);
    doc.text(`Status: ${(client.status || "N/A").toUpperCase()}`, margin + 30, 31);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, margin + 30, 37);

    y = 52;

    // Helper to draw a section heading
    function sectionHead(title: string) {
      doc.setFillColor(239, 246, 255);
      doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title.toUpperCase(), margin + 2, y + 1);
      y += 7;
    }

    // Helper to draw a labeled value row (two-column layout)
    function row(label: string, value: string, x = margin, colW = pageW - margin * 2) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(label, x, y);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(value || "N/A", colW - 32);
      doc.text(lines, x + 32, y);
      y += 5.5 * lines.length;
    }

    // ── Basic Information ────────────────────────────────────────
    sectionHead("Basic Information");
    const halfW = (pageW - margin * 2) / 2;
    const rightX = margin + halfW + 4;

    // Left column
    const savedY = y;
    row("Company Name", client.name, margin, halfW);
    row("Category", client.category || client.client_category || "N/A", margin, halfW);
    row("Client Tier", client.tier || client.client_tier || "N/A", margin, halfW);
    row("Client Rep", client.rep || client.client_rep || "N/A", margin, halfW);
    const leftEndY = y;

    // Right column
    y = savedY;
    row("Email", client.email || "N/A", rightX, halfW);
    row("Phone", client.phone || "N/A", rightX, halfW);
    row("Mobile", client.mobile || "N/A", rightX, halfW);
    row("Website", client.website || "N/A", rightX, halfW);
    const rightEndY = y;

    y = Math.max(leftEndY, rightEndY) + 3;

    // ── Business Details ─────────────────────────────────────────
    sectionHead("Business Details");
    const b1Y = y;
    row("GST Number", client.gst_number || client.gstNumber || "N/A", margin, halfW);
    row("PAN Number", client.pan_number || client.panNumber || "N/A", margin, halfW);
    row("Currency", client.currency || client.preferred_currency || "N/A", margin, halfW);
    row("Industry", client.industry || "N/A", margin, halfW);
    const b1End = y;

    y = b1Y;
    row("Bank Name", client.bank_name || client.bankName || "N/A", rightX, halfW);
    row("Account No.", client.account_number || client.accountNumber || "N/A", rightX, halfW);
    row("IFSC Code", client.ifsc_code || client.ifscCode || "N/A", rightX, halfW);
    row("Branch", client.branch || "N/A", rightX, halfW);
    const b2End = y;

    y = Math.max(b1End, b2End) + 3;

    // ── Contract Details ──────────────────────────────────────────
    sectionHead("Contract Details");
    const c1Y = y;
    row("Contract Start", contractStart, margin, halfW);
    row("Days Remaining", daysLeft.toString(), margin, halfW);
    const c1End = y;

    y = c1Y;
    row("Contract End", contractEnd ? contractEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A", rightX, halfW);
    row("Progress", `${contractProgress}%`, rightX, halfW);
    const c2End = y;

    y = Math.max(c1End, c2End) + 3;

    // ── Address ───────────────────────────────────────────────────
    sectionHead("Address");
    const a1Y = y;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("BILLING ADDRESS", margin, y);
    y += 4;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const billingLines = doc.splitTextToSize(address, halfW - 4);
    doc.text(billingLines, margin, y);
    const a1End = y + 5.5 * billingLines.length;

    y = a1Y;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("SHIPPING ADDRESS", rightX, y);
    y += 4;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const shipLines = doc.splitTextToSize(shippingAddress || address, halfW - 4);
    doc.text(shipLines, rightX, y);

    y = Math.max(a1End, y + 5.5 * shipLines.length) + 3;

    // ── Notes ─────────────────────────────────────────────────────
    if (client.notes || client.client_notes) {
      sectionHead("Notes");
      const noteLines = doc.splitTextToSize(client.notes || client.client_notes, pageW - margin * 2);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(noteLines, margin, y);
      y += 5.5 * noteLines.length + 3;
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("NIDO Procurement Platform — Confidential", margin, pageH - 3.5);
    doc.text(`Page 1`, pageW - margin, pageH - 3.5, { align: "right" });

    doc.save(`${client.name.replace(/\s+/g, "_")}_Profile.pdf`);
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Page header */}
      <div className="px-6 pt-5 pb-0 flex items-center gap-2">
        {!portalMode && (
          <button
            onClick={() => navigate("/clients")}
            className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-900">{client.name}</h1>
        {portalMode && (
          <span className="ml-2 text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">My Company</span>
        )}
      </div>

      <div className="flex gap-0 p-2 pt-3 min-h-[calc(100vh-48px)]">
        {/* LEFT SIDEBAR — only on Overview */}
        {isOverview && sidebarVisible && (
          <aside className="w-64 shrink-0 bg-white rounded-xl border border-gray-200 p-2 flex flex-col gap-2 mr-4 h-fit relative">
            {/* Hide button */}
            <button
              onClick={() => setSidebarVisible(false)}
              title="Hide panel"
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="w-16 h-16 rounded-full border-2 border-blue-500 flex items-center justify-center bg-white overflow-hidden">
                {client.client_logo_url ? (
                  <img
                    src={client.client_logo_url}
                    alt={`${client.name} logo`}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-blue-600 font-bold text-lg">{initials}</span>
                )}
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm">{client.name}</p>
                <p className="text-xs text-gray-500">{client.tier || "Client"} • Since {contractStart}</p>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-gray-400 shrink-0" />
                <span className="truncate">{client.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-gray-400 shrink-0" />
                <span>{client.phone || "No phone"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                <span className="truncate">{address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span>{client.contractEndDate ? new Date(client.contractEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</span>
              </div>
            </div>

            {/* Action buttons — admin-facing only */}
            {!portalMode && (
              <div className="flex gap-2">
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Mail size={12} /> Email
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No email address available"
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-400 cursor-not-allowed"
                  >
                    <Mail size={12} /> Email
                  </button>
                )}
                {client.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Phone size={12} /> Call
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No phone number available"
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-400 cursor-not-allowed"
                  >
                    <Phone size={12} /> Call
                  </button>
                )}
              </div>
            )}

            {/* Contract Progress */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-600">Contract Progress</span>
                <span className="text-xs text-gray-500">{daysLeft} days left</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${contractProgress}%` }} />
              </div>
            </div>

            {/* Client meta */}
            <div className="flex justify-between text-xs">
              <div>
                <p className="text-gray-500">Client Since</p>
                <p className="font-medium text-gray-800">{contractStart}</p>
              </div>
              <div>
                <p className="text-gray-500">Client ID</p>
                <p className="font-medium text-gray-800">{client.id}</p>
              </div>
            </div>

            {/* Download button — admin-facing only */}
            {!portalMode && (
              <button
                onClick={handleDownloadProfile}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <Download size={13} />
                Download Profile
              </button>
            )}
          </aside>
        )}

        {/* Show sidebar button — visible when sidebar is hidden */}
        {isOverview && !sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            title="Show panel"
            className="mr-3 mt-1 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors self-start"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        )}

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Stats row — only on Overview */}
          {isOverview && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Users size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">{portalUserCount}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Managed under {client.name}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <DollarSign size={16} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Spends</p>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">${totalSpend.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Year to date</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-orange-50">
                    <ShoppingCart size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Open Orders</p>
                    <p className="text-2xl font-bold text-gray-900 leading-tight">{openOrders}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Active contracts</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 px-4">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                    activeTab === tab
                      ? "text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 py-2 text-xs text-gray-500">
              <span>
                Data period: <span className="font-medium text-gray-700">{formatDateRange(selectedDateRange)}</span>
              </span>
              {!validDateRange && (
                <span className="text-red-500">Select a valid start and end date.</span>
              )}
            </div>
          </div>

          {/* Non-overview tab content */}
          {!isOverview && (
            <div className="bg-white rounded-xl border border-gray-200 flex-1">
              {activeTab === "Roles" ? <RolesPage />
                : activeTab === "Users" ? <UsersPage clientId={clientId} clientName={client.name} />
                : activeTab === "Orders" ? <OrdersPage clientId={clientId} clientName={client.name} dateRange={selectedDateRange} />
                : activeTab === "Services" ? <ServicesPage clientId={clientId} dateRange={selectedDateRange} />
                : activeTab === "Contracts" ? (
                  <ContractsPage
                    clientId={clientId}
                    contractId={liveContract?.contractId || ""}
                    contractTitle={liveContract?.contractTitle || "Client Contract"}
                    clientName={client.name}
                    clientContactName={client.rep || client.contact_person || ""}
                    clientEmail={client.email || ""}
                    clientPhone={client.phone || client.mobile || ""}
                    clientGstin={client.gstin || client.gstin_number || ""}
                    clientAddress={address}
                    contractStartDate={client.contractStartDate || client.contract_start_date || ""}
                    contractEndDate={client.contractEndDate || client.contract_end_date || ""}
                    clientCurrency={client.currency || ""}
                    clientPaymentTerms={client.payment_terms || ""}
                    clientStatus={client.status || ""}
                    onBack={() => setActiveTab("Overview")}
                  />
                )
                : activeTab === "Catalog" ? <CatalogPage clientId={clientId || "CLI-DEFAULT"} />
                : activeTab === "Activity" ? <ActivityPage clientId={clientId} />
                : activeTab === "Configuration" ? <ConfigurationPage clientId={clientId || "CLI-DEFAULT"} />
                : activeTab === "Documents" ? <DocumentsPage clientId={clientId} />
                : <PlaceholderPage tab={activeTab} />}
            </div>
          )}

          {/* Overview panels */}
          {isOverview && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {/* Company Details */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-4">Company Details</h3>
                  <div className="flex flex-col gap-3 text-xs text-gray-700">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400 shrink-0" />
                      <span>{client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <span>{client.category || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-gray-400 shrink-0" />
                      <span>{client.tier ? `${client.tier} tier` : "—"}</span>
                    </div>
                    {client.website && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-400">Website</span>
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-gray-400 shrink-0" />
                          <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate">{client.website}</a>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400">Contact Person</span>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-gray-400 shrink-0" />
                        <span>{client.contact_person || client.rep || "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400">Phone</span>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400 shrink-0" />
                        <span>{client.phone || "—"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-400">Billing Email</span>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400 shrink-0" />
                        {client.email ? (
                          <a href={`mailto:${client.email}`} className="text-blue-500 hover:underline truncate">{client.email}</a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spending Overview */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">Spending Overview</h3>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPeriodPicker((visible) => !visible)}
                        className="flex items-center gap-1 text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {periodPreset === "thisYear" ? "This Year" : "Custom"}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {showPeriodPicker && (
                        <div className="absolute right-0 top-8 z-30 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                          <div className="flex gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => {
                                setPeriodPreset("thisYear");
                                setShowPeriodPicker(false);
                              }}
                              className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${periodPreset === "thisYear" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                              This Year
                            </button>
                            <button
                              type="button"
                              onClick={() => setPeriodPreset("custom")}
                              className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${periodPreset === "custom" ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                              Custom
                            </button>
                          </div>
                          {periodPreset === "custom" && (
                            <div className="space-y-2">
                              <label className="block text-xs text-gray-600">
                                Start date
                                <input
                                  type="date"
                                  value={customStartDate}
                                  onChange={(event) => setCustomStartDate(event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                                />
                              </label>
                              <label className="block text-xs text-gray-600">
                                End date
                                <input
                                  type="date"
                                  value={customEndDate}
                                  min={customStartDate || undefined}
                                  onChange={(event) => setCustomEndDate(event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                                />
                              </label>
                              {!validDateRange && (
                                <p className="text-[11px] text-red-500">End date must be on or after the start date.</p>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowPeriodPicker(false)}
                                disabled={!validDateRange}
                                className="w-full rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Apply Date Range
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">${totalSpend.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mb-1">{formatDateRange(selectedDateRange)}</p>
                  <p className="text-xs text-green-500 font-medium mb-3">+12.5% vs last year</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={monthlySpend} barSize={10} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                      <Tooltip
                        formatter={(v: number) => [`$${v.toLocaleString()}`, "Spend"]}
                        contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Top Spend Categories */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-4">Top Spend Categories</h3>
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      <DonutChart categories={spendCategories} size={100} />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {spendCategories.map((cat) => (
                        <div key={cat.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-gray-600">{cat.name} {cat.value}%</span>
                          </div>
                          <span className="text-gray-800 font-medium">{cat.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div className="grid grid-cols-3 gap-4">
                {/* User Summary */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users size={15} className="text-gray-400" />
                      <h3 className="font-semibold text-gray-900 text-sm">User Summary</h3>
                    </div>
                    <button onClick={() => setActiveTab("Users")} className="hover:text-blue-500 transition-colors">
                      <ChevronRight size={15} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <Users size={22} className="text-gray-300 mb-1" />
                      <p className="text-2xl font-bold text-gray-900">{portalUserCount}</p>
                      <p className="text-xs text-gray-400">Total Users</p>
                    </div>
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={15} className="text-gray-400" />
                      <h3 className="font-semibold text-gray-900 text-sm">Recent Orders</h3>
                    </div>
                    <button onClick={() => setActiveTab("Orders")} className="hover:text-blue-500 transition-colors">
                      <ChevronRight size={15} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <ShoppingCart size={22} className="text-gray-300 mb-1" />
                      <p className="text-2xl font-bold text-gray-900">{openOrders}</p>
                      <p className="text-xs text-gray-400">Open Orders</p>
                    </div>
                  </div>
                </div>

                {/* Active Services */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-gray-400" />
                      <h3 className="font-semibold text-gray-900 text-sm">Active Services</h3>
                    </div>
                    <button onClick={() => setActiveTab("Services")} className="hover:text-blue-500 transition-colors">
                      <ChevronRight size={15} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <FileText size={22} className="text-gray-300 mb-1" />
                      <p className="text-2xl font-bold text-gray-900">{activeServiceCount}</p>
                      <p className="text-xs text-gray-400">Active Services</p>
                    </div>
                    <div className="pb-1">
                      <p className="text-xl font-bold text-blue-500">{daysLeft} days</p>
                      <p className="text-xs text-gray-400">Until Renewal</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
