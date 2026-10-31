import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Grid2X2,
  MoreVertical,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Repeat2,
  X,
  Pencil,
  Check,
  Trash2,
  List,
  FileText,
  Activity,
  StickyNote,
  Receipt,
  ShieldCheck,
  Info,
  Bell,
  Mail,
  Eye,
  Home,
} from "lucide-react";
import { getClients, isSharedClient, type StoredClient } from "@/lib/clientStore";
import { getCatalogProducts, normalizeCatalogProductName, type CatalogProduct } from "@/lib/catalogStore";
import { useMyOrders, type MyOrder } from "@/contexts/MyOrdersContext";
import { getUsers, NIDO_USERS_EVENT, type NidoUser } from "@/lib/nidoUsersStore";
import { getPortalUsers, type PortalUser } from "@/lib/portalUserStore";
import { getInvoices, type StoredInvoice } from "@/lib/invoiceStore";
import { downloadInvoicePdf } from "@/lib/invoicePdf";

type RenewalStatus = "Overdue" | "Upcoming" | "Due Soon";
type AutoRenew = "Enabled" | "Disabled";

interface Renewal {
  id: string;
  product: string;
  brand: "microsoft" | "adobe" | "vmware" | "fortinet" | "other";
  client: string;
  clientId?: string;
  licenseType: string;
  seats: string;
  dueDate: string;
  dueIn: string;
  amount: string;
  renewalStatus: RenewalStatus;
  autoRenew: AutoRenew;
  orderId?: string;
  subOrderId?: string;
  orderDate?: string;
  deliveryDate?: string;
  currentExpiryDate?: string;
  renewalStartDate?: string;
  renewalTerm?: string;
  quantity?: string;
  unitPrice?: string;
  contractNo?: string;
  purchaseOrderNo?: string;
  createdAt?: string;
  createdBy?: string;
  reminders?: string[];
  notifyTo?: string[];
  notificationMessage?: string;
  notes?: string;
}

interface RenewalNote {
  id: string;
  author: string;
  date: string;
  text: string;
  visibility: "Internal Note" | "External Note";
}

type RenewalFormValues = Pick<
  Renewal,
  "product" | "brand" | "client" | "licenseType" | "seats" | "dueDate" | "amount" | "autoRenew"
>;

type RenewalWizardValues = {
  client: string;
  order: string;
  subOrders: string[];
  product: string;
  productImage: string;
  brand: Renewal["brand"];
  licenseType: string;
  orderDate: string;
  deliveryDate: string;
  currentExpiryDate: string;
  renewalStartDate: string;
  renewalTerm: string;
  quantity: string;
  unitPrice: string;
  contractNo: string;
  purchaseOrderNo: string;
  autoRenew: boolean;
  reminders: string[];
  notifyTo: string[];
  notificationMessage: string;
  notes: string;
};

type RenewalWizardProduct = {
  name: string;
  image: string;
  productType: string;
  brand: Renewal["brand"];
  licenseType: string;
  quantity: string;
  unitPrice: string;
  currentExpiryDate: string;
  renewalStartDate: string;
  renewalTerm: string;
  contractNo: string;
  purchaseOrderNo: string;
  notes: string;
  reminders: string[];
  notifyTo: string[];
  notificationMessage: string;
};

type RenewalWizardSubOrder = {
  id: string;
  products: RenewalWizardProduct[];
  orderDate: string;
  deliveryDate: string;
};

type RenewalWizardSelectedProduct = {
  subOrderId: string;
  product: RenewalWizardProduct;
};

type RenewalWizardOrder = {
  id: string;
  clientId?: string;
  client: string;
  orderDate: string;
  deliveryDate: string;
  products: RenewalWizardProduct[];
  subOrders: RenewalWizardSubOrder[];
};

type RenewalNotificationRecipient = {
  email: string;
  label: string;
};

const TABS = [
  "Overview",
  "Calendar View",
  "Upcoming Renewals",
  "Renewal History",
  "Expiring Soon",
  "Auto Renewals",
] as const;

const LEGACY_SAMPLE_RENEWAL_SIGNATURES = new Set([
  "REN-000041|Microsoft 365 Business Standard|Nido Tech CorpEssentials",
  "REN-000042|Adobe Acrobat Pro|Cloud Systems India",
  "REN-000043|VMware vSphere Standard|InfoTech Pvt. Ltd.",
  "REN-000044|FortiGate 100F (UTM Firewall)|Apex Tech Solutions",
  "REN-000045|Microsoft Windows Server 2022 Std|Nido Tech CorpEssentials",
  "REN-000039|Microsoft 365 Business Basic|Cloud Systems India",
  "REN-000040|Adobe Creative Cloud|Apex Tech Solutions",
]);

const STATUS_STYLES: Record<RenewalStatus, string> = {
  Overdue: "bg-rose-50 text-rose-600",
  Upcoming: "bg-blue-50 text-blue-600",
  "Due Soon": "bg-amber-50 text-amber-700",
};

function BrandMark({ brand, image }: { brand: Renewal["brand"]; image?: string }) {
  if (image) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
        <img src={image} alt="" className="h-full w-full object-contain p-1" />
      </div>
    );
  }

  if (brand === "adobe") {
    return (
      <div className="flex h-5 w-5 items-center justify-center text-[#e21b2d]">
        <span className="text-[21px] font-bold leading-none">A</span>
      </div>
    );
  }

  if (brand === "fortinet") {
    return (
      <div className="grid h-5 w-5 grid-cols-2 grid-rows-2 gap-px overflow-hidden">
        <span className="bg-[#e1261c]" />
        <span className="bg-[#b6ce39]" />
        <span className="bg-[#e1261c]" />
        <span className="bg-[#b6ce39]" />
      </div>
    );
  }

  if (brand === "vmware") {
    return (
      <div className="grid h-5 w-5 grid-cols-2 grid-rows-2 gap-px overflow-hidden">
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </div>
    );
  }

  return (
    <div className="grid h-5 w-5 grid-cols-2 grid-rows-2 gap-px overflow-hidden">
      <span className="bg-[#f25022]" />
      <span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" />
      <span className="bg-[#ffb900]" />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`min-w-0 ${wide ? "sm:col-span-1" : ""}`}>
      <span className="mb-1 block text-[9px] font-semibold text-gray-600">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full appearance-none rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-[11px] text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
      </span>
    </label>
  );
}

