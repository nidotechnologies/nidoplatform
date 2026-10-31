import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Globe2,
  Headphones,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TicketCheck,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getClientForPortal, getClients, type StoredClient } from "@/lib/clientStore";
import {
  getClientActivities,
  getClientContracts,
  getClientDocuments,
  getClientOrders,
  getClientServices,
  type ClientActivityRecord,
  type ClientDocumentRecord,
  type ClientOrderRecord,
  type ClientServiceRecord,
} from "@/lib/clientDataStore";
import { getClientCatalog, type ClientCatalogEntry } from "@/lib/clientCatalogStore";
import { getInvoices, type StoredInvoice } from "@/lib/invoiceStore";
import { getSupportTickets, type SupportTicket } from "@/lib/supportTicketStore";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import { belongsToPortalUser, invoiceBelongsToPortalUser } from "@/lib/clientDashboardScoping";
import RolesPage from "./ClientRolesPage";
import UsersPage from "./ClientUsersPage";
import OrdersPage from "./ClientOrdersPage";
import ServicesPage from "./ClientServicesPage";
import CatalogPage from "./ClientCatalogPage";
import ActivityPage from "./ClientActivityPage";
import ConfigurationPage from "./ClientConfigurationPage";
import ContractsPage from "./ClientContractsPage";
import DocumentsPage from "./ClientDocumentsPage";
import { usePermissions } from "@/contexts/PermissionsContext";
import { getPlatformModuleForPath } from "@/lib/platformModuleCatalog";

const ADMIN_TABS = [
  "Overview",
  "Roles",
  "Users",
  "Orders",
  "Services",
  "Contracts",
  "Catalog",
  "Activity",
  "Configuration",
  "Documents",
];

const PERIODS = ["Year", "Month", "Week", "Day"] as const;
type Period = (typeof PERIODS)[number] | "Custom";

function initialsFor(client: StoredClient): string {
  return client.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function dateValue(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

type ClientDateRange = { start: string; end: string };

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDate(value?: string): string {
  const raw = value?.trim() || "";
  const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function isDateInRange(value: string | undefined, range: ClientDateRange): boolean {
  const date = normalizeDate(value);
  return Boolean(range.start && range.end && range.start <= range.end && date >= range.start && date <= range.end);
}

function overlapsDateRange(startValue: string | undefined, endValue: string | undefined, range: ClientDateRange): boolean {
  const start = normalizeDate(startValue);
  const end = normalizeDate(endValue || startValue);
  return Boolean(range.start && range.end && range.start <= range.end && start && end && start <= range.end && end >= range.start);
}

function getPeriodRange(period: Period, customStart: string, customEnd: string): ClientDateRange {
  if (period === "Custom") return { start: customStart, end: customEnd };

  const end = new Date();
  const start = new Date(end);
  if (period === "Year") start.setMonth(0, 1);
  if (period === "Month") start.setMonth(end.getMonth() - 1);
  if (period === "Week") start.setDate(end.getDate() - 7);
  if (period === "Day") start.setDate(end.getDate() - 1);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
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

function formatMoney(value: number, currency?: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  return `${symbol}${Math.round(value).toLocaleString("en-IN")}`;
}

interface DashboardProduct {
  productCode: string;
  name: string;
  category: string;
  price: string;
  availability: string;
  quantity: number;
}

function getProductsFromOrders(orders: ClientOrderRecord[], currency?: string): DashboardProduct[] {
  const products = new Map<string, DashboardProduct>();
  for (const order of orders) {
    for (const item of order.productDetails || []) {
      const name = item.name.trim();
      if (!name) continue;
      const key = (item.productCode || item.id || name).trim().toLowerCase();
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const existing = products.get(key);
      if (existing) {
        existing.quantity += quantity;
        existing.availability = String(existing.quantity);
        continue;
      }
      const priceNum = Number(item.priceNum) || 0;
      products.set(key, {
        productCode: item.productCode || item.id || key,
        name,
        category: item.category || "",
        price: priceNum > 0 ? formatMoney(priceNum, currency) : "—",
        availability: String(quantity),
        quantity,
      });
    }
  }
  return Array.from(products.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

function orderStatusGroup(status: string): "Completed" | "Processing" | "Awaiting Payment" | "Cancelled" {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("complete") || normalized.includes("deliver")) return "Completed";
  if (normalized.includes("payment") || normalized.includes("pending") || normalized.includes("overdue")) return "Awaiting Payment";
  return "Processing";
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.length > 1 ? values : [0, 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const polyline = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 34" className="h-9 w-full overflow-visible" aria-hidden="true">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  change,
  positive = true,
  icon,
  color,
  values,
  onClick,
}: {
  label: string;
  value: string | number;
  change: string;
  positive?: boolean;
  icon: React.ReactNode;
  color: string;
  values: number[];
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.02)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold text-gray-500">{label}</span>
          <span className="mt-0.5 block text-xl font-bold leading-6 text-gray-900">{value}</span>
          <span className={`mt-1 block text-[10px] font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
            {positive ? "↑" : "↓"} {change} <span className="font-normal text-gray-400">vs last 30 days</span>
          </span>
        </span>
      </div>
      <div className="mt-2">
        <Sparkline values={values} color={positive ? "#7c3aed" : "#f59e0b"} />
      </div>
    </button>
  );
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-3.5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-8 text-center text-xs text-gray-400">{message}</div>;
}

function NotFound({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <BriefcaseBusiness size={25} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Client not found</h2>
      <p className="text-sm text-gray-400">No client with ID {id} exists.</p>
      <button type="button" onClick={() => navigate("/clients")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Back to Clients
      </button>
    </div>
  );
}

interface ClientDetailProps {
  portalMode?: boolean;
}

export default function ClientDetailPageRedesigned({ portalMode = false }: ClientDetailProps) {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { hasRoutePermission } = usePermissions();
  const navigate = useNavigate();
  const clientId = portalMode ? user?.clientId?.trim() ?? "" : params.id ?? "";
  const [activeTab, setActiveTab] = useState("Overview");
  const [period, setPeriod] = useState<Period>("Year");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const client = portalMode
    ? getClientForPortal(clientId)
    : getClients().find((item) => item.id === clientId);
  const [orders, setOrders] = useState<ClientOrderRecord[]>(() => getClientOrders(clientId, client?.name));
  const [services, setServices] = useState<ClientServiceRecord[]>(() => getClientServices(clientId));
  const [activities, setActivities] = useState<ClientActivityRecord[]>(() => getClientActivities(clientId));
  const [documents, setDocuments] = useState<ClientDocumentRecord[]>(() => getClientDocuments(clientId));
  const [catalog, setCatalog] = useState<ClientCatalogEntry[]>(() => getClientCatalog(clientId));
  const [contracts, setContracts] = useState(() => getClientContracts(clientId));
  const [invoices, setInvoices] = useState<StoredInvoice[]>(() => getInvoices());
  const [tickets, setTickets] = useState<SupportTicket[]>(() => getSupportTickets());
  const [portalUsers, setPortalUsers] = useState(() => getPortalUsersByClient(clientId));

  useEffect(() => {
    const reload = () => {
      setOrders(getClientOrders(clientId, client?.name));
      setServices(getClientServices(clientId));
      setActivities(getClientActivities(clientId));
      setDocuments(getClientDocuments(clientId));
      setCatalog(getClientCatalog(clientId));
      setContracts(getClientContracts(clientId));
      setInvoices(getInvoices());
      setTickets(getSupportTickets());
      setPortalUsers(getPortalUsersByClient(clientId));
      setRefreshKey((value) => value + 1);
    };
    reload();
    const events = [
      "nidoClientDataUpdated",
      "nidoClientsUpdated",
      "clientCatalogUpdated",
      "catalogUpdated",
      "nidoInvoicesUpdated",
      "supportTicketsUpdated",
      "nidoPortalUsersUpdated",
    ] as const;
    events.forEach((event) => window.addEventListener(event, reload));
    const onStorage = (event: StorageEvent) => {
      // Custom events keep same-tab screens in sync. The storage listener
      // covers the owner platform and portal when they are open in separate
      // tabs or windows.
      if (
        event.key === null ||
        event.key === "nido_my_orders" ||
        event.key === "nido_client_orders_v1" ||
        event.key === "nido_client_services_v1" ||
        event.key === "nido_client_activities_v1" ||
        event.key === "nido_client_documents_v1" ||
        event.key === "nido_client_contracts_v1" ||
        event.key === "nido_client_catalogs" ||
        event.key === "nido_sales_invoices" ||
        event.key === "nido_support_tickets" ||
        event.key === "nido_portal_users"
      ) {
        reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((event) => window.removeEventListener(event, reload));
      window.removeEventListener("storage", onStorage);
    };
  }, [clientId, client?.name]);

  const selectedDateRange = useMemo(
    () => getPeriodRange(period, customStartDate, customEndDate),
    [customEndDate, customStartDate, period],
  );
  const validDateRange = Boolean(
    selectedDateRange.start &&
    selectedDateRange.end &&
    selectedDateRange.start <= selectedDateRange.end,
  );
  const dashboardOrders = useMemo(
    () => portalMode
      ? orders.filter((order) => belongsToPortalUser(order, user, portalUsers))
      : orders,
    [orders, portalMode, portalUsers, user],
  );
  const periodOrders = useMemo(
    () => validDateRange ? dashboardOrders.filter((order) => isDateInRange(order.date, selectedDateRange)) : [],
    [dashboardOrders, selectedDateRange, validDateRange],
  );

  if (!client) return <NotFound id={clientId} />;

  const currency = client.currency;
  const clientInvoices = invoices.filter((invoice) => {
    const belongsToClient = invoice.clientId
      ? invoice.clientId === clientId
      : invoice.clientName.trim().toLowerCase() === client.name.trim().toLowerCase();
    return belongsToClient && (
      !portalMode || invoiceBelongsToPortalUser(invoice, dashboardOrders, user, portalUsers)
    );
  });
  const periodInvoices = validDateRange
    ? clientInvoices.filter((invoice) => isDateInRange(invoice.invoiceDate, selectedDateRange))
    : [];
  const clientTickets = tickets.filter((ticket) => {
    const record = ticket as SupportTicket & { clientId?: string; clientName?: string };
    const belongsToClient = record.clientId
      ? record.clientId === clientId
      : record.clientName
        ? record.clientName.trim().toLowerCase() === client.name.trim().toLowerCase()
        : !portalMode;
    return belongsToClient && (
      !portalMode || belongsToPortalUser(record, user, portalUsers)
    );
  });
  const periodTickets = validDateRange
    ? clientTickets.filter((ticket) => isDateInRange(ticket.created, selectedDateRange))
    : [];
  const totalSpend = periodOrders.reduce((sum, order) => sum + Number(order.amountNum || 0), 0);
  const dashboardServices = portalMode
    ? services.filter((service) => belongsToPortalUser(service, user, portalUsers))
    : services;
  const activeServices = dashboardServices.filter((service) => service.status.toLowerCase() === "active" && overlapsDateRange(service.startDate, service.endDate, selectedDateRange));
  const pendingInvoices = periodInvoices.filter((invoice) => !["Paid", "Cancelled"].includes(invoice.status));
  const unpaidAmount = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
  const statusCounts = (["Completed", "Processing", "Awaiting Payment", "Cancelled"] as const).map((status) => ({
    status,
    count: periodOrders.filter((order) => orderStatusGroup(order.status) === status).length,
  }));
  const totalStatusCount = Math.max(periodOrders.length, 1);
  const recentOrders = [...periodOrders].sort((a, b) => dateValue(b.date) - dateValue(a.date)).slice(0, 5);
  const personalProducts = portalMode ? getProductsFromOrders(periodOrders, currency) : [];
  const topProducts = portalMode
    ? personalProducts.slice(0, 5)
    : catalog.slice(0, 5).map((product) => ({
        productCode: product.productCode,
        name: product.name,
        category: product.category,
        price: product.price,
        availability: product.availability,
        quantity: 0,
      }));
  const startDate = client.contractStartDate || client.contract_start_date;
  const contractStart = startDate ? new Date(startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A";
  const address = [client.billingAddress || client.billing_address, client.billingCity || client.billing_city, client.billingState || client.billing_state, client.billingPincode || client.billing_pincode].filter(Boolean).join(", ");
  const initials = initialsFor(client);
  const currentPortalUser = portalUsers.find((portalUser) => portalUser.id === user?.id);
  const profileEmail = portalMode
    ? currentPortalUser?.email || user?.email || ""
    : client.email || "";
  const detailsPhone = currentPortalUser?.details?.phone;
  const profilePhone = portalMode
    ? currentPortalUser?.phone || (typeof detailsPhone === "string" ? detailsPhone : "")
    : client.phone || client.mobile || "";
  const formatDate = (value: string) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const visibleAdminTabs = ADMIN_TABS.filter(tab => {
    if (tab === "Overview") return true;
    const module = getPlatformModuleForPath(
      tab === "Contracts" ? `/clients/${clientId}/contracts` : `/clients/${tab.toLowerCase()}`,
    );
    return module
      ? hasRoutePermission(module.key, module.legacyKey, "view")
      : hasRoutePermission("clients", "clients", "view");
  });
  const goTo = (tab: string) => {
    if (portalMode) {
      const portalPaths: Record<string, string> = {
        Catalog: "/portal/catalog",
        Orders: "/portal/orders",
        Services: "/portal/services",
        Contracts: "/portal/contracts",
        Documents: "/portal/invoices",
        Users: "/portal/users",
      };
      const path = portalPaths[tab];
      if (path) navigate(path);
      return;
    }
    if (visibleAdminTabs.includes(tab) || tab === "Overview") setActiveTab(tab);
  };
  const openOverviewLink = (path: string, tab: string) => {
    if (portalMode) navigate(path);
    else goTo(tab);
  };

  const renderTab = () => {
    if (activeTab === "Roles") return <RolesPage key={`${clientId}-${refreshKey}-roles`} />;
    if (activeTab === "Users") return <UsersPage key={`${clientId}-${refreshKey}-users`} clientId={clientId} clientName={client.name} />;
    if (activeTab === "Orders") return <OrdersPage key={`${clientId}-${refreshKey}-orders`} clientId={clientId} clientName={client.name} dateRange={selectedDateRange} />;
    if (activeTab === "Services") return <ServicesPage key={`${clientId}-${refreshKey}-services`} clientId={clientId} dateRange={selectedDateRange} />;
    if (activeTab === "Contracts") {
      return (
        <ContractsPage
          key={`${clientId}-contracts`}
        />
      );
    }
    // ClientCatalogPage persists its own edits and emits clientCatalogUpdated.
    // Do not key it by refreshKey: the parent listens to that same event, and
    // remounting the catalog here would save on mount, emit again, and create
    // an update loop that prevents the row action menu from responding.
    if (activeTab === "Catalog") return <CatalogPage key={`${clientId}-catalog`} clientId={clientId} />;
    if (activeTab === "Activity") return <ActivityPage key={`${clientId}-${refreshKey}-activity`} clientId={clientId} />;
    // Configuration owns nested tabs and editable form state. Do not key it by
    // refreshKey: saving a pricing field can refresh the client catalog, which
    // updates refreshKey and would otherwise remount Configuration back on
    // its default General tab.
    if (activeTab === "Configuration") return <ConfigurationPage clientId={clientId} />;
    if (activeTab === "Documents") return <DocumentsPage key={`${clientId}-${refreshKey}-documents`} clientId={clientId} />;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-gray-900">
      <div className="border-b border-gray-200 bg-white px-3 sm:px-5">
        <div className={`flex ${activeTab === "Contracts" ? "w-full flex-wrap items-center gap-x-1" : "items-center gap-1 overflow-x-auto"}`}>
          {(portalMode ? ["Overview"] : visibleAdminTabs).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative whitespace-nowrap font-semibold transition-colors ${activeTab === "Contracts" ? "flex min-w-[84px] flex-1 items-center justify-center px-2 py-2.5 text-center text-[10px]" : "px-3 py-3 text-[11px]"} ${activeTab === tab ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
            >
              {tab}
              {activeTab === tab && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-t-full bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>

      {activeTab !== "Overview" ? (
        <div className="p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">{client.id}</p>
              <h1 className="text-xl font-bold">{client.name}</h1>
            </div>
            <button type="button" onClick={() => setActiveTab("Overview")} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
              <ArrowRight size={13} className="rotate-180" /> Overview
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">{renderTab()}</div>
        </div>
      ) : (
        <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 lg:px-7">
          <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome back, {portalMode ? user?.name || "there" : client.name}! <span aria-hidden="true">👋</span></h1>
              <p className="mt-1 text-xs text-gray-500">Here's what's happening with your account today.</p>
            </div>
          </header>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-2 text-[10px] font-semibold text-gray-500">Time Period</span>
            {PERIODS.map((item) => (
              <button key={item} type="button" onClick={() => { setPeriod(item); setShowCustomPicker(false); }} className={`rounded-md border px-4 py-2 text-[10px] font-semibold ${period === item ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                {item}
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setPeriod("Custom"); setShowCustomPicker((visible) => !visible); }}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[10px] font-semibold ${period === "Custom" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Custom <CalendarDays size={12} />
              </button>
              {showCustomPicker && (
                <div className="absolute left-0 top-10 z-30 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                  <p className="mb-2 text-[10px] font-semibold text-gray-700">Choose a date range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-gray-500">
                      Start date
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(event) => { setCustomStartDate(event.target.value); setPeriod("Custom"); }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                      />
                    </label>
                    <label className="text-[10px] text-gray-500">
                      End date
                      <input
                        type="date"
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(event) => { setCustomEndDate(event.target.value); setPeriod("Custom"); }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                      />
                    </label>
                  </div>
                  {!validDateRange && <p className="mt-2 text-[10px] text-red-500">Choose a valid start and end date.</p>}
                  <button
                    type="button"
                    onClick={() => setShowCustomPicker(false)}
                    disabled={!validDateRange}
                    className="mt-3 w-full rounded-lg bg-blue-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Apply Date Range
                  </button>
                </div>
              )}
            </div>
            {period !== "Year" && <button type="button" onClick={() => { setPeriod("Year"); setCustomStartDate(""); setCustomEndDate(""); setShowCustomPicker(false); }} className="ml-1 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Reset period"><RefreshCw size={13} /></button>}
          </div>
          <p className={`mt-2 text-[10px] ${validDateRange ? "text-gray-500" : "text-red-500"}`}>
            Data shown below: <span className="font-semibold">{formatDateRange(selectedDateRange)}</span>
          </p>

           <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
             <MetricCard label="Total Orders" value={periodOrders.length} change={`${periodOrders.length ? 100 : 0}%`} icon={<ShoppingCart size={18} className="text-violet-600" />} color="bg-violet-50" values={periodOrders.map((_, i) => i + 1)} onClick={() => openOverviewLink("/portal/orders", "Orders")} />
             <MetricCard label="Total Spent" value={formatMoney(totalSpend, currency)} change={`${totalSpend ? 100 : 0}%`} icon={<CircleDollarSign size={19} className="text-emerald-600" />} color="bg-emerald-50" values={periodOrders.map((order) => order.amountNum)} positive={true} onClick={() => openOverviewLink("/portal/reports", "Orders")} />
              <MetricCard label="Products" value={portalMode ? personalProducts.length : catalog.length} change={`${(portalMode ? personalProducts.length : catalog.length) ? 100 : 0}%`} icon={<Package size={18} className="text-blue-600" />} color="bg-blue-50" values={portalMode ? personalProducts.map((product) => product.quantity) : catalog.map((_, i) => i + 1)} onClick={() => openOverviewLink("/portal/catalog", "Catalog")} />
             <MetricCard label="Invoices" value={periodInvoices.length} change={`${periodInvoices.length ? 100 : 0}%`} icon={<Receipt size={18} className="text-orange-600" />} color="bg-orange-50" values={periodInvoices.map((invoice) => invoice.grandTotal)} positive={false} onClick={() => openOverviewLink("/portal/invoices", "Documents")} />
              <MetricCard label="Open Support Tickets" value={periodTickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status.toLowerCase())).length} change={`${periodTickets.length ? 100 : 0}%`} icon={<Headphones size={18} className="text-violet-600" />} color="bg-violet-50" values={periodTickets.map((_, i) => i + 1)} onClick={() => openOverviewLink("/portal/support", "Overview")} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Panel title="Company Information" action={<span className="rounded bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-600">{client.status || "Active"}</span>}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold text-violet-700">{client.client_logo_url ? <img src={client.client_logo_url} alt="" className="h-full w-full rounded-full object-cover" /> : initials}</div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900">{client.name}</p>
                  <p className="mt-1 text-[10px] text-gray-500">Client since {contractStart}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-[10px] text-gray-600">
                 <a href={profileEmail ? `mailto:${profileEmail}` : undefined} className="flex items-center gap-2 truncate hover:text-blue-600"><Mail size={12} className="shrink-0 text-gray-400" />{profileEmail || "No email available"}</a>
                 <a href={profilePhone ? `tel:${profilePhone}` : undefined} className="flex items-center gap-2 hover:text-blue-600"><Phone size={12} className="shrink-0 text-gray-400" />{profilePhone || "No phone available"}</a>
                <span className="flex items-start gap-2"><MapPin size={12} className="mt-0.5 shrink-0 text-gray-400" />{address || "No billing address available"}</span>
                {client.website && <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-blue-600 hover:underline"><Globe2 size={12} className="shrink-0" />{client.website}</a>}
              </div>
                <button type="button" onClick={() => portalMode ? navigate("/portal/profile") : goTo("Contracts")} className="mt-4 w-full rounded border border-violet-200 bg-violet-50 py-1.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100">
                View Contracts
              </button>
            </Panel>

             <Panel title="Orders Overview" action={!portalMode && <button type="button" onClick={() => goTo("Orders")} className="text-[10px] font-semibold text-violet-700 hover:underline">View All Orders</button>}>
              <div className="flex min-h-[138px] items-center gap-4">
                <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#10b981 0 ${((statusCounts[0].count / totalStatusCount) * 100)}%, #2563eb ${((statusCounts[0].count / totalStatusCount) * 100)}% ${((statusCounts[0].count + statusCounts[1].count) / totalStatusCount) * 100}%, #f59e0b ${((statusCounts[0].count + statusCounts[1].count) / totalStatusCount) * 100}% ${((statusCounts[0].count + statusCounts[1].count + statusCounts[2].count) / totalStatusCount) * 100}%, #7c3aed ${((statusCounts[0].count + statusCounts[1].count + statusCounts[2].count) / totalStatusCount) * 100}% 100%)` }}>
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white"><span className="text-xl font-bold">{periodOrders.length}</span><span className="text-[9px] text-gray-500">Total Orders</span></div>
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-[10px]">
                  {statusCounts.map((item, index) => {
                    const colors = ["bg-emerald-500", "bg-blue-600", "bg-orange-500", "bg-violet-600"];
                    return <div key={item.status} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-gray-600"><i className={`h-2 w-2 rounded-full ${colors[index]}`} />{item.status}</span><strong>{item.count} <span className="font-normal text-gray-400">({Math.round((item.count / totalStatusCount) * 100)}%)</span></strong></div>;
                  })}
                </div>
              </div>
            </Panel>

             <Panel title="Account Summary" action={!portalMode && <button type="button" onClick={() => goTo("Documents")} className="text-[10px] font-semibold text-violet-700 hover:underline">View All Invoices</button>}>
              <div className="space-y-2.5 text-[10px]">
                 {!portalMode && <button type="button" onClick={() => goTo("Contracts")} className="flex w-full items-center justify-between border-b border-gray-100 pb-2 text-left hover:text-blue-600"><span className="flex items-center gap-2"><BriefcaseBusiness size={14} className="text-violet-600" />Contracts</span><strong>{contracts.length}</strong></button>}
                <button type="button" onClick={() => goTo("Services")} className="flex w-full items-center justify-between border-b border-gray-100 pb-2 text-left hover:text-blue-600"><span className="flex items-center gap-2"><Wrench size={14} className="text-violet-600" />Active Services</span><strong>{activeServices.length}</strong></button>
                <button type="button" onClick={() => goTo("Documents")} className="flex w-full items-center justify-between border-b border-gray-100 pb-2 text-left hover:text-blue-600"><span className="flex items-center gap-2"><FileText size={14} className="text-orange-500" />Pending Invoices</span><strong>{pendingInvoices.length}</strong></button>
                <button type="button" onClick={() => goTo("Documents")} className="flex w-full items-center justify-between text-left hover:text-blue-600"><span className="flex items-center gap-2"><CircleDollarSign size={14} className="text-red-500" />Unpaid Amount</span><strong className="text-red-500">{formatMoney(unpaidAmount, currency)}</strong></button>
              </div>
            </Panel>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
             <Panel title="Top Products" action={!portalMode && <button type="button" onClick={() => goTo("Catalog")} className="text-[10px] font-semibold text-violet-700 hover:underline">View All Products</button>} className="overflow-hidden">
               {topProducts.length === 0 ? <EmptyState message={portalMode ? "No products in your orders during this period." : "No products have been assigned to this client yet."} /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-left text-[10px]">
                     <thead className="border-b border-gray-100 text-[9px] text-gray-500"><tr><th className="pb-2 font-semibold">Product</th><th className="pb-2 font-semibold">Category</th><th className="pb-2 font-semibold">Price</th><th className="pb-2 text-right font-semibold">{portalMode ? "Qty Ordered" : "Stock"}</th></tr></thead>
                     <tbody>{topProducts.map((product) => <tr key={product.productCode} onClick={() => goTo("Catalog")} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"><td className="py-2 font-semibold text-gray-800">{product.name}</td><td className="py-2 text-gray-500">{product.category || "—"}</td><td className="py-2 font-semibold text-gray-800">{product.price || "—"}</td><td className="py-2 text-right font-semibold text-emerald-600">{product.availability || "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Panel>

             <Panel title="Recent Orders" action={!portalMode && <button type="button" onClick={() => goTo("Orders")} className="text-[10px] font-semibold text-violet-700 hover:underline">View All Orders</button>} className="overflow-hidden">
              {recentOrders.length === 0 ? <EmptyState message="No orders found for this client in the selected period." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[470px] text-left text-[10px]">
                    <thead className="border-b border-gray-100 text-[9px] text-gray-500"><tr><th className="pb-2 font-semibold">Order ID</th><th className="pb-2 font-semibold">Date</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 text-right font-semibold">Total</th><th /></tr></thead>
                    <tbody>{recentOrders.map((order) => <tr key={order.id} onClick={() => goTo("Orders")} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"><td className="py-2 font-semibold text-gray-800">{order.id}</td><td className="py-2 text-gray-500">{formatDate(order.date)}</td><td className="py-2"><span className={`rounded px-1.5 py-1 text-[9px] font-semibold ${orderStatusGroup(order.status) === "Completed" ? "bg-emerald-50 text-emerald-600" : orderStatusGroup(order.status) === "Cancelled" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"}`}>{order.status}</span></td><td className="py-2 text-right font-semibold">{order.amount || formatMoney(order.amountNum, currency)}</td><td className="py-2 text-right text-gray-400"><ChevronRight size={13} className="inline" /></td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-3">
            <h2 className="mb-2 text-xs font-bold text-gray-900">Quick Links</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
               <button type="button" onClick={() => openOverviewLink("/portal/catalog", "Catalog")} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-200 hover:shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600"><ShoppingCart size={17} /></span><span className="flex-1"><strong className="block text-[11px]">Shop Products</strong><small className="block text-[9px] text-gray-500">Browse and purchase products easily.</small></span><ChevronRight size={14} className="text-gray-400" /></button>
               <button type="button" onClick={() => openOverviewLink("/portal/services", "Services")} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-200 hover:shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Package size={17} /></span><span className="flex-1"><strong className="block text-[11px]">Quick Services</strong><small className="block text-[9px] text-gray-500">Explore and order services.</small></span><ChevronRight size={14} className="text-gray-400" /></button>
               <button type="button" onClick={() => openOverviewLink("/portal/support", "Overview")} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-200 hover:shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600"><TicketCheck size={17} /></span><span className="flex-1"><strong className="block text-[11px]">Request Support</strong><small className="block text-[9px] text-gray-500">Raise a ticket and get assistance.</small></span><ChevronRight size={14} className="text-gray-400" /></button>
               <button type="button" onClick={() => openOverviewLink("/portal/reports", "Documents")} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-200 hover:shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><FileText size={17} /></span><span className="flex-1"><strong className="block text-[11px]">Download Report</strong><small className="block text-[9px] text-gray-500">Review documents and invoices.</small></span><ChevronRight size={14} className="text-gray-400" /></button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}