function exportRenewals(rows: Renewal[]) {
  const headings = [
    "Renewal ID",
    "Product / License",
    "Client",
    "License Type",
    "Due Date",
    "Amount",
    "Renewal Status",
    "Auto Renew",
  ];
  const values = rows.map((row) => [
    row.id,
    row.product,
    row.client,
    `${row.licenseType} ${row.seats}`,
    row.dueDate,
    row.amount,
    row.renewalStatus,
    row.autoRenew,
  ]);
  const csv = [headings, ...values]
    .map((line) => line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "renewals.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function inputDateFromDisplayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function displayDateFromInputDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function getDueDays(row: Renewal): number {
  const match = row.dueIn.match(/(\d+)\s*days?/i);
  if (match) return row.dueIn.toLowerCase().includes("overdue") ? -Number(match[1]) : Number(match[1]);
  const dueDate = new Date(row.dueDate);
  return Number.isNaN(dueDate.getTime())
    ? Number.POSITIVE_INFINITY
    : Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function getRenewalStatus(dueDate: string): RenewalStatus {
  const dueDays = Math.ceil((new Date(`${dueDate}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (dueDays < 0) return "Overdue";
  if (dueDays <= 30) return "Upcoming";
  return "Due Soon";
}

const RENEWALS_STORAGE_KEY = "nidoRenewals";
const RENEWAL_HISTORY_STORAGE_KEY = "nidoRenewalHistory";

function readStoredRenewals(key: string): Renewal[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    const liveRenewals = parsed.filter((renewal: Renewal) =>
      !LEGACY_SAMPLE_RENEWAL_SIGNATURES.has(`${renewal.id}|${renewal.product}|${renewal.client}`),
    );
    if (liveRenewals.length !== parsed.length) {
      window.localStorage.setItem(key, JSON.stringify(liveRenewals));
    }
    return liveRenewals;
  } catch {
    return [];
  }
}

function nextRenewalId(records: Renewal[]): string {
  const highestId = records.reduce((highest, record) => {
    const match = record.id.match(/^REN-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `REN-${String(highestId + 1).padStart(6, "0")}`;
}

function RenewalFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Renewal;
  onClose: () => void;
  onSave: (values: RenewalFormValues) => void;
}) {
  const [form, setForm] = useState<RenewalFormValues>(() => ({
    product: initial?.product ?? "",
    brand: initial?.brand ?? "microsoft",
    client: initial?.client ?? "",
    licenseType: initial?.licenseType ?? "Subscription (License)",
    seats: initial?.seats ?? "1 User",
    dueDate: initial ? inputDateFromDisplayDate(initial.dueDate) : "",
    amount: initial?.amount ?? "",
    autoRenew: initial?.autoRenew ?? "Enabled",
  }));

  const update = <K extends keyof RenewalFormValues>(key: K, value: RenewalFormValues[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{initial ? "Edit Renewal" : "New Renewal"}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Keep license and subscription renewal details up to date.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Product / License</span>
            <input required value={form.product} onChange={event => update("product", event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Client</span>
            <input required value={form.client} onChange={event => update("client", event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Brand</span>
            <select value={form.brand} onChange={event => update("brand", event.target.value as Renewal["brand"])} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
              <option value="microsoft">Microsoft</option>
              <option value="adobe">Adobe</option>
              <option value="vmware">VMware</option>
              <option value="fortinet">Fortinet</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">License Type</span>
            <select value={form.licenseType} onChange={event => update("licenseType", event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
              <option>Subscription (License)</option>
              <option>Perpetual + SA (License)</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Seats / Quantity</span>
            <input required value={form.seats} onChange={event => update("seats", event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Due Date</span>
            <input required type="date" value={form.dueDate} onChange={event => update("dueDate", event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Amount</span>
            <input required value={form.amount} onChange={event => update("amount", event.target.value)} placeholder="₹0.00" className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-semibold text-gray-600">Auto Renew</span>
            <select value={form.autoRenew} onChange={event => update("autoRenew", event.target.value as AutoRenew)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100">
              <option>Enabled</option>
              <option>Disabled</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">Save Renewal</button>
        </div>
      </form>
    </div>
  );
}

function createEmptyRenewalWizardValues(): RenewalWizardValues {
  return {
  client: "",
  order: "",
  subOrders: [],
  product: "",
  productImage: "",
  brand: "other",
  licenseType: "",
  orderDate: "",
  deliveryDate: "",
  currentExpiryDate: "",
  renewalStartDate: "",
  renewalTerm: "",
  quantity: "",
  unitPrice: "",
  contractNo: "",
  purchaseOrderNo: "",
  autoRenew: false,
  reminders: [],
  notifyTo: [],
  notificationMessage: "",
  notes: "",
  };
}

function normalizeRenewalBrand(value: string | undefined): Renewal["brand"] {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("microsoft")) return "microsoft";
  if (normalized.includes("adobe")) return "adobe";
  if (normalized.includes("vmware")) return "vmware";
  if (normalized.includes("fortinet")) return "fortinet";
  return "other";
}

function formatSourceDate(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function addDaysToWizardDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sourceValue(source: unknown, keys: string[]): string {
  if (!source || typeof source !== "object") return "";
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function sourceArray(source: unknown, keys: string[]): string[] {
  const value = source && typeof source === "object"
    ? (source as Record<string, unknown>)[keys.find(key => (source as Record<string, unknown>)[key] !== undefined) || ""]
    : undefined;
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(item => item.trim()).filter(Boolean);
  return [];
}

function getSavedSubOrderState(orderId: string): Record<string, Record<string, unknown>> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(`nido_subitems_${orderId}`) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function isDeliveredOrderItem(
  order: MyOrder,
  item: NonNullable<MyOrder["cartItems"]>[number],
  subOrderId: string,
  savedSubOrderState: Record<string, Record<string, unknown>>,
): boolean {
  const itemSource = item as unknown as Record<string, unknown>;
  const savedState = savedSubOrderState[subOrderId];
  const storedStatus = String(savedState?.itemStatus || savedState?.status || itemSource.itemStatus || itemSource.status || "").toLowerCase();

  // Per-sub-order state is authoritative for partially delivered orders and
  // for an item that was changed after the master order was created.
  if (storedStatus) return storedStatus === "delivered";
  return String(order.status || "").toLowerCase() === "delivered";
}

function isRenewableOrderItem(
  item: NonNullable<MyOrder["cartItems"]>[number],
  catalogProduct?: CatalogProduct,
): boolean {
  const fulfillmentType = String(item.fulfillmentType || "").toLowerCase();
  const orderTypes = [
    item.productType,
    item.physicalType,
    item.commercialTerms?.productType,
    item.category,
  ].map(value => String(value || "").trim()).filter(Boolean);
  const isDigitalType = (value: string) =>
    /(digital|subscription|saas|cloud|software|license|virtual)/i.test(value)
    && !/(physical|hybrid|hardware|equipment)/i.test(value);

  if (fulfillmentType) {
    if (fulfillmentType !== "digital") return false;
    return !orderTypes.some(value => /(physical|hybrid|hardware|equipment)/i.test(value));
  }

  const explicitlyNonDigital = orderTypes.some(value =>
    /(physical|hybrid|hardware|equipment)/i.test(value),
  );
  if (explicitlyNonDigital) return false;
  if (orderTypes.some(isDigitalType)) return true;

  const catalogTypes = [
    catalogProduct?.productType,
    catalogProduct?.physicalType,
    catalogProduct?.category,
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  return catalogTypes.some(isDigitalType);
}

function createRenewalWizardProduct(
  item: NonNullable<MyOrder["cartItems"]>[number],
  order: MyOrder,
  catalogProduct?: CatalogProduct,
): RenewalWizardProduct {
  const itemSource = item as unknown as Record<string, unknown>;
  const orderSource = order as unknown as Record<string, unknown>;
  const valueFromItemOrOrder = (keys: string[]) =>
    sourceValue(itemSource, keys) || sourceValue(orderSource, keys);
  const reminders = sourceArray(itemSource, ["reminders", "renewalReminders"])
    .concat(sourceArray(orderSource, ["reminders", "renewalReminders"]));
  const notifyTo = sourceArray(itemSource, ["notifyTo", "renewalNotifyTo"])
    .concat(sourceArray(orderSource, ["notifyTo", "renewalNotifyTo"]));

  return {
    name: item.name,
    image: item.image || catalogProduct?.images?.[0] || "",
    productType: item.productType || catalogProduct?.productType || "",
    brand: normalizeRenewalBrand(sourceValue(itemSource, ["brand"]) || catalogProduct?.brand),
    licenseType: item.productType || catalogProduct?.productType || "",
    quantity: String(item.quantity || ""),
    unitPrice: String(item.clientSellingPriceExclGst ?? item.priceNum ?? catalogProduct?.price ?? ""),
    currentExpiryDate: formatSourceDate(valueFromItemOrOrder(["currentExpiryDate", "expiryDate", "licenseExpiryDate", "expiresOn"])),
    renewalStartDate: formatSourceDate(valueFromItemOrOrder(["renewalStartDate", "licenseStartDate", "subscriptionStartDate"])),
    renewalTerm: valueFromItemOrOrder(["renewalTerm", "licenseTerm", "subscriptionTerm", "term"]),
    contractNo: valueFromItemOrOrder(["contractNo", "contractNumber"]),
    purchaseOrderNo: order.poNumber || valueFromItemOrOrder(["purchaseOrderNo", "purchaseOrderNumber"]),
    notes: valueFromItemOrOrder(["notes", "renewalNotes"]),
    reminders: [...new Set(reminders)],
    notifyTo: [...new Set(notifyTo)],
    notificationMessage: valueFromItemOrOrder(["notificationMessage", "renewalNotificationMessage"]),
  };
}

function createRenewalWizardOrders(orders: MyOrder[], products: CatalogProduct[]): RenewalWizardOrder[] {
  return orders.map(order => {
    const orderDate = formatSourceDate(order.orderDate);
    const orderDeliveryDate = formatSourceDate(sourceValue(order, ["deliveryDate", "deliveredAt"]));
    const savedSubOrderState = getSavedSubOrderState(order.id);
    const grouped = new Map<string, RenewalWizardProduct[]>();

    (order.cartItems || []).forEach((item, index) => {
      const itemSource = item as unknown as Record<string, unknown>;
      const productCode = String(itemSource.productCode || itemSource.skuCode || itemSource.masterProductCode || "").trim().toLowerCase();
      const catalogProduct = products.find(product =>
        productCode && [product.masterProductCode, product.skuCode]
          .some(code => String(code || "").trim().toLowerCase() === productCode)
      ) || products.find(product =>
        normalizeCatalogProductName(product.productName) === normalizeCatalogProductName(item.name)
      );
      const subOrderId = item.subOrderId || `SO-${order.id}-${String(index + 1).padStart(3, "0")}`;
      if (!isDeliveredOrderItem(order, item, subOrderId, savedSubOrderState)) return;
      if (!isRenewableOrderItem(item, catalogProduct)) return;
      const product = createRenewalWizardProduct(item, order, catalogProduct);
      grouped.set(subOrderId, [...(grouped.get(subOrderId) || []), product]);
    });

    const subOrders: RenewalWizardSubOrder[] = Array.from(grouped.entries()).map(([id, subOrderProducts]) => ({
      id,
      products: subOrderProducts,
      orderDate,
      deliveryDate: orderDeliveryDate,
    }));

    return {
      id: order.id,
      clientId: order.clientId,
      client: order.client,
      orderDate,
      deliveryDate: orderDeliveryDate,
      products: subOrders.flatMap(subOrder => subOrder.products),
      subOrders,
    };
  }).filter(order => order.subOrders.length > 0);
}

function createInitialRenewalWizardValues(): RenewalWizardValues {
  return createEmptyRenewalWizardValues();
}

function commonProductValue(
  products: RenewalWizardProduct[],
  readValue: (product: RenewalWizardProduct) => string,
): string {
  const values = [...new Set(products.map(readValue).filter(Boolean))];
  return values.length === 1 ? values[0] : "";
}

function renewalProductQuantity(
  product: RenewalWizardProduct,
  values: RenewalWizardValues,
  selectedProductCount: number,
): string {
  return selectedProductCount === 1 && values.quantity
    ? values.quantity
    : product.quantity || values.quantity;
}

function renewalProductUnitPrice(
  product: RenewalWizardProduct,
  values: RenewalWizardValues,
  selectedProductCount: number,
): string {
  return selectedProductCount === 1 && values.unitPrice
    ? values.unitPrice
    : product.unitPrice || values.unitPrice;
}

function wizardDateLabel(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function wizardNextExpiryDate(startDate: string, term: string): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const years = Number.parseInt(term, 10);
  if (!year || !month || !day || !years) return "";
  const expiry = new Date(year + years, month - 1, day);
  expiry.setDate(expiry.getDate() - 1);
  return `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, "0")}-${String(expiry.getDate()).padStart(2, "0")}`;
}

function renewalTermYears(term: string): number {
  return Number.parseInt(term, 10) || 0;
}

function WizardCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function WizardField({
  label,
  required = false,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-gray-600">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function WizardInput({
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={event => onChange?.(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 read-only:bg-gray-50"
    />
  );
}

function WizardSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-800 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </span>
  );
}

function SubOrderMultiSelect({
  options,
  selectedIds,
  onChange,
}: {
  options: RenewalWizardSubOrder[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}) {
  const toggle = (subOrderId: string) => {
    onChange(selectedIds.includes(subOrderId)
      ? selectedIds.filter(id => id !== subOrderId)
      : [...selectedIds, subOrderId]);
  };

  if (!options.length) {
    return (
      <button type="button" disabled className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-sm text-gray-400">
        Select an order first
      </button>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-100">
        <span>{selectedIds.length ? `${selectedIds.length} sub-order${selectedIds.length === 1 ? "" : "s"} selected` : "Select sub-orders"}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div role="group" aria-label="Available digital sub-orders" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
        {options.map(subOrder => (
          <label key={subOrder.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-blue-50">
            <input
              type="checkbox"
              checked={selectedIds.includes(subOrder.id)}
              onChange={() => toggle(subOrder.id)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-800">{subOrder.id}</span>
              <span className="block truncate text-xs text-gray-500">{subOrder.products.map(product => product.name).join(", ")}</span>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

function RenewalWizardStepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = ["Select Order & Product", "Renewal Details", "Notifications", "Review & Create"];
  return (
    <div className="mb-5 grid grid-cols-4 gap-2">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = number < step;
        const active = number === step;
        return (
          <div key={label} className="flex min-w-0 items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              complete || active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {complete ? <Check className="h-4 w-4" /> : number}
            </span>
            <span className={`hidden truncate text-xs sm:block ${active ? "font-semibold text-blue-700" : "text-gray-500"}`}>{label}</span>
            {number < 4 && <span className={`hidden h-px flex-1 sm:block ${complete ? "bg-blue-300" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function RenewalProductSummary({
  values,
  nextExpiryDate,
  selectedProducts,
  showOrderDetails = true,
}: {
  values: RenewalWizardValues;
  nextExpiryDate: string;
  selectedProducts: RenewalWizardSelectedProduct[];
  showOrderDetails?: boolean;
}) {
  const commonTerm = values.renewalTerm || commonProductValue(
    selectedProducts.map(item => item.product),
    product => product.renewalTerm,
  );
  const estimatedAmount = selectedProducts.reduce((total, item) => {
    const quantity = Number(renewalProductQuantity(item.product, values, selectedProducts.length)) || 0;
    const unitPrice = Number(renewalProductUnitPrice(item.product, values, selectedProducts.length)) || 0;
    const term = values.renewalTerm || item.product.renewalTerm;
    return total + quantity * unitPrice * renewalTermYears(term);
  }, 0);
  return (
    <aside className="min-w-0 w-full rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">Selected Digital Products</h2>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{selectedProducts.length}</span>
      </div>
      {selectedProducts.length ? (
        <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto border-b border-gray-100">
          {selectedProducts.map(({ subOrderId, product }) => (
            <div key={`${subOrderId}-${product.name}`} className="flex min-w-0 items-start gap-2 py-3">
              <BrandMark brand={product.brand} image={product.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                <p className="text-xs text-gray-500">{subOrderId} · {product.licenseType || "Digital Product"}</p>
                <p className="mt-1 text-xs text-gray-600">{product.quantity || "—"} units · {product.unitPrice ? formatCurrencyAmount(product.unitPrice) : "—"} each</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-b border-gray-100 pb-4 text-xs text-gray-500">Select digital sub-orders to load their products.</p>
      )}
      {showOrderDetails && (
        <div className="space-y-3 border-b border-gray-100 py-4 text-xs">
          <div className="flex justify-between gap-4"><span className="text-gray-500">Client</span><span className="text-right font-medium text-gray-800">{values.client}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Order ID</span><span className="font-medium text-gray-800">{values.order}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Order Date</span><span className="font-medium text-gray-800">{wizardDateLabel(values.orderDate)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Delivery Date</span><span className="font-medium text-gray-800">{wizardDateLabel(values.deliveryDate)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-gray-500">Sub-orders</span><span className="text-right font-medium text-gray-800">{values.subOrders.length || "—"}</span></div>
          {selectedProducts.length === 1 && <div className="flex justify-between gap-4"><span className="text-gray-500">Current Expiry</span><span className="font-medium text-gray-800">{wizardDateLabel(selectedProducts[0].product.currentExpiryDate || values.currentExpiryDate)}</span></div>}
        </div>
      )}
      <div className="space-y-3 border-b border-gray-100 py-4 text-xs">
        <div className="flex justify-between gap-4"><span className="text-gray-500">Renewal Term</span><span className="font-medium text-gray-800">{commonTerm || "Set for each selected product"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">Quantity / Users</span><span className="font-medium text-gray-800">Loaded per product</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">Unit Price</span><span className="font-semibold text-gray-800">Loaded per product</span></div>
        {nextExpiryDate && <div className="flex justify-between gap-4"><span className="text-gray-500">Next Expiry Date</span><span className="font-medium text-gray-800">{wizardDateLabel(nextExpiryDate)}</span></div>}
      </div>
      <div className="pt-4">
        <p className="text-xs font-medium text-gray-600">Estimated Total Renewal Amount</p>
        <p className="mt-1 text-2xl font-bold text-blue-600">{selectedProducts.length ? formatCurrencyAmount(String(estimatedAmount)) : "—"}</p>
        <p className="text-xs text-gray-500">(Inclusive of applicable taxes)</p>
      </div>
      <div className="mt-5 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
        <div className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><div><p className="font-semibold">Reminder & Auto Renewal</p><p className="mt-1 text-blue-800">Reminder and auto-renew preferences are saved with this renewal. Automatic messages are not sent from this screen.</p></div></div>
      </div>
    </aside>
  );
}

function NewRenewalWizard({
  onCancel,
  onCreate,
  onView,
  initialValues,
  clients,
  orders,
  internalUsers,
  portalUsers,
}: {
  onCancel: () => void;
  onCreate: (values: RenewalWizardValues, selectedProducts: RenewalWizardSelectedProduct[]) => Renewal[];
  onView: (renewal: Renewal) => void;
  initialValues: RenewalWizardValues;
  clients: StoredClient[];
  orders: RenewalWizardOrder[];
  internalUsers: NidoUser[];
  portalUsers: PortalUser[];
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [values, setValues] = useState<RenewalWizardValues>(initialValues);
  const [createdRenewals, setCreatedRenewals] = useState<Renewal[]>([]);
  const selectedClientRecord = clients.find(client => client.name === values.client);
  const notificationRecipients = useMemo(() => {
    const recipients: RenewalNotificationRecipient[] = [];
    const addRecipient = (emailValue: string | undefined, name: string) => {
      const email = String(emailValue || "").trim();
      if (!email.includes("@")) return;
      recipients.push({ email, label: `${name || email} · ${email}` });
    };

    internalUsers
      .filter(user => String(user.status || "").toLowerCase() === "active")
      .forEach(user => addRecipient(user.email, user.name));
    addRecipient(selectedClientRecord?.email, selectedClientRecord?.name || "Client contact");
    portalUsers
      .filter(user =>
        user.clientId === selectedClientRecord?.id &&
        String(user.status || "").toLowerCase() === "active",
      )
      .forEach(user => addRecipient(user.email, user.name));

    const uniqueRecipients = new Map<string, RenewalNotificationRecipient>();
    recipients.forEach(recipient => {
      const key = recipient.email.toLowerCase();
      if (!uniqueRecipients.has(key)) uniqueRecipients.set(key, recipient);
    });
    return Array.from(uniqueRecipients.values());
  }, [internalUsers, portalUsers, selectedClientRecord]);
  const selectedOrder = orders.find(order => order.id === values.order);
  const selectedSubOrders = selectedOrder?.subOrders.filter(subOrder => values.subOrders.includes(subOrder.id)) || [];
  const selectedRenewalItems = selectedSubOrders.flatMap(subOrder =>
    subOrder.products.map(product => ({ subOrderId: subOrder.id, product })),
  );
  const selectedProducts = selectedRenewalItems.map(item => item.product);
  const commonSourceStartDate = commonProductValue(selectedProducts, product => product.renewalStartDate);
  const commonSourceTerm = commonProductValue(selectedProducts, product => product.renewalTerm);
  const nextExpiryDate = wizardNextExpiryDate(
    values.renewalStartDate || commonSourceStartDate,
    values.renewalTerm || commonSourceTerm,
  );
  const clientOrders = orders.filter(order => {
    const selectedClient = clients.find(client => client.name === values.client);
    if (!selectedClient) return false;
    if (selectedClient.id && order.clientId) return order.clientId === selectedClient.id;
    return order.client === selectedClient.name;
  });
  const hasLiveProduct = Boolean(
    selectedOrder &&
    values.subOrders.length > 0 &&
    selectedSubOrders.length === values.subOrders.length &&
    selectedRenewalItems.length > 0,
  );
  const hasCompleteProductData = selectedRenewalItems.length > 0 && selectedRenewalItems.every(({ product }) =>
    Boolean(
      (values.renewalStartDate || product.renewalStartDate) &&
      (values.renewalTerm || product.renewalTerm) &&
      renewalProductQuantity(product, values, selectedRenewalItems.length) &&
      renewalProductUnitPrice(product, values, selectedRenewalItems.length),
    ),
  );
  const hasLiveRecipients = values.notifyTo.length > 0 && values.notifyTo.every(email =>
    notificationRecipients.some(recipient => recipient.email.toLowerCase() === email.toLowerCase()),
  );
  const estimatedAmount = selectedRenewalItems.reduce((total, { product }) => {
    const quantity = Number(renewalProductQuantity(product, values, selectedRenewalItems.length)) || 0;
    const unitPrice = Number(renewalProductUnitPrice(product, values, selectedRenewalItems.length)) || 0;
    const term = values.renewalTerm || product.renewalTerm;
    return total + quantity * unitPrice * renewalTermYears(term);
  }, 0);
  const canContinue = step === 1
    ? Boolean(
        hasLiveProduct &&
        hasCompleteProductData &&
        values.client &&
        values.order &&
        values.subOrders.length &&
        values.reminders.length > 0 &&
        values.reminders.every(reminder => reminder.trim()),
      )
    : step === 2
      ? Boolean(hasLiveProduct && hasCompleteProductData)
      : step === 3
        ? Boolean(
            hasLiveProduct &&
            hasCompleteProductData &&
            values.reminders.length > 0 &&
            values.reminders.every(reminder => reminder.trim()) &&
            hasLiveRecipients,
          )
        : false;
  const canCreate = Boolean(
    hasLiveProduct &&
    hasCompleteProductData &&
    values.client &&
    values.order &&
    values.subOrders.length &&
    values.reminders.length > 0 &&
    values.reminders.every(reminder => reminder.trim()) &&
    hasLiveRecipients,
  );

  const update = <K extends keyof RenewalWizardValues>(key: K, value: RenewalWizardValues[K]) => {
    setValues(current => ({ ...current, [key]: value }));
  };

  const selectOrder = (orderId: string) => {
    const order = orders.find(item => item.id === orderId);
    setValues(current => ({
      ...createEmptyRenewalWizardValues(),
      order: orderId,
      client: order?.client || current.client,
      orderDate: order?.orderDate || "",
      deliveryDate: order?.deliveryDate || "",
    }));
  };

  const selectSubOrders = (subOrderIds: string[]) => {
    const selectedIds = [...new Set(subOrderIds)];
    const selectedSubOrders = selectedOrder?.subOrders.filter(subOrder => selectedIds.includes(subOrder.id)) || [];
    const selectedProducts = selectedSubOrders.flatMap(subOrder => subOrder.products);
    const firstProduct = selectedProducts[0];
    const isSingleProduct = selectedProducts.length === 1;
    const sourceReminders = commonProductValue(selectedProducts, product => JSON.stringify(product.reminders));
    let sourceReminderValues: string[] = [];
    try {
      sourceReminderValues = sourceReminders ? JSON.parse(sourceReminders) : [];
    } catch {
      sourceReminderValues = [];
    }

    setValues(current => ({
      ...current,
      subOrders: selectedIds,
      product: [...new Set(selectedProducts.map(product => product.name))].join(", "),
      productImage: firstProduct?.image || "",
      brand: firstProduct?.brand || "other",
      licenseType: [...new Set(selectedProducts.map(product => product.licenseType).filter(Boolean))].join(", "),
      currentExpiryDate: isSingleProduct ? firstProduct?.currentExpiryDate || "" : "",
      renewalStartDate: commonProductValue(selectedProducts, product => product.renewalStartDate)
        || (selectedIds.length ? current.renewalStartDate : ""),
      renewalTerm: commonProductValue(selectedProducts, product => product.renewalTerm)
        || (selectedIds.length ? current.renewalTerm : ""),
      quantity: isSingleProduct ? firstProduct?.quantity || "" : "",
      unitPrice: isSingleProduct ? firstProduct?.unitPrice || "" : "",
      contractNo: isSingleProduct
        ? firstProduct?.contractNo || ""
        : commonProductValue(selectedProducts, product => product.contractNo),
      purchaseOrderNo: isSingleProduct
        ? firstProduct?.purchaseOrderNo || ""
        : commonProductValue(selectedProducts, product => product.purchaseOrderNo),
      reminders: current.reminders.length
        ? current.reminders
        : sourceReminderValues,
      notes: isSingleProduct ? firstProduct?.notes || current.notes : current.notes,
    }));
  };

  const selectClient = (clientName: string) => {
    setValues(current => ({
      ...createEmptyRenewalWizardValues(),
      client: clientName,
    }));
  };

  const toggleNotifyTo = (name: string) => {
    update("notifyTo", values.notifyTo.includes(name)
      ? values.notifyTo.filter(item => item !== name)
      : [...values.notifyTo, name]);
  };

  const addReminder = () => update("reminders", [...values.reminders, ""]);
  const updateReminder = (index: number, value: string) => update("reminders", values.reminders.map((item, itemIndex) => itemIndex === index ? value : item));

  const goNext = () => setStep(current => Math.min(4, current + 1) as 1 | 2 | 3 | 4);
  const goBack = () => setStep(current => Math.max(1, current - 1) as 1 | 2 | 3 | 4);
  const create = () => {
    if (canCreate) setCreatedRenewals(onCreate(values, selectedRenewalItems));
  };

  if (createdRenewals.length) {
    const firstCreatedRenewal = createdRenewals[0];
    return (
      <div className="renewals-page min-h-screen w-full max-w-full min-w-0 bg-[#fbfcfe] px-3 pb-10 pt-5 text-gray-900 sm:px-7 sm:pt-7">
        <RenewalTypography />
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500"><Home className="h-3.5 w-3.5" /> Home <ChevronRight className="h-3.5 w-3.5" /> Renewals <ChevronRight className="h-3.5 w-3.5" /> New Renewal <ChevronRight className="h-3.5 w-3.5" /><span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Success</span></div>
          <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"><Check className="h-9 w-9" /></div><div><h1 className="text-2xl font-bold text-gray-900">{createdRenewals.length === 1 ? "Renewal Created Successfully!" : `${createdRenewals.length} Renewals Created Successfully!`}</h1><p className="mt-1 text-sm text-gray-600">Renewals were saved for the selected digital order items.</p></div></div>
              <div className="rounded-lg bg-emerald-100 px-5 py-3"><p className="text-xs text-gray-600">Renewal IDs</p><p className="text-2xl font-bold text-gray-900">{firstCreatedRenewal.id}{createdRenewals.length > 1 ? ` +${createdRenewals.length - 1}` : ""}</p><p className="text-xs text-gray-600">Created on {wizardDateLabel(firstCreatedRenewal.createdAt?.slice(0, 10) || "")}</p></div>
              <div className="flex flex-col gap-2 sm:min-w-[190px]"><button type="button" onClick={() => onView(firstCreatedRenewal)} className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">View Renewal</button><button type="button" onClick={() => { setCreatedRenewals([]); setStep(1); setValues(initialValues); }} className="h-10 rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Create Another Renewal</button></div>
            </div>
          </section>
          <WizardCard title="Renewal Summary" className="mt-4">
            <div className="grid gap-5 md:grid-cols-4">
              <div className="flex items-start gap-3 md:col-span-2"><BrandMark brand={selectedRenewalItems[0]?.product.brand} image={selectedRenewalItems[0]?.product.image} /><div><p className="font-semibold text-gray-900">{createdRenewals.length} digital product renewal{createdRenewals.length === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-gray-500">{values.subOrders.join(", ")}</p></div></div>
              <div className="space-y-2 text-sm"><p><span className="text-gray-500">Status</span> <span className={`ml-4 rounded-full px-2 py-1 ${STATUS_STYLES[firstCreatedRenewal.renewalStatus]}`}>{firstCreatedRenewal.renewalStatus}</span></p><p><span className="text-gray-500">Next Expiry Date</span> <strong className="ml-3">{wizardDateLabel(firstCreatedRenewal.dueDate)}</strong></p><p><span className="text-gray-500">Renewal Term</span> <strong className="ml-8">{firstCreatedRenewal.renewalTerm || "—"}</strong></p></div>
              <div className="space-y-2 text-sm"><p><span className="text-gray-500">Client</span> <strong className="float-right">{values.client}</strong></p><p><span className="text-gray-500">Order ID</span> <strong className="float-right">{values.order}</strong></p><p><span className="text-gray-500">Contract No.</span> <strong className="float-right">{firstCreatedRenewal.contractNo || "—"}</strong></p></div>
            </div>
          </WizardCard>
          <WizardCard title="Created Renewals" className="mt-4">
            <div className="divide-y divide-gray-100">
              {createdRenewals.map(renewal => (
                <div key={renewal.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <div><p className="font-semibold text-gray-900">{renewal.product}</p><p className="text-xs text-gray-500">{renewal.subOrderId} · {renewal.id}</p></div>
                  <p className="text-gray-600">{renewal.quantity || renewal.seats || "—"} units · {renewal.amount || "—"}</p>
                  <span className={`w-fit rounded-full px-2 py-1 text-xs ${STATUS_STYLES[renewal.renewalStatus]}`}>{renewal.renewalStatus}</span>
                </div>
              ))}
            </div>
          </WizardCard>
          <div className="mt-4 grid min-w-0 gap-y-4 gap-x-1.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,300px)]">
              <WizardCard title="Reminder Schedule">
                <div className="overflow-hidden rounded-lg border border-gray-200"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Renewal / #</th><th className="px-3 py-2">Reminder Date</th><th className="px-3 py-2">Days Before Expiry</th><th className="px-3 py-2">Notify To</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{createdRenewals.flatMap(renewal => values.reminders.map((days, index) => { const date = renewal.dueDate ? new Date(renewal.dueDate) : undefined; if (date && days) date.setDate(date.getDate() - Number(days)); const isConfigured = Boolean(date && days && !Number.isNaN(date.getTime())); return <tr key={`${renewal.id}-${days}-${index}`} className="border-t border-gray-100"><td className="px-3 py-3">{renewal.id} · {index + 1}</td><td className="px-3 py-3">{isConfigured ? date?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td><td className="px-3 py-3">{days ? `${days} days` : "—"}</td><td className="px-3 py-3">{values.notifyTo.join(", ") || "—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 ${isConfigured ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{isConfigured ? "Configured" : "Incomplete"}</span></td></tr>; }))}</tbody></table></div>
            </WizardCard>
            <WizardCard title="Quick Actions"><div className="divide-y divide-gray-100 text-sm"><button type="button" onClick={() => onView(firstCreatedRenewal)} className="flex w-full items-center justify-between py-3 text-left text-gray-700 hover:text-blue-700"><span className="flex items-center gap-2"><Eye className="h-4 w-4 text-blue-600" /> View Renewal Details</span><ChevronRight className="h-4 w-4" /></button><button type="button" onClick={() => setCreatedRenewals([])} className="flex w-full items-center justify-between py-3 text-left text-gray-700 hover:text-blue-700"><span className="flex items-center gap-2"><Pencil className="h-4 w-4 text-blue-600" /> Edit Renewal</span><ChevronRight className="h-4 w-4" /></button><button type="button" onClick={onCancel} className="flex w-full items-center justify-between py-3 text-left text-gray-700 hover:text-blue-700"><span className="flex items-center gap-2"><ArrowLeft className="h-4 w-4 text-blue-600" /> Back to Renewals</span><ChevronRight className="h-4 w-4" /></button></div></WizardCard>
          </div>
        </div>
      </div>
    );
  }

  const sidebar = <RenewalProductSummary values={values} nextExpiryDate={nextExpiryDate} selectedProducts={selectedRenewalItems} />;

  return (
    <div className="renewals-page min-h-screen w-full max-w-full min-w-0 bg-[#fbfcfe] px-3 pb-10 pt-5 text-gray-900 sm:px-7 sm:pt-7">
      <RenewalTypography />
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-500"><Home className="h-3.5 w-3.5" /> Home <ChevronRight className="h-3.5 w-3.5" /> Renewals <ChevronRight className="h-3.5 w-3.5" /><span className="rounded bg-blue-50 px-2 py-1 text-blue-700">New Renewal</span></div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Create New Renewal</h1>
        <p className="mt-1 text-sm text-gray-500">{step === 1 ? "Create a renewal for a product/service you have already purchased" : step === 2 ? "Set renewal details and reminder preferences" : step === 3 ? "Configure notification and reminder settings" : "Review the details and create the renewal"}</p>
        <div className="mt-5"><RenewalWizardStepper step={step} /></div>

        {!clients.length && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No saved client records are available for renewals. Add a client before creating a renewal.
          </p>
        )}
        {clients.length > 0 && !orders.length && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No delivered, renewal-eligible order items were found in the saved order records. Only real delivered subscriptions or licenses can be selected.
          </p>
        )}

        {step === 1 && (
          <div className="grid min-w-0 gap-y-4 gap-x-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0 space-y-4">
              <WizardCard title="1. Select Order & Product">
                <div className="grid gap-y-4 gap-x-1.5 sm:grid-cols-2">
                  <WizardField label="Client" required><WizardSelect value={values.client} onChange={selectClient}><option value="" disabled>Select a client</option>{clients.map(client => <option key={client.id} value={client.name}>{client.name}</option>)}</WizardSelect></WizardField>
                   <WizardField label="Order" required><WizardSelect value={values.order} onChange={selectOrder}><option value="" disabled>{values.client ? clientOrders.length ? "Select an order" : "No eligible delivered orders for this client" : "Select a client first"}</option>{clientOrders.map(order => <option key={order.id} value={order.id}>{order.id}</option>)}</WizardSelect><span className="mt-1 block text-xs text-gray-500">{values.orderDate ? `Ordered on ${wizardDateLabel(values.orderDate)}${values.deliveryDate ? ` | Delivered on ${wizardDateLabel(values.deliveryDate)}` : ""}` : "Orders and delivery dates are loaded from saved order records."}</span></WizardField>
                    <WizardField label="Sub-orders" required>
                      <SubOrderMultiSelect options={selectedOrder?.subOrders || []} selectedIds={values.subOrders} onChange={selectSubOrders} />
                      <span className="mt-1 block text-xs text-gray-500">Select one or more delivered digital sub-orders. Only products from these selections will renew.</span>
                    </WizardField>
                   <WizardField label="Product / License" required className="sm:col-span-2">
                     {selectedRenewalItems.length ? (
                       <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white px-3">
                         {selectedRenewalItems.map(({ subOrderId, product }, index) => (
                           <div key={`${subOrderId}-${product.name}-${index}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,120px))] sm:items-center">
                             <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{product.name}</p><p className="text-xs text-gray-500">{subOrderId} · {product.licenseType || "Digital Product"}</p></div>
                             <p className="text-xs text-gray-600">Expiry: {wizardDateLabel(product.currentExpiryDate || values.currentExpiryDate)}</p>
                             <p className="text-xs text-gray-600">Qty: {product.quantity || "—"}</p>
                             <p className="text-xs font-medium text-gray-700">{product.unitPrice ? formatCurrencyAmount(product.unitPrice) : "Price not saved"}</p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">Select one or more sub-orders to load their saved digital product and license details automatically.</div>
                     )}
                  </WizardField>
                </div>
              </WizardCard>
              <WizardCard title="2. Renewal Details">
                <div className="grid gap-y-4 gap-x-1.5 sm:grid-cols-2">
                     <WizardField label={selectedRenewalItems.length > 1 ? "Current Expiry Date (fallback)" : "Current Expiry Date"}><WizardInput type="date" value={values.currentExpiryDate} onChange={value => update("currentExpiryDate", value)} /></WizardField>
                     <WizardField label="Renewal Start Date"><WizardInput type="date" value={values.renewalStartDate} onChange={value => update("renewalStartDate", value)} /></WizardField>
                   <WizardField label="Renewal Term"><WizardSelect value={values.renewalTerm} onChange={value => update("renewalTerm", value)}><option value="" disabled>Use saved term or select one</option><option>1 Year</option><option>2 Years</option><option>3 Years</option></WizardSelect></WizardField>
                   {selectedRenewalItems.length <= 1 ? (
                     <>
                       <WizardField label="Quantity / Users"><div className="flex"><WizardInput value={values.quantity} onChange={value => update("quantity", value)} /><span className="flex h-10 items-center rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">Users</span></div></WizardField>
                       <WizardField label="Unit Price"><WizardInput type="number" value={values.unitPrice} onChange={value => update("unitPrice", value)} placeholder="Enter unit price" /></WizardField>
                     </>
                   ) : (
                     <>
                       <WizardField label="Fallback Quantity (if missing from order)"><WizardInput value={values.quantity} onChange={value => update("quantity", value)} placeholder="Uses each order item's saved quantity" /></WizardField>
                       <WizardField label="Fallback Unit Price (if missing from order)"><WizardInput type="number" value={values.unitPrice} onChange={value => update("unitPrice", value)} placeholder="Uses each order item's saved price" /></WizardField>
                     </>
                   )}
                </div>
                 {selectedRenewalItems.length > 1 && <p className="mt-3 text-xs text-gray-500">Quantity and price are loaded separately for each selected product. Fallback values are used only when an order item has no saved value.</p>}
              </WizardCard>
              <WizardCard title="3. Renewal Notifications">
                <div className="grid gap-y-4 gap-x-1.5 sm:grid-cols-2">
                   <WizardField label="Reminder Days Before Expiry" required><WizardSelect value={values.reminders[0] || ""} onChange={value => update("reminders", [value, ...values.reminders.slice(1)])}><option value="" disabled>Select reminder days</option><option>30</option><option>15</option><option>7</option></WizardSelect></WizardField>
                  <WizardField label="Notify To" required><div className="flex min-h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">{values.notifyTo.length ? values.notifyTo.join(", ") : "Choose active recipients in Notifications"}</div></WizardField>
                </div>
              </WizardCard>
              <WizardCard title="4. Additional Notes (Optional)">
                <textarea value={values.notes} onChange={event => update("notes", event.target.value)} maxLength={200} placeholder="Add any internal notes for this renewal..." className="min-h-[86px] w-full resize-none rounded-lg border border-gray-200 p-3 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                <p className="mt-1 text-right text-xs text-gray-500">{values.notes.length} / 200</p>
              </WizardCard>
            </div>
            {sidebar}
          </div>
        )}

        {step === 2 && (
          <div className="grid min-w-0 gap-y-4 gap-x-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0 space-y-4">
              <WizardCard title="Renewal Details">
                <div className="grid gap-y-4 gap-x-1.5 sm:grid-cols-2">
                    <WizardField label="Renewal Start Date"><WizardInput type="date" value={values.renewalStartDate} onChange={value => update("renewalStartDate", value)} /></WizardField>
                  <WizardField label="Next Expiry Date"><WizardInput type="date" value={nextExpiryDate} readOnly /></WizardField>
                    <WizardField label="Renewal Term"><WizardSelect value={values.renewalTerm} onChange={value => update("renewalTerm", value)}><option value="" disabled>Use saved term or select one</option><option>1 Year</option><option>2 Years</option><option>3 Years</option></WizardSelect></WizardField>
                  {selectedRenewalItems.length <= 1 ? (
                    <>
                      <WizardField label="Quantity / Users"><div className="flex"><WizardInput value={values.quantity} onChange={value => update("quantity", value)} /><span className="flex h-10 items-center rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">Users</span></div></WizardField>
                      <WizardField label="Unit Price"><WizardInput type="number" value={values.unitPrice} onChange={value => update("unitPrice", value)} placeholder="Enter unit price" /></WizardField>
                    </>
                  ) : (
                    <>
                      <WizardField label="Fallback Quantity (if missing from order)"><WizardInput value={values.quantity} onChange={value => update("quantity", value)} placeholder="Uses each order item's saved quantity" /></WizardField>
                      <WizardField label="Fallback Unit Price (if missing from order)"><WizardInput type="number" value={values.unitPrice} onChange={value => update("unitPrice", value)} placeholder="Uses each order item's saved price" /></WizardField>
                    </>
                  )}
                  <WizardField label="Expected Renewal Amount"><WizardInput value={formatCurrencyAmount(String(estimatedAmount))} readOnly /></WizardField>
                  <WizardField label="Contract No."><WizardInput value={values.contractNo} onChange={value => update("contractNo", value)} /></WizardField>
                  <WizardField label="Purchase Order No. (Optional)"><WizardInput value={values.purchaseOrderNo} onChange={value => update("purchaseOrderNo", value)} placeholder="Enter PO number" /></WizardField>
                </div>
              </WizardCard>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-bold text-gray-900">Auto Renewal (Optional)</h2><p className="mt-2 text-sm font-semibold text-gray-800">Enable Auto Renewal</p><p className="text-xs text-gray-500">This preference is saved on the renewal record; it does not place an order automatically.</p></div><button type="button" aria-pressed={values.autoRenew} onClick={() => update("autoRenew", !values.autoRenew)} className={`relative mt-1 h-6 w-11 rounded-full transition-colors ${values.autoRenew ? "bg-blue-600" : "bg-gray-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${values.autoRenew ? "translate-x-6" : "translate-x-1"}`} /></button></div><div className="mt-4 rounded-lg bg-blue-100/70 p-3 text-xs text-blue-800"><Info className="mr-2 inline h-4 w-4" />The saved setting can be updated from the renewal details page.</div></div>
              <WizardCard title="Renewal Summary Note (Optional)"><textarea value={values.notes} onChange={event => update("notes", event.target.value)} maxLength={200} placeholder="Add any additional notes, special terms or instructions..." className="min-h-[86px] w-full resize-none rounded-lg border border-gray-200 p-3 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><p className="mt-1 text-right text-xs text-gray-500">{values.notes.length} / 200</p></WizardCard>
            </div>
            {sidebar}
          </div>
        )}

        {step === 3 && (
          <div className="grid min-w-0 gap-y-4 gap-x-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0 space-y-4">
              <WizardCard title="Reminder Settings">
                <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><Info className="mr-2 inline h-4 w-4" />Set when you want to be notified before the renewal expiry date. You can add multiple reminders.</div>
                <div className="grid gap-y-3 gap-x-1.5 sm:grid-cols-3">{values.reminders.map((reminder, index) => <WizardField key={index} label={`Reminder ${index + 1}`} required><div className="flex"><WizardInput value={reminder} onChange={value => updateReminder(index, value)} /><span className="flex h-10 items-center rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 px-3 text-xs text-gray-600">Days before expiry</span></div></WizardField>)}</div>
                <button type="button" onClick={addReminder} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Plus className="h-3.5 w-3.5" /> Add Another Reminder</button>
              </WizardCard>
              <WizardCard title="Notification Recipients">
                <p className="mb-4 text-sm text-gray-500">Choose from active internal users and contacts saved for this client.</p>
                {notificationRecipients.length ? (
                  <div className="grid gap-y-3 gap-x-1.5 sm:grid-cols-2">
                    {notificationRecipients.map(recipient => (
                      <label key={recipient.email} className="flex min-w-0 items-center gap-2 text-sm text-gray-800">
                        <input type="checkbox" checked={values.notifyTo.includes(recipient.email)} onChange={() => toggleNotifyTo(recipient.email)} className="h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600" />
                        <span className="truncate">{recipient.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">No active user or contact email is available for the selected client.</p>
                )}
              </WizardCard>
              <WizardCard title="Notification Message (Optional)">
                <p className="mb-3 text-sm text-gray-500">This message is saved with the renewal record; this page does not send notifications.</p>
                <textarea value={values.notificationMessage} onChange={event => update("notificationMessage", event.target.value)} maxLength={500} className="min-h-[105px] w-full resize-none rounded-lg border border-gray-200 p-3 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                <p className="mt-1 text-right text-xs text-gray-500">{values.notificationMessage.length} / 500</p>
                <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><Mail className="mr-2 inline h-5 w-5" /><strong>Reminder Message</strong><p className="ml-7 text-xs">The message will be stored with the renewal for later use.</p></div>
              </WizardCard>
            </div>
            {sidebar}
          </div>
        )}

        {step === 4 && (
          <div className="grid min-w-0 gap-y-4 gap-x-1.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="min-w-0 space-y-4">
              <WizardCard title="Review Renewal Information">
                <p className="mb-4 text-sm text-gray-500">Please review all details before creating the renewal. You can go back and make changes if needed.</p>
                <div className="space-y-4">
                   <div className="rounded-lg bg-gray-50 p-4">
                     <h3 className="mb-3 text-sm font-bold text-gray-800">Order & Selected Digital Products</h3>
                     <div className="grid gap-3 text-sm sm:grid-cols-2">
                       <div className="space-y-2">
                         <p><span className="text-gray-500">Client :</span> <strong>{values.client || "—"}</strong></p>
                         <p><span className="text-gray-500">Order ID :</span> <strong>{values.order || "—"}</strong></p>
                         <p><span className="text-gray-500">Selected Sub-orders :</span> <strong>{values.subOrders.join(", ") || "—"}</strong></p>
                         <p><span className="text-gray-500">Order Date :</span> <strong>{wizardDateLabel(values.orderDate)}</strong></p>
                         <p><span className="text-gray-500">Delivery Date :</span> <strong>{wizardDateLabel(values.deliveryDate)}</strong></p>
                       </div>
                     </div>
                     <div className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                       {selectedRenewalItems.map(({ subOrderId, product }, index) => (
                         <div key={`${subOrderId}-${product.name}-${index}`} className="grid gap-2 p-3 text-sm sm:grid-cols-2">
                           <div><p className="font-semibold text-gray-800">{product.name}</p><p className="text-xs text-gray-500">{subOrderId} · {product.licenseType || "Digital Product"}</p></div>
                           <p className="text-gray-600">{product.quantity || values.quantity || "—"} units · {product.unitPrice ? formatCurrencyAmount(product.unitPrice) : values.unitPrice ? formatCurrencyAmount(values.unitPrice) : "Price not saved"}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                   <div className="rounded-lg bg-gray-50 p-4"><h3 className="mb-3 text-sm font-bold text-gray-800">Renewal Details</h3><div className="grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-gray-500">Renewal Start Date :</span> <strong>{wizardDateLabel(values.renewalStartDate || commonSourceStartDate)}</strong></p><p><span className="text-gray-500">Renewal Term :</span> <strong>{values.renewalTerm || commonSourceTerm || "Per selected product"}</strong></p><p><span className="text-gray-500">Contract No. :</span> <strong>{values.contractNo || "Per selected product"}</strong></p><p><span className="text-gray-500">Purchase Order No. :</span> <strong>{values.purchaseOrderNo || "Per selected product"}</strong></p><p><span className="text-gray-500">Expected Amount :</span> <strong>{formatCurrencyAmount(String(estimatedAmount))}</strong></p></div></div>
                  <div className="rounded-lg bg-gray-50 p-4"><h3 className="mb-3 text-sm font-bold text-gray-800">Reminder & Notifications</h3><div className="grid gap-2 text-sm sm:grid-cols-2"><div className="space-y-2">{values.reminders.map((reminder, index) => <p key={index}><span className="text-gray-500">Reminder {index + 1} :</span> <strong>{reminder} days before expiry</strong></p>)}</div><div className="space-y-2"><p><span className="text-gray-500">Notify To :</span> <strong>{values.notifyTo.join(", ") || "—"}</strong></p><p><span className="text-gray-500">Auto Renewal :</span> <strong>{values.autoRenew ? "Enabled" : "Disabled"}</strong></p></div></div></div>
                  <div className="rounded-lg bg-gray-50 p-4"><h3 className="mb-2 text-sm font-bold text-gray-800">Message</h3><p className="text-sm text-gray-700">{values.notificationMessage}</p></div>
                </div>
              </WizardCard>
            </div>
            {sidebar}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={step === 1 ? onCancel : goBack} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /> {step === 1 ? "Cancel" : "Back"}</button>
           {step < 4 ? <button type="button" onClick={goNext} disabled={!canContinue} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Next <ChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={create} disabled={!canCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> Create Renewal</button>}
        </div>
      </div>
    </div>
  );
}

type DetailTab = "Order Items" | "License Details" | "Renewals" | "Downloads" | "Invoices" | "Activity Log" | "Notes";

const DETAIL_TABS: DetailTab[] = [
  "Order Items",
  "License Details",
  "Renewals",
  "Downloads",
  "Invoices",
  "Activity Log",
  "Notes",
];

function formatCurrencyAmount(value: string): string {
  const amount = Number(value.replace(/[^\d.-]/g, "").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return value;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadRenewalFile(row: Renewal, type: "license" | "renewal") {
  const contents = type === "license"
    ? `Renewal License Details\n\nRenewal ID: ${row.id}\nProduct: ${row.product}\nClient: ${row.client}\nLicense type: ${row.licenseType || "Not recorded"}\nQuantity: ${row.quantity || row.seats || "Not recorded"}\nOrder ID: ${row.orderId || "Not recorded"}\nSub-order ID: ${row.subOrderId || "Not recorded"}\nCurrent expiry: ${row.currentExpiryDate || "Not recorded"}\nRenewal start: ${row.renewalStartDate || "Not recorded"}\n`
    : `Renewal Summary\n\nRenewal ID: ${row.id}\nProduct: ${row.product}\nClient: ${row.client}\nNext renewal: ${row.dueDate || "Not recorded"}\nRenewal amount: ${row.amount || "Not recorded"}\nStatus: ${row.renewalStatus}\nAuto renewal preference: ${row.autoRenew}\n`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
  link.download = `${row.id}-${type}-details.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-gray-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <h2 className="mb-3 text-[10px] font-bold text-gray-800">{title}</h2>
      {children}
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[8px] text-gray-400">{label}</p>
      <p className="mt-0.5 text-[9px] font-medium leading-3.5 text-gray-700">{value}</p>
    </div>
  );
}

function RenewalTypography() {
  return (
    <style>{`
      .renewals-page {
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 13.5px;
      }
      .renewals-page [class~="text-[8px]"] {
        font-size: 12px !important;
      }
      .renewals-page [class~="text-[9px]"] {
        font-size: 13px !important;
      }
      .renewals-page [class~="text-[10px]"] {
        font-size: 13.5px !important;
      }
      .renewals-page [class~="text-[11px]"] {
        font-size: 14px !important;
      }
      .renewals-page [class~="text-[17px]"] {
        font-size: 22px !important;
      }
      .renewals-page [class~="text-[19px]"] {
        font-size: 24px !important;
      }
      .renewals-page [class~="leading-3.5"] {
        line-height: 1.5rem !important;
      }
      .renewals-page .renewal-list-table {
        width: 100%;
        table-layout: fixed;
      }
      .renewals-page .renewal-list-table th,
      .renewals-page .renewal-list-table td {
        overflow-wrap: anywhere;
        padding-left: 0.375rem !important;
        padding-right: 0.375rem !important;
      }
      .renewals-page textarea,
      .renewals-page input,
      .renewals-page select,
      .renewals-page button {
        font-family: inherit;
      }
    `}</style>
  );
}

function RenewalDetailsPage({
  row,
  onBack,
  onEdit,
  onRenew,
  onRemove,
  onManageRenewal,
  sourceOrder,
  sourceClient,
  history,
  invoices,
}: {
  row: Renewal;
  onBack: () => void;
  onEdit: () => void;
  onRenew: () => void;
  onRemove: () => void;
  onManageRenewal: () => void;
  sourceOrder?: MyOrder;
  sourceClient?: StoredClient;
  history: Renewal[];
  invoices: StoredInvoice[];
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("Order Items");
  const [menuOpen, setMenuOpen] = useState(false);
  const notesKey = `nido_renewal_notes_${row.id}`;
  const [noteText, setNoteText] = useState("");
  const [visibility, setVisibility] = useState<RenewalNote["visibility"]>("Internal Note");
  const [notes, setNotes] = useState<RenewalNote[]>([]);
  const sourceItem = sourceOrder?.cartItems?.find(item =>
    item.name === row.product && (!row.subOrderId || item.subOrderId === row.subOrderId),
  ) || sourceOrder?.cartItems?.find(item => item.name === row.product);
  const savedSubOrderState = sourceOrder && row.subOrderId
    ? getSavedSubOrderState(sourceOrder.id)[row.subOrderId] || {}
    : {};
  const itemStatus = String(
    savedSubOrderState.itemStatus ||
    savedSubOrderState.status ||
    (sourceItem as unknown as Record<string, unknown> | undefined)?.itemStatus ||
    (sourceItem as unknown as Record<string, unknown> | undefined)?.status ||
    sourceOrder?.status ||
    "Not recorded",
  );
  const deliverySnapshot = sourceOrder?.deliveryDetails;
  const deliveryAddress = [
    deliverySnapshot?.line1,
    deliverySnapshot?.line2,
    deliverySnapshot?.city,
    deliverySnapshot?.state,
    deliverySnapshot?.country,
    deliverySnapshot?.zip,
  ].filter(Boolean).join(", ") || sourceOrder?.deliveryAddress || "Not recorded";
  const billingAddress = [
    sourceValue(sourceClient, ["billingAddress", "billing_address"]),
    sourceValue(sourceClient, ["billingAddressLine2", "billing_address_line2"]),
    sourceValue(sourceClient, ["billingCity", "billing_city"]),
    sourceValue(sourceClient, ["billingState", "billing_state"]),
    sourceValue(sourceClient, ["billingPincode", "billing_pincode"]),
  ].filter(Boolean).join(", ") || "Not recorded";
  const relatedHistory = history.filter(item =>
    item.id !== row.id &&
    item.product === row.product &&
    (row.clientId ? item.clientId === row.clientId : item.client === row.client),
  );
  const linkedInvoices = invoices.filter(invoice =>
    Boolean(row.orderId && row.subOrderId) &&
    invoice.originatingOrderId === row.orderId &&
    invoice.lineItems.some(item => item.subOrderId === row.subOrderId) &&
    (row.clientId ? invoice.clientId === row.clientId : invoice.clientName === row.client),
  );
  const sourceOrderItemCount = sourceOrder?.cartItems?.length ?? 0;
  const sourceSubOrderCount = new Set(
    (sourceOrder?.cartItems || []).map(item => item.subOrderId).filter(Boolean),
  ).size;
  const sourceOrderItems = sourceOrder?.cartItems || [];

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(notesKey) || "null");
      setNotes(Array.isArray(stored) ? stored : []);
    } catch {
      setNotes([]);
    }
    setNoteText("");
    setVisibility("Internal Note");
  }, [notesKey]);

  useEffect(() => {
    try {
      localStorage.setItem(notesKey, JSON.stringify(notes));
    } catch {
      // Notes remain available in the current view if browser storage is unavailable.
    }
  }, [notes, notesKey]);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const now = new Date();
    const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    setNotes(current => [{
      id: `n${Date.now()}`,
      author: "System Owner",
      date,
      text: noteText.trim(),
      visibility,
    }, ...current]);
    setNoteText("");
  };
  const scrollToTab = (tab: DetailTab) => {
    setActiveTab(tab);
    document.getElementById(`renewal-detail-${tab.toLowerCase().replaceAll(" ", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="renewals-page min-h-screen bg-[#fbfcfe] px-3 pb-10 pt-5 text-gray-900 sm:px-7 sm:pt-7">
      <RenewalTypography />
      <header className="px-1.5 pb-3 pt-2 sm:px-2">
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[9px] text-gray-500 hover:text-blue-600">
          <ArrowLeft className="h-3 w-3" /> Back to Renewals
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[17px] font-bold leading-6 tracking-[-0.25px] text-gray-900">Renewal Details / #{row.id}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${STATUS_STYLES[row.renewalStatus]}`}>{row.renewalStatus}</span>
            </div>
            <p className="mt-0.5 text-[9px] text-gray-500">Source Order {row.orderId || "Not recorded"} · Created on {row.createdAt ? wizardDateLabel(row.createdAt.slice(0, 10)) : "Not recorded"}</p>
          </div>
          <div className="relative flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => downloadRenewalFile(row, "renewal")} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-[9px] font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <Download className="h-3 w-3" /> Download Renewal Summary
            </button>
            <button type="button" aria-label="Order actions" onClick={() => setMenuOpen(open => !open)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-30 w-36 rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
                <button type="button" onClick={() => { window.print(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[9px] text-gray-700 hover:bg-gray-50">Print details</button>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(row.orderId || ""); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[9px] text-gray-700 hover:bg-gray-50">Copy order ID</button>
                <button type="button" onClick={() => { onRemove(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[9px] text-rose-600 hover:bg-rose-50">Remove renewal</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mb-3 grid gap-px overflow-hidden rounded-[10px] border border-gray-200 bg-gray-100 md:grid-cols-3">
        <div className="bg-white px-3 py-2.5">
          <p className="text-[8px] font-semibold uppercase text-gray-500">Renewal Status</p>
          <p className="mt-1 text-[9px] font-bold text-gray-700">{row.renewalStatus}</p>
        </div>
        <div className="bg-white px-3 py-2.5">
          <p className="text-[8px] font-semibold uppercase text-gray-500">Current Expiry</p>
          <p className="mt-1 text-[9px] text-gray-700">{row.currentExpiryDate ? wizardDateLabel(row.currentExpiryDate) : "Not recorded"}</p>
        </div>
        <div className="bg-white px-3 py-2.5">
          <p className="text-[8px] font-semibold uppercase text-gray-500">Renewal Start</p>
          <p className="mt-1 text-[9px] text-gray-700">{row.renewalStartDate ? wizardDateLabel(row.renewalStartDate) : "Not recorded"}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DetailCard title="Billing Information">
          <div className="space-y-2.5">
            <DetailField label="Client" value={row.client} />
            <DetailField label="Payment Method" value={sourceValue(sourceOrder, ["paymentMethod"]) || "Not recorded"} />
            <DetailField label="Payment Term" value={sourceValue(sourceOrder, ["paymentTerms", "paymentTerm"]) || "Not recorded"} />
            <DetailField label="Billing Address" value={billingAddress} />
          </div>
        </DetailCard>
        <DetailCard title="Delivery Information">
          <div className="space-y-2.5">
            <DetailField label="Ship To" value={deliveryAddress} />
            <DetailField label="Delivery Type" value={deliverySnapshot?.label || "Not recorded"} />
            <DetailField label="Delivery Status" value={itemStatus} />
            <DetailField label="Delivered On" value={row.deliveryDate ? wizardDateLabel(row.deliveryDate) : "Not recorded"} />
          </div>
        </DetailCard>
        <DetailCard title="Requester / Client Information">
          <div className="space-y-2.5">
            <DetailField label="Name" value={sourceOrder?.requester || sourceOrder?.orderedFor || "Not recorded"} />
            <DetailField label="Role" value={sourceOrder?.requesterRole || "Not recorded"} />
            <DetailField label="Organization" value={row.client} />
            <DetailField label="Contact Email" value={sourceOrder?.requesterEmail || sourceClient?.email || "Not recorded"} />
          </div>
        </DetailCard>
        <DetailCard title="Order Summary">
          <div className="space-y-2.5">
            <DetailField label="Master Order ID" value={sourceOrder?.id || row.orderId || "Not recorded"} />
            <DetailField label="Sub Orders" value={sourceOrder ? (sourceSubOrderCount || "Not recorded") : (row.subOrderId ? "1" : "Not recorded")} />
            <DetailField label="Total Items" value={sourceOrder ? (sourceOrderItemCount || "Not recorded") : "Not recorded"} />
            <DetailField label={sourceOrder ? "Source Order Amount" : "Renewal Estimate"} value={<span className="font-bold">{sourceOrder?.totalAmount || row.amount || "Not recorded"}</span>} />
            <DetailField label="Created On" value={row.createdAt ? wizardDateLabel(row.createdAt.slice(0, 10)) : "Not recorded"} />
          </div>
        </DetailCard>
      </div>

      <nav className="mt-4 flex min-w-max items-end gap-1 overflow-x-auto border-b border-gray-200">
        {DETAIL_TABS.map(tab => (
          <button
            type="button"
            key={tab}
            onClick={() => scrollToTab(tab)}
            className={`relative inline-flex h-9 items-center gap-1.5 px-2.5 text-[9px] font-medium ${activeTab === tab ? "text-blue-700" : "text-gray-500 hover:text-gray-800"}`}
          >
            {tab === "Order Items" && <FileText className="h-3 w-3" />}
            {tab === "License Details" && <ShieldCheck className="h-3 w-3" />}
            {tab === "Renewals" && <RefreshCw className="h-3 w-3" />}
            {tab === "Downloads" && <Download className="h-3 w-3" />}
            {tab === "Invoices" && <Receipt className="h-3 w-3" />}
            {tab === "Activity Log" && <Activity className="h-3 w-3" />}
            {tab === "Notes" && <StickyNote className="h-3 w-3" />}
            {tab}
            {tab === "Order Items" && <span className="rounded-full bg-blue-100 px-1 text-[7px] text-blue-700">{sourceOrderItemCount}</span>}
            {tab === "Renewals" && <span className="rounded-full bg-blue-100 px-1 text-[7px] text-blue-700">{relatedHistory.length}</span>}
            {activeTab === tab && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-blue-600" />}
          </button>
        ))}
      </nav>

      <main className="mt-3 space-y-3">
        <DetailCard title={`Order Items (${sourceOrderItemCount})`}>
          <div id="renewal-detail-order-items" className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[9px]">
              <thead><tr className="border-b border-gray-100 text-left text-[8px] uppercase text-gray-400"><th className="pb-2">#</th><th className="pb-2">Item Details</th><th className="pb-2">Type</th><th className="pb-2">Qty</th><th className="pb-2">Unit Price</th><th className="pb-2">Total</th><th className="pb-2">Status</th><th className="pb-2">Vendor</th></tr></thead>
              <tbody>
                {sourceOrderItems.length ? sourceOrderItems.map((item, index) => {
                  const unitPrice = Number(item.clientSellingPriceExclGst ?? item.checkoutUnitPriceExclGst ?? item.priceNum);
                  const quantity = Number(item.quantity) || 0;
                  const itemSubOrderState = item.subOrderId ? getSavedSubOrderState(sourceOrder!.id)[item.subOrderId] : undefined;
                  const status = String(itemSubOrderState?.itemStatus || itemSubOrderState?.status || sourceOrder?.status || "Not recorded");
                  return (
                    <tr key={`${item.subOrderId || item.id}-${index}`} className="border-b border-gray-100">
                      <td className="py-3">{index + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <BrandMark brand={normalizeRenewalBrand(item.name)} image={item.image} />
                          <span className="font-semibold text-gray-700">
                            {item.name || "Not recorded"}
                            <span className="mt-1 block w-fit rounded bg-purple-50 px-1 text-[7px] font-semibold uppercase text-purple-700">{item.productType || item.fulfillmentType || "Not recorded"}</span>
                          </span>
                        </div>
                      </td>
                      <td>{item.productType || item.fulfillmentType || "Not recorded"}</td>
                      <td>{quantity || "Not recorded"}</td>
                      <td>{Number.isFinite(unitPrice) ? formatCurrencyAmount(String(unitPrice)) : "Not recorded"}</td>
                      <td>{Number.isFinite(unitPrice) ? formatCurrencyAmount(String(unitPrice * quantity)) : "Not recorded"}</td>
                      <td>
                        <span className={`rounded-full px-1.5 py-1 text-[8px] font-semibold ${status.toLowerCase() === "delivered" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600"}`}>{status}</span>
                        {row.deliveryDate && status.toLowerCase() === "delivered" && <span className="mt-1 block text-[7px] text-gray-400">{wizardDateLabel(row.deliveryDate)}</span>}
                      </td>
                      <td className="text-blue-600">{item.selectedVendorName || "Not recorded"}</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8} className="py-5 text-center text-gray-400">No linked order items are available for this renewal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sourceOrder && <div className="mt-3 ml-auto w-56 border-t border-gray-200 pt-2 text-right text-[9px] font-bold">Source Order Amount <span className="float-right">{sourceOrder.totalAmount || "Not recorded"}</span></div>}
        </DetailCard>

        <section id="renewal-detail-license-details">
          <DetailCard title="License Details">
            <div className="grid gap-4 md:grid-cols-3">
               <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded bg-purple-50 text-purple-500"><ShieldCheck className="h-5 w-5" /></div><div className="space-y-2"><DetailField label="License Type" value={row.licenseType || "Not recorded"} /><DetailField label="License Model" value={sourceItem?.commercialTerms?.licenseModel || "Not recorded"} /><DetailField label="Quantity Licensed" value={row.quantity || row.seats || "Not recorded"} /><DetailField label="Vendor" value={sourceItem?.selectedVendorName || "Not recorded"} /></div></div>
               <div className="space-y-2"><DetailField label="Activation / Tenant Domain" value={sourceValue(sourceItem, ["activationDomain", "tenantDomain", "domain"]) || "Not recorded"} /><DetailField label="Assigned To" value={row.client || "Not recorded"} /><DetailField label="Assigned Users" value={row.quantity || row.seats || "Not recorded"} /><DetailField label="License Notes" value={row.notes || "Not recorded"} /></div>
               <div className="space-y-2"><DetailField label="Renewal Start Date" value={row.renewalStartDate ? wizardDateLabel(row.renewalStartDate) : "Not recorded"} /><DetailField label="Current Expiry Date" value={row.currentExpiryDate ? wizardDateLabel(row.currentExpiryDate) : "Not recorded"} /><DetailField label="Next Expiry Date" value={row.dueDate || "Not recorded"} /><DetailField label="Auto Renewal" value={row.autoRenew || "Not recorded"} /></div>
            </div>
            <div className="mt-3 flex justify-end"><button type="button" onClick={() => downloadRenewalFile(row, "license")} className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-600 hover:underline"><Download className="h-3 w-3" /> Export license record</button></div>
          </DetailCard>
        </section>

        <section id="renewal-detail-renewals">
          <DetailCard title="Renewal Summary">
            <div className="mb-3 flex justify-end"><button type="button" onClick={onManageRenewal} className="rounded border border-blue-200 px-2 py-1 text-[8px] font-semibold text-blue-600 hover:bg-blue-50">Manage Renewal</button></div>
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded border border-gray-100 p-2"><DetailField label="Next Renewal" value={<span className="font-bold">{row.dueDate}</span>} /><p className="mt-1 text-[8px] text-gray-400">{row.dueIn}</p></div>
              <div className="rounded border border-gray-100 p-2"><DetailField label="Renewal Amount (Est.)" value={<span className="font-bold">{formatCurrencyAmount(row.amount)}</span>} /><p className="mt-1 text-[8px] text-gray-400">Excl. GST</p></div>
              <div className="rounded border border-gray-100 p-2"><DetailField label="Renewal Status" value={<span className={`rounded-full px-1.5 py-1 text-[8px] font-semibold ${STATUS_STYLES[row.renewalStatus]}`}>{row.renewalStatus}</span>} /></div>
              <div className="rounded border border-gray-100 p-2"><DetailField label="Auto Renewal" value={row.autoRenew || "Not recorded"} /></div>
            </div>
          </DetailCard>
          <DetailCard title="Renewal History">
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-[9px]"><thead><tr className="border-b border-gray-100 text-left text-[8px] uppercase text-gray-400"><th className="pb-2">Renewal ID</th><th className="pb-2">Period</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2">Renewed On</th><th className="pb-2">Invoice</th></tr></thead><tbody>{relatedHistory.length ? relatedHistory.map(item => {
              const renewed = item.dueIn.startsWith("Renewed");
              return <tr key={item.id} className="border-b border-gray-100"><td className="py-2 text-blue-600">{item.id}</td><td>{item.renewalStartDate ? wizardDateLabel(item.renewalStartDate) : "Not recorded"} – {item.dueDate || "Not recorded"}</td><td>{item.amount || "Not recorded"}</td><td>{renewed ? "Renewed" : item.renewalStatus}</td><td>{renewed ? item.dueIn.replace(/^Renewed\s*/, "") : "Not recorded"}</td><td>Not linked</td></tr>;
            }) : <tr><td colSpan={6} className="py-4 text-center text-gray-400">No completed renewal history is recorded for this product.</td></tr>}</tbody></table></div>
            <button type="button" onClick={() => setActiveTab("Renewals")} className="mt-3 block w-full text-center text-[9px] font-medium text-blue-600 hover:underline">View all renewal history →</button>
          </DetailCard>
        </section>

        <section id="renewal-detail-downloads">
          <DetailCard title="Downloads">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-100 p-2"><div className="flex items-center gap-2"><BrandMark brand={row.brand} image={row.productImage} /><div><p className="text-[9px] font-semibold text-gray-700">{row.product}</p><p className="text-[8px] text-gray-400">Generated from this saved renewal record</p></div></div><div className="flex gap-2"><button type="button" onClick={() => downloadRenewalFile(row, "license")} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[8px] text-gray-600 hover:bg-gray-50"><Download className="h-3 w-3" /> License record</button><button type="button" onClick={() => downloadRenewalFile(row, "renewal")} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[8px] text-gray-600 hover:bg-gray-50"><Download className="h-3 w-3" /> Summary</button></div></div>
            <button type="button" onClick={() => scrollToTab("Downloads")} className="mt-3 block w-full text-center text-[9px] font-medium text-blue-600 hover:underline">View all downloads →</button>
          </DetailCard>
        </section>

        <section id="renewal-detail-invoices">
          <DetailCard title="Invoices">
            <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-[9px]"><thead><tr className="border-b border-gray-100 text-left text-[8px] uppercase text-gray-400"><th className="pb-2">Invoice ID</th><th className="pb-2">Invoice Date</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2">Due Date</th><th className="pb-2">Actions</th></tr></thead><tbody>{linkedInvoices.length ? linkedInvoices.map(invoice => <tr key={invoice.id} className="border-b border-gray-100"><td className="py-2 text-blue-600">{invoice.invoiceNumber}</td><td>{wizardDateLabel(invoice.invoiceDate)}</td><td>{invoice.grandTotal ? formatCurrencyAmount(String(invoice.grandTotal)) : "Not recorded"}</td><td>{invoice.status}</td><td>{wizardDateLabel(invoice.dueDate)}</td><td><button type="button" onClick={() => { void downloadInvoicePdf(invoice).catch(error => console.error("Could not download linked renewal invoice", error)); }} className="text-blue-600 hover:underline"><Download className="inline h-3 w-3" /> Download</button></td></tr>) : <tr><td colSpan={6} className="py-5 text-center text-gray-400">No invoice is linked to this renewal.</td></tr>}</tbody></table></div>
            <button type="button" onClick={() => scrollToTab("Invoices")} className="mt-3 block w-full text-center text-[9px] font-medium text-blue-600 hover:underline">View all invoices →</button>
          </DetailCard>
        </section>

        <section id="renewal-detail-activity-log">
          <DetailCard title="Activity Log">
            <div className="space-y-3 text-[9px]">
              {itemStatus.toLowerCase() === "delivered" && <div className="flex gap-2"><Activity className="mt-0.5 h-3 w-3 text-blue-500" /><p><span className="font-semibold text-gray-700">Linked order marked delivered</span><span className="ml-2 text-gray-400">{row.deliveryDate ? wizardDateLabel(row.deliveryDate) : "Date not recorded"}</span><br /><span className="text-gray-500">Status read from the linked order.</span></p></div>}
              {row.createdAt && <div className="flex gap-2"><Activity className="mt-0.5 h-3 w-3 text-gray-400" /><p><span className="font-semibold text-gray-700">Renewal created</span><span className="ml-2 text-gray-400">{wizardDateLabel(row.createdAt.slice(0, 10))}</span><br /><span className="text-gray-500">Creation time saved on this renewal.</span></p></div>}
              {itemStatus.toLowerCase() !== "delivered" && !row.createdAt && <p className="py-4 text-center text-gray-400">No activity is recorded for this renewal.</p>}
            </div>
          </DetailCard>
        </section>

        <section id="renewal-detail-notes">
          <DetailCard title="Notes">
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111827", marginBottom: 1 }}>Notes</div>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 14 }}>
                {notes.length} note{notes.length !== 1 ? "s" : ""}
              </div>
              {notes.map((item, index) => (
                <div key={item.id} style={{ display: "flex", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: index < notes.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {(item.author?.[0] || "S").toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>{item.author}</span>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{item.date}</span>
                      <span style={{ fontSize: 11, background: item.visibility === "Internal Note" ? "#eff6ff" : "#faf5ff", color: item.visibility === "Internal Note" ? "#1d4ed8" : "#7c3aed", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                        {item.visibility === "Internal Note" ? "🔒 Internal" : "🌐 Visible to client"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>{item.text}</div>
                  </div>
                </div>
              ))}
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginTop: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px" }}>
                  <div style={{ padding: "14px 16px", borderRight: "1px solid #e5e7eb" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: "#111827" }}>Add Note</div>
                    <textarea
                      value={noteText}
                      onChange={event => { if (event.target.value.length <= 500) setNoteText(event.target.value); }}
                      placeholder="Write your note here..."
                      rows={4}
                      style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13.5, fontFamily: "inherit", color: "#374151", boxSizing: "border-box", background: "transparent" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>{noteText.length} / 500</div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Visibility</div>
                      {[
                        ["Internal Note", "🔒", "Only visible to internal users"],
                        ["External Note", "🌐", "Visible to the client on the portal"],
                      ].map(([label, icon, sub]) => (
                        <div key={label} onClick={() => setVisibility(label as RenewalNote["visibility"])} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
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
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={handleAddNote}
                        disabled={!noteText.trim()}
                        style={{ padding: "8px 22px", border: "none", borderRadius: 8, background: noteText.trim() ? "#2563eb" : "#93c5fd", color: "#fff", cursor: noteText.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>
        </section>

        <div className="flex items-center gap-2 rounded bg-blue-50 px-3 py-2 text-[8px] text-blue-700"><ShieldCheck className="h-3 w-3" /> License keys are encrypted and visible only to authorized users. For security, sharing license keys externally is restricted.</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded border border-gray-200 px-3 py-1.5 text-[9px] font-medium text-gray-700 hover:bg-gray-50"><Pencil className="h-3 w-3" /> Edit Renewal</button>
          <button type="button" onClick={onRenew} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-[9px] font-semibold text-white hover:bg-emerald-700"><Check className="h-3 w-3" /> Mark as Renewed</button>
        </div>
      </main>
    </div>
  );
}

function RenewalActionMenu({
  row,
  open,
  onToggle,
  onEdit,
  onRenew,
  onRemove,
}: {
  row: Renewal;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRenew: () => void;
  onRemove: () => void;
}) {
  return (
    <div data-renewal-action-menu className={`relative inline-block ${open ? "z-50" : ""}`}>
      <button
        type="button"
        aria-label={`Actions for ${row.id}`}
        onClick={event => {
          event.stopPropagation();
          onToggle();
        }}
        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-48 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-xl">
          <button type="button" onClick={event => { event.stopPropagation(); onEdit(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[10px] text-gray-700 hover:bg-gray-50">
            <Pencil className="h-3 w-3" /> Edit renewal
          </button>
          <button type="button" onClick={event => { event.stopPropagation(); onRenew(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[10px] text-gray-700 hover:bg-gray-50">
            <Check className="h-3 w-3 text-emerald-600" /> Mark as renewed
          </button>
          <button type="button" onClick={event => { event.stopPropagation(); onRemove(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[10px] text-rose-600 hover:bg-rose-50">
            <Trash2 className="h-3 w-3" /> Remove renewal
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyRenewalsPage() {
  const { orders: liveOrders } = useMyOrders();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [renewals, setRenewals] = useState<Renewal[]>(() => readStoredRenewals(RENEWALS_STORAGE_KEY));
  const [renewalHistory, setRenewalHistory] = useState<Renewal[]>(() => readStoredRenewals(RENEWAL_HISTORY_STORAGE_KEY));
  const [liveClients, setLiveClients] = useState<StoredClient[]>(() => getClients().filter(item => !isSharedClient(item.id)));
  const [liveCatalog, setLiveCatalog] = useState<CatalogProduct[]>(() => getCatalogProducts());
  const [liveUsers, setLiveUsers] = useState<NidoUser[]>(() => getUsers());
  const [livePortalUsers, setLivePortalUsers] = useState<PortalUser[]>(() => getPortalUsers());
  const [liveInvoices, setLiveInvoices] = useState<StoredInvoice[]>(() => getInvoices());
  const [client, setClient] = useState("All Clients");
  const [status, setStatus] = useState("All Statuses");
  const [renewalStatus, setRenewalStatus] = useState("All");
  const [licenseType, setLicenseType] = useState("All");
  const [dateRange, setDateRange] = useState("Select Range");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [autoRenewOnly, setAutoRenewOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showNewRenewal, setShowNewRenewal] = useState(false);
  const [editingRenewal, setEditingRenewal] = useState<Renewal | undefined>();
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | undefined>();
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [orderStatusVersion, setOrderStatusVersion] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const liveWizardOrders = useMemo(
    () => createRenewalWizardOrders(liveOrders, liveCatalog).filter(order =>
      liveClients.some(clientRecord =>
        clientRecord.id && order.clientId
          ? clientRecord.id === order.clientId
          : clientRecord.name === order.client,
      ),
    ),
    [liveCatalog, liveClients, liveOrders, orderStatusVersion],
  );
  const liveWizardInitialValues = useMemo(
    () => createInitialRenewalWizardValues(),
    [],
  );

  useEffect(() => {
    const reloadLiveSources = () => {
      setLiveClients(getClients().filter(item => !isSharedClient(item.id)));
      setLiveCatalog(getCatalogProducts());
    };
    const reloadLiveRecipients = () => {
      setLiveUsers(getUsers());
      setLivePortalUsers(getPortalUsers());
    };
    const reloadInvoices = () => setLiveInvoices(getInvoices());
    const reloadStoredRenewals = (event?: StorageEvent) => {
      if (!event || event.key === RENEWALS_STORAGE_KEY || event.key === null) {
        setRenewals(readStoredRenewals(RENEWALS_STORAGE_KEY));
      }
      if (!event || event.key === RENEWAL_HISTORY_STORAGE_KEY || event.key === null) {
        setRenewalHistory(readStoredRenewals(RENEWAL_HISTORY_STORAGE_KEY));
      }
    };
    const refreshAllLiveData = () => {
      reloadLiveSources();
      reloadLiveRecipients();
      reloadInvoices();
      reloadStoredRenewals();
      setOrderStatusVersion(current => current + 1);
    };
    const onStorage = (event: StorageEvent) => {
      const key = event.key;
      if (
        key === null ||
        key === "nido_catalog_products" ||
        key?.startsWith("nido_clients_v3:")
      ) reloadLiveSources();
      if (key === null || key === "nido_config_users" || key === "nido_portal_users") reloadLiveRecipients();
      if (key === null || key === "nido_sales_invoices") reloadInvoices();
      reloadStoredRenewals(event);
      if (key === null || key?.startsWith("nido_subitems_")) {
        setOrderStatusVersion(current => current + 1);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshAllLiveData();
    };
    window.addEventListener("nidoClientsUpdated", reloadLiveSources);
    window.addEventListener("catalogUpdated", reloadLiveSources);
    window.addEventListener(NIDO_USERS_EVENT, reloadLiveRecipients);
    window.addEventListener("nidoPortalUsersUpdated", reloadLiveRecipients);
    window.addEventListener("nidoInvoicesUpdated", reloadInvoices);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshAllLiveData);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const reloadOrderStatuses = () => setOrderStatusVersion(current => current + 1);
    window.addEventListener("orderSubItemsUpdated", reloadOrderStatuses);
    return () => {
      window.removeEventListener("nidoClientsUpdated", reloadLiveSources);
      window.removeEventListener("catalogUpdated", reloadLiveSources);
      window.removeEventListener(NIDO_USERS_EVENT, reloadLiveRecipients);
      window.removeEventListener("nidoPortalUsersUpdated", reloadLiveRecipients);
      window.removeEventListener("nidoInvoicesUpdated", reloadInvoices);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshAllLiveData);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("orderSubItemsUpdated", reloadOrderStatuses);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RENEWALS_STORAGE_KEY, JSON.stringify(renewals));
  }, [renewals]);

  useEffect(() => {
    window.localStorage.setItem(RENEWAL_HISTORY_STORAGE_KEY, JSON.stringify(renewalHistory));
  }, [renewalHistory]);

  useEffect(() => {
    if (!actionMenuId) return;

    const closeMenuOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-renewal-action-menu]")) {
        setActionMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeMenuOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
  }, [actionMenuId]);

  const activeRows = activeTab === "Renewal History" ? renewalHistory : renewals;

  const filteredRenewals = useMemo(() => {
    return activeRows.filter((row) => {
      const search = query.trim().toLowerCase();
      const matchesQuery =
        !search ||
        row.id.toLowerCase().includes(search) ||
        row.product.toLowerCase().includes(search) ||
        row.client.toLowerCase().includes(search) ||
        row.licenseType.toLowerCase().includes(search) ||
        row.amount.toLowerCase().includes(search);
      const matchesClient = client === "All Clients" || row.client.includes(client);
      const matchesStatus = status === "All Statuses" || row.autoRenew === status;
      const matchesRenewalStatus =
        renewalStatus === "All" || row.renewalStatus === renewalStatus;
      const matchesLicenseType =
        licenseType === "All" || row.licenseType.includes(licenseType);
      const dueDays = getDueDays(row);
      const matchesDateRange =
        dateRange === "Select Range" ||
        (dateRange === "Next 30 Days" && dueDays >= 0 && dueDays <= 30) ||
        (dateRange === "Next 60 Days" && dueDays >= 0 && dueDays <= 60) ||
        (dateRange === "This Year" && dueDays >= 0);
      const matchesTab =
        activeTab === "Overview" ||
        activeTab === "Calendar View" ||
        activeTab === "Renewal History" ||
        (activeTab === "Upcoming Renewals" && dueDays >= 0 && dueDays <= 30) ||
        (activeTab === "Expiring Soon" && dueDays >= 0 && dueDays <= 60) ||
        (activeTab === "Auto Renewals" && row.autoRenew === "Enabled");
      return (
        matchesQuery &&
        matchesClient &&
        matchesStatus &&
        matchesRenewalStatus &&
        matchesLicenseType &&
        matchesDateRange &&
        matchesTab &&
        (!autoRenewOnly || row.autoRenew === "Enabled")
      );
    });
  }, [activeRows, activeTab, autoRenewOnly, client, dateRange, licenseType, query, renewalStatus, status]);

  const sortedRenewals = useMemo(
    () => [...filteredRenewals].sort((first, second) => {
      const difference = new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime();
      return sortDirection === "asc" ? difference : -difference;
    }),
    [filteredRenewals, sortDirection],
  );
  const totalPages = Math.max(1, Math.ceil(sortedRenewals.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = sortedRenewals.slice((safePage - 1) * pageSize, safePage * pageSize);
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    return Array.from({ length: 42 }, (_, index) => new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      index - firstDay + 1,
    ));
  }, [calendarMonth]);

  const metrics = [
    {
      label: "Total Renewals",
      value: renewals.length + renewalHistory.length,
      note: "All time",
      icon: CalendarDays,
      iconClass: "bg-blue-50 text-blue-600",
      onClick: () => {
        setActiveTab("Overview");
        setRenewalStatus("All");
        setPage(1);
      },
    },
    {
      label: "Upcoming (0–30 days)",
      value: renewals.filter(row => getDueDays(row) >= 0 && getDueDays(row) <= 30).length,
      note: "Next 30 days",
      icon: Clock3,
      iconClass: "bg-emerald-50 text-emerald-600",
      onClick: () => {
        setActiveTab("Upcoming Renewals");
        setPage(1);
      },
    },
    {
      label: "Due Soon (31–60 days)",
      value: renewals.filter(row => getDueDays(row) > 30 && getDueDays(row) <= 60).length,
      note: "Next 31–60 days",
      icon: CalendarDays,
      iconClass: "bg-amber-50 text-amber-600",
      onClick: () => {
        setActiveTab("Expiring Soon");
        setDateRange("Next 60 Days");
        setPage(1);
      },
    },
    {
      label: "Overdue",
      value: renewals.filter(row => row.renewalStatus === "Overdue").length,
      note: "Past due",
      icon: AlertTriangle,
      iconClass: "bg-rose-50 text-rose-600",
      onClick: () => {
        setActiveTab("Overview");
        setRenewalStatus("Overdue");
        setPage(1);
      },
    },
    {
      label: "Auto Renewals",
      value: renewals.filter(row => row.autoRenew === "Enabled").length,
      note: "Enabled",
      icon: Repeat2,
      iconClass: "bg-purple-50 text-purple-600",
      onClick: () => {
        setActiveTab("Auto Renewals");
        setPage(1);
      },
    },
  ];

  const saveRenewal = (values: RenewalFormValues) => {
    const dueDays = Math.ceil((new Date(`${values.dueDate}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const renewal: Renewal = {
      ...values,
      id: editingRenewal?.id ?? nextRenewalId([...renewals, ...renewalHistory]),
      clientId: editingRenewal?.clientId ?? liveClients.find(item => item.name === values.client)?.id,
      createdAt: editingRenewal?.createdAt ?? new Date().toISOString(),
      dueDate: displayDateFromInputDate(values.dueDate),
      dueIn: dueDays < 0 ? `Overdue by ${Math.abs(dueDays)} days` : `Due in ${dueDays} days`,
      renewalStatus: getRenewalStatus(values.dueDate),
    };
    if (editingRenewal) {
      setRenewals(current => current.map(row => row.id === renewal.id ? renewal : row));
    } else {
      setRenewals(current => [renewal, ...current]);
    }
    setShowNewRenewal(false);
    setEditingRenewal(undefined);
  };

  const createRenewalFromWizard = (
    values: RenewalWizardValues,
    selectedItems: RenewalWizardSelectedProduct[],
  ): Renewal[] => {
    const createdAt = new Date().toISOString();
    const baseRecords = [...renewals, ...renewalHistory];
    const generatedRenewals: Renewal[] = [];
    selectedItems.forEach(({ subOrderId, product }) => {
      const renewalStartDate = values.renewalStartDate || product.renewalStartDate;
      const renewalTerm = values.renewalTerm || product.renewalTerm;
      const dueDateInput = wizardNextExpiryDate(renewalStartDate, renewalTerm);
      const dueDays = Math.ceil((new Date(`${dueDateInput}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      const quantity = renewalProductQuantity(product, values, selectedItems.length);
      const unitPrice = renewalProductUnitPrice(product, values, selectedItems.length);
      const total = (Number(quantity) || 0) * (Number(unitPrice) || 0) * renewalTermYears(renewalTerm);

      generatedRenewals.push({
        id: nextRenewalId([...baseRecords, ...generatedRenewals]),
        product: product.name,
        brand: product.brand,
        client: values.client,
        clientId: liveWizardOrders.find(order => order.id === values.order)?.clientId
          ?? liveClients.find(item => item.name === values.client)?.id,
        licenseType: product.licenseType,
        seats: quantity,
        dueDate: wizardDateLabel(dueDateInput),
        dueIn: dueDays < 0 ? `Overdue by ${Math.abs(dueDays)} days` : `Due in ${dueDays} days`,
        amount: formatCurrencyAmount(String(total)),
        renewalStatus: getRenewalStatus(dueDateInput),
        autoRenew: values.autoRenew ? "Enabled" : "Disabled",
        orderId: values.order,
        subOrderId,
        orderDate: values.orderDate,
        deliveryDate: values.deliveryDate,
        currentExpiryDate: product.currentExpiryDate || values.currentExpiryDate,
        renewalStartDate,
        renewalTerm,
        quantity,
        unitPrice,
        contractNo: values.contractNo || product.contractNo,
        purchaseOrderNo: values.purchaseOrderNo || product.purchaseOrderNo,
        reminders: values.reminders.length ? values.reminders : product.reminders,
        notifyTo: values.notifyTo,
        notificationMessage: values.notificationMessage || product.notificationMessage,
        notes: values.notes || product.notes,
        createdAt,
      });
    });
    setRenewals(current => [...generatedRenewals, ...current]);
    return generatedRenewals;
  };

  const markRenewed = (row: Renewal) => {
    setRenewals(current => current.filter(item => item.id !== row.id));
    setRenewalHistory(current => [{ ...row, dueIn: `Renewed ${new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}` }, ...current]);
    setActionMenuId(null);
    setSelectedRenewal(undefined);
  };

  const removeRenewal = (row: Renewal) => {
    setRenewals(current => current.filter(item => item.id !== row.id));
    setRenewalHistory(current => current.filter(item => item.id !== row.id));
    setActionMenuId(null);
    setSelectedRenewal(undefined);
  };

  const editRenewal = (row: Renewal) => {
    setEditingRenewal(row);
    setShowNewRenewal(true);
    setActionMenuId(null);
  };

  const handleTabChange = (tab: (typeof TABS)[number]) => {
    setActiveTab(tab);
    setPage(1);
    setActionMenuId(null);
  };

  if (showNewRenewal && !editingRenewal) {
    return (
      <NewRenewalWizard
        onCancel={() => setShowNewRenewal(false)}
        onCreate={createRenewalFromWizard}
        initialValues={liveWizardInitialValues}
        clients={liveClients}
        orders={liveWizardOrders}
        internalUsers={liveUsers}
        portalUsers={livePortalUsers}
        onView={renewal => {
          setShowNewRenewal(false);
          setSelectedRenewal(renewal);
        }}
      />
    );
  }

  if (selectedRenewal) {
    return (
      <RenewalDetailsPage
        row={selectedRenewal}
        sourceOrder={liveOrders.find(order => order.id === selectedRenewal.orderId)}
        sourceClient={liveClients.find(clientRecord =>
          selectedRenewal.clientId
            ? clientRecord.id === selectedRenewal.clientId
            : clientRecord.name === selectedRenewal.client,
        )}
        history={renewalHistory}
        invoices={liveInvoices}
        onBack={() => setSelectedRenewal(undefined)}
        onEdit={() => {
          setSelectedRenewal(undefined);
          editRenewal(selectedRenewal);
        }}
        onRenew={() => markRenewed(selectedRenewal)}
        onRemove={() => removeRenewal(selectedRenewal)}
        onManageRenewal={() => {
          setSelectedRenewal(undefined);
          editRenewal(selectedRenewal);
        }}
      />
    );
  }

  return (
    <div className="renewals-page min-h-screen bg-white px-1.5 pb-10 pt-5 text-gray-900 sm:pt-7">
      <RenewalTypography />
      <header className="flex items-start justify-between gap-4 px-1.5 pb-2 pt-1.5 sm:px-2">
        <div>
          <h1 className="text-[19px] font-bold leading-6 tracking-[-0.35px] text-gray-900">
            Renewals
          </h1>
          <p className="mt-0.5 text-[10px] leading-4 text-gray-500">
            Monitor and manage all license and subscription renewals
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => exportRenewals(sortedRenewals)}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[10px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 active:scale-[0.98]"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
          <button
            type="button"
            className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
            onClick={() => {
              setEditingRenewal(undefined);
              setShowNewRenewal(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Renewal
          </button>
        </div>
      </header>

      <nav className="flex min-w-max items-end border-b border-gray-200 px-1.5 sm:px-2">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`relative h-9 px-3.5 text-[10px] font-medium transition-colors ${
              activeTab === tab ? "text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </nav>

      <main className="space-y-4 px-1.5 pt-3 sm:px-2">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <button
                type="button"
                key={metric.label}
                onClick={metric.onClick}
                className="flex min-h-[78px] items-center gap-3 rounded-[10px] border border-gray-200 bg-white px-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${metric.iconClass}`}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[9px] text-gray-500">{metric.label}</p>
                  <p className="mt-0.5 text-[21px] font-bold leading-6 text-gray-900">{metric.value}</p>
                  <p className="mt-0.5 text-[9px] text-gray-500">{metric.note}</p>
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-[10px] border border-gray-200 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-6">
            <SelectField
              label="Client"
              value={client}
              options={["All Clients", "Nido Tech", "Cloud Systems", "InfoTech", "Apex Tech"]}
              onChange={(value) => {
                setClient(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Status"
              value={status}
              options={["All Statuses", "Enabled", "Disabled"]}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Renewal Status"
              value={renewalStatus}
              options={["All", "Upcoming", "Due Soon", "Overdue"]}
              onChange={(value) => {
                setRenewalStatus(value);
                setPage(1);
              }}
            />
            <SelectField
              label="License Type"
              value={licenseType}
              options={["All", "Subscription", "Perpetual"]}
              onChange={(value) => {
                setLicenseType(value);
                setPage(1);
              }}
            />
            <SelectField
              label="Due Date"
              value={dateRange}
              options={["Select Range", "Next 30 Days", "Next 60 Days", "This Year"]}
             onChange={value => {
               setDateRange(value);
               setPage(1);
             }}
            />
            <div className="relative self-end">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[10px] font-medium transition-colors ${
                  filtersOpen
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Filter className="h-3 w-3" />
                More Filters
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-gray-200 bg-white p-3 text-[10px] text-gray-600 shadow-xl">
                  <p className="font-semibold text-gray-800">Additional filters</p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoRenewOnly}
                      onChange={event => {
                        setAutoRenewOnly(event.target.checked);
                        setPage(1);
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show auto-renew enabled only</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setClient("All Clients");
                      setStatus("All Statuses");
                      setRenewalStatus("All");
                      setLicenseType("All");
                      setDateRange("Select Range");
                      setAutoRenewOnly(false);
                      setQuery("");
                      setPage(1);
                    }}
                    className="mt-3 text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {activeTab === "Calendar View" ? (
          <section className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex h-12 items-center justify-between border-b border-gray-100 px-3.5">
              <div>
                <h2 className="text-[11px] font-semibold text-gray-800">
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h2>
                <p className="text-[9px] text-gray-500">Select a renewal to view its details</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="h-7 rounded-lg border border-gray-200 px-2.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/80 text-center text-[9px] font-semibold uppercase text-gray-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {calendarCells.map(day => {
                const dayRows = filteredRenewals.filter(row => {
                  const dueDate = new Date(row.dueDate);
                  return dueDate.getFullYear() === day.getFullYear() &&
                    dueDate.getMonth() === day.getMonth() &&
                    dueDate.getDate() === day.getDate();
                });
                const inMonth = day.getMonth() === calendarMonth.getMonth();
                return (
                  <div key={day.toISOString()} className={`min-h-[86px] border-b border-r border-gray-100 p-1.5 ${inMonth ? "bg-white" : "bg-gray-50/60"}`}>
                    <span className={`text-[10px] ${inMonth ? "text-gray-700" : "text-gray-300"}`}>{day.getDate()}</span>
                    <div className="mt-1 space-y-1">
                      {dayRows.map(row => (
                        <button
                          type="button"
                          key={row.id}
                          onClick={() => setSelectedRenewal(row)}
                          className={`block w-full truncate rounded px-1 py-1 text-left text-[8px] font-medium ${STATUS_STYLES[row.renewalStatus]} hover:opacity-80`}
                        >
                          {row.id} · {row.product}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
        <section className="overflow-visible rounded-[10px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 items-center justify-between gap-3 border-b border-gray-100 px-3.5">
            <h2 className="text-[11px] font-semibold text-gray-800">
              {activeTab === "Overview" ? "Renewal List" : activeTab} ({filteredRenewals.length})
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex h-7 w-[205px] items-center gap-2 rounded-lg border border-gray-200 px-2.5 text-gray-400 focus-within:border-blue-400">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search renewals..."
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400"
                />
              </label>
              <button
                type="button"
                title={viewMode === "table" ? "Switch to cards" : "Switch to table"}
                aria-label={viewMode === "table" ? "Switch to cards" : "Switch to table"}
                onClick={() => setViewMode(mode => mode === "table" ? "cards" : "table")}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
              >
                {viewMode === "table" ? <Grid2X2 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {viewMode === "table" ? (
          <div className="w-full overflow-visible">
            <table className="renewal-list-table text-[10px]">
              <colgroup>
                <col style={{ width: "9%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr className="h-8 border-b border-gray-100 bg-gray-50/80 text-[8px] font-semibold uppercase text-gray-500">
                  <th className="px-3 text-left">Renewal ID</th>
                  <th className="px-3 text-left">Product / License</th>
                  <th className="px-3 text-left">Client</th>
                  <th className="px-3 text-left">License Type</th>
                  <th className="px-3 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setSortDirection(direction => direction === "asc" ? "desc" : "asc");
                        setPage(1);
                      }}
                      className="inline-flex items-center gap-1 hover:text-gray-800"
                    >
                      Due Date <span className="text-gray-400">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    </button>
                  </th>
                  <th className="px-3 text-left">Amount</th>
                  <th className="px-3 text-left">Renewal Status</th>
                  <th className="px-3 text-left">Auto Renew</th>
                  <th className="px-3 text-left">Status</th>
                  <th className="px-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRenewal(row)}
                    className="h-[64px] cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-3 align-middle">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedRenewal(row);
                        }}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {row.id}
                      </button>
                    </td>
                    <td className="px-3 align-middle">
                      <div className="flex items-start gap-2">
                        <BrandMark brand={row.brand} />
                        <div className="min-w-0">
                          <p className="font-semibold leading-[14px] text-gray-800">{row.product}</p>
                          <span className="mt-1 inline-flex rounded bg-purple-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-purple-700">
                            Digital License
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 align-middle">
                      <p className="leading-[14px] text-gray-700">{row.client.split(" ").slice(0, 2).join(" ")}</p>
                      <p className="leading-[14px] text-gray-700">{row.client.split(" ").slice(2).join(" ")}</p>
                    </td>
                    <td className="px-3 align-middle">
                      <p className="leading-[14px] text-gray-700">{row.licenseType}</p>
                      <p className="leading-[14px] text-gray-700">{row.seats}</p>
                    </td>
                    <td className="px-3 align-middle">
                      <p className="text-gray-700">{row.dueDate}</p>
                      <p className={`mt-0.5 ${row.renewalStatus === "Overdue" ? "text-rose-600" : row.renewalStatus === "Due Soon" ? "text-amber-600" : "text-amber-600"}`}>
                        {row.dueIn}
                      </p>
                    </td>
                    <td className="px-3 align-middle font-semibold text-gray-800">{row.amount}</td>
                    <td className="px-3 align-middle">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-semibold ${STATUS_STYLES[row.renewalStatus]}`}>
                        {row.renewalStatus}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-medium ${row.autoRenew === "Enabled" ? "text-gray-700" : "text-gray-500"}`}>
                        {row.autoRenew === "Enabled" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-gray-400" />
                        )}
                        {row.autoRenew}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-600">
                        Active
                      </span>
                    </td>
                    <td className="px-2 text-center align-middle">
                      <RenewalActionMenu
                        row={row}
                        open={actionMenuId === row.id}
                        onToggle={() => setActionMenuId(actionMenuId === row.id ? null : row.id)}
                        onEdit={() => editRenewal(row)}
                        onRenew={() => markRenewed(row)}
                        onRemove={() => removeRenewal(row)}
                      />
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="h-40 text-center text-xs text-gray-400">
                      No renewals match the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRows.map(row => (
                <article
                  key={row.id}
                  onClick={() => setSelectedRenewal(row)}
                  className="cursor-pointer rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setSelectedRenewal(row);
                      }}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {row.id}
                    </button>
                    <RenewalActionMenu
                      row={row}
                      open={actionMenuId === row.id}
                      onToggle={() => setActionMenuId(actionMenuId === row.id ? null : row.id)}
                      onEdit={() => editRenewal(row)}
                      onRenew={() => markRenewed(row)}
                      onRemove={() => removeRenewal(row)}
                    />
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    <BrandMark brand={row.brand} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800">{row.product}</p>
                      <p className="mt-1 truncate text-[10px] text-gray-500">{row.client}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="block text-gray-400">Due date</span><span className="font-medium text-gray-700">{row.dueDate}</span></div>
                    <div><span className="block text-gray-400">Amount</span><span className="font-semibold text-gray-800">{row.amount}</span></div>
                    <div><span className="block text-gray-400">Renewal</span><span className={`font-medium ${row.renewalStatus === "Overdue" ? "text-rose-600" : "text-amber-600"}`}>{row.dueIn}</span></div>
                    <div><span className="block text-gray-400">Auto renew</span><span className="font-medium text-gray-700">{row.autoRenew}</span></div>
                  </div>
                </article>
              ))}
              {visibleRows.length === 0 && (
                <p className="col-span-full py-12 text-center text-xs text-gray-400">No renewals match the selected filters</p>
              )}
            </div>
          )}

          <footer className="flex h-10 items-center justify-between border-t border-gray-100 px-3.5">
            <span className="text-[10px] text-gray-500">
              {filteredRenewals.length > 0
                ? `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, filteredRenewals.length)} of ${filteredRenewals.length} renewals`
                : "Showing 0 renewals"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                <button
                  type="button"
                  key={number}
                  onClick={() => setPage(number)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[10px] font-medium transition-colors ${
                    safePage === number
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPageSize(current => current === 10 ? 20 : current === 20 ? 50 : 10)}
                className="ml-2 flex h-7 items-center gap-3 rounded-lg border border-gray-200 px-2.5 text-[10px] text-gray-700 transition-colors hover:bg-gray-50"
              >
                {pageSize} / page
                <ChevronDown className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          </footer>
        </section>
        )}
      </main>
      {showNewRenewal && editingRenewal && (
        <RenewalFormModal
          initial={editingRenewal}
          onClose={() => {
            setShowNewRenewal(false);
            setEditingRenewal(undefined);
          }}
          onSave={saveRenewal}
        />
      )}
    </div>
  );
}