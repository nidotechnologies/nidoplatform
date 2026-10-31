import { ROLE_PERMISSION_MODULE_OPTIONS } from "@/lib/platformModuleCatalog";
import { getClients, getArchivedClients } from "@/lib/clientStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getAllVendorProducts } from "@/lib/vendorStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getQuotes } from "@/lib/quoteStore";
import { getOrders as getSalesOrders } from "@/lib/salesOrderStore";
import { getInvoices, getArchivedInvoices } from "@/lib/invoiceStore";
import { getReceipts } from "@/lib/paymentReceiptStore";
import { getChallans } from "@/lib/dcStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getAllRecurring } from "@/lib/recurringInvoiceStore";
import { getCustomReports } from "@/lib/reportStore";

export type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: "page" | "record";
  path: string;
  searchText: string;
};

const SENSITIVE_KEY = /password|secret|token|cvv|card(number)?|account(number)?|ifsc|session/i;
const IGNORED_STORAGE_KEY = /^(nido_user|nido_role_permissions|nido_rbac_|nido_custom_modules|sidebar|theme|preferences|checkout)/i;

const routeHints: Array<[RegExp, string]> = [
  [/quote/, "/sales/quotes"],
  [/invoice/, "/invoices"],
  [/purchase.?order|^po/, "/purchase-orders"],
  [/bill/, "/bills"],
  [/expense/, "/expenses"],
  [/payment/, "/payment-receipts"],
  [/credit.?note/, "/credit-notes"],
  [/delivery.?challan/, "/delivery-challans"],
  [/eway/, "/eway-bills"],
  [/order/, "/orders"],
  [/vendor/, "/vendors"],
  [/client|portal/, "/clients"],
  [/contract/, "/contracts"],
  [/user|role/, "/configuration/nido-users"],
  [/report/, "/reports"],
  [/service/, "/services"],
  [/support|ticket/, "/support"],
  [/catalog|product/, "/master-catalogue"],
  [/location/, "/locations"],
  [/department/, "/departments"],
];

const titleKeys = [
  "name",
  "title",
  "profileName",
  "productName",
  "masterProductCode",
  "vendorProductCode",
  "subject",
  "number",
  "challanNo",
  "customerName",
  "clientName",
  "vendorName",
  "invoiceNumber",
  "quoteNumber",
  "orderNumber",
  "poNumber",
  "employeeId",
  "code",
  "sku",
  "email",
  "id",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeValue);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, nestedValue]) => [key, safeValue(nestedValue)]),
    );
  }
  return value;
}

function textFromValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textFromValue).join(" ");
  if (isObject(value)) {
    return Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, nestedValue]) => `${key} ${textFromValue(nestedValue)}`)
      .join(" ");
  }
  return "";
}

function getTitle(record: Record<string, unknown>, fallback: string): string {
  for (const key of titleKeys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return fallback;
}

function getSubtitle(record: Record<string, unknown>, storageKey: string): string {
  const preferredKeys = ["description", "status", "type", "clientName", "vendorName", "role", "department"];
  const parts = preferredKeys
    .map(key => record[key])
    .filter(value => typeof value === "string" || typeof value === "number")
    .map(String)
    .filter(Boolean)
    .slice(0, 2);
  return parts.length > 0 ? parts.join(" · ") : storageKey.replace(/[_-]+/g, " ");
}

type SearchRecordSource = {
  key: string;
  label: string;
  path: string;
  getRecords: () => unknown[];
};

const RECORD_SOURCES: SearchRecordSource[] = [
  { key: "clients", label: "Clients", path: "/clients", getRecords: () => [...getClients(), ...getArchivedClients()] },
  { key: "vendors", label: "Vendors", path: "/vendors", getRecords: getVendors },
  { key: "catalog", label: "Master catalogue", path: "/configuration/master-catalogue", getRecords: getCatalogProducts },
  {
    key: "vendor-products",
    label: "Vendor products",
    path: "/vendors",
    getRecords: () => Object.entries(getAllVendorProducts()).flatMap(([vendorId, products]) =>
      products.map(product => ({ ...product, vendorId })),
    ),
  },
  { key: "orders", label: "Orders", path: "/orders", getRecords: () => readJsonList("nido_my_orders") },
  { key: "quotes", label: "Quotes", path: "/sales/quotes", getRecords: getQuotes },
  { key: "sales-orders", label: "Sales orders", path: "/sales/orders", getRecords: getSalesOrders },
  { key: "invoices", label: "Invoices", path: "/invoices", getRecords: () => [...getInvoices(), ...getArchivedInvoices()] },
  { key: "purchase-orders", label: "Purchase orders", path: "/purchase-orders", getRecords: getAllPOs },
  { key: "payment-receipts", label: "Payment receipts", path: "/payment-receipts", getRecords: getReceipts },
  { key: "delivery-challans", label: "Delivery challans", path: "/delivery-challans", getRecords: getChallans },
  { key: "services", label: "Service requests", path: "/my-services", getRecords: getServiceRequests },
  { key: "support", label: "Support tickets", path: "/support/tickets", getRecords: getSupportTickets },
  { key: "recurring-invoices", label: "Recurring invoices", path: "/recurring-invoices", getRecords: getAllRecurring },
  { key: "custom-reports", label: "Custom reports", path: "/reports", getRecords: getCustomReports },
];

const COVERED_STORAGE_KEYS = new Set([
  "nido_clients_v2",
  "nido_clients_archived_v1",
  "nido_catalog_products",
  "nido_vendor_products",
  "nido_my_orders",
  "nido_sales_quotes",
  "nido_sales_orders",
  "nido_sales_invoices",
  "nido_all_purchase_orders",
  "nido_payment_receipts_v3",
  "nido_service_requests",
  "nido_support_tickets",
  "nido_recurring_invoices",
  "nido_custom_reports_v1",
]);

function readJsonList(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveRecordPath(source: SearchRecordSource, record: Record<string, unknown>): string {
  const id = typeof record.id === "string" || typeof record.id === "number" ? String(record.id) : "";
  if (!id) return source.path;

  switch (source.key) {
    case "clients":
      return `/clients/${encodeURIComponent(id)}`;
    case "vendors":
      return `/vendors/${encodeURIComponent(id)}`;
    case "catalog":
      return `/configuration/master-catalogue/edit/${encodeURIComponent(id)}`;
    case "orders":
      return `/orders/${encodeURIComponent(id)}`;
    case "quotes":
      return `/sales/quotes/${encodeURIComponent(id)}`;
    case "sales-orders":
      return `/sales/orders/${encodeURIComponent(id)}`;
    case "invoices":
      return `/sales/invoices/${encodeURIComponent(id)}`;
    case "support":
      return `/support/ticket/${encodeURIComponent(id)}`;
    default:
      return source.path;
  }
}

function getStorageRoute(storageKey: string): string {
  const normalized = storageKey.toLowerCase();
  const hint = routeHints.find(([pattern]) => pattern.test(normalized));
  return hint?.[1] ?? "/dashboard";
}

function collectRecords(
  value: unknown,
  storageKey: string,
  records: Array<{ record: Record<string, unknown>; index: number }>,
  indexRef: { value: number },
): void {
  if (Array.isArray(value)) {
    value.forEach(item => collectRecords(item, storageKey, records, indexRef));
    return;
  }
  if (!isObject(value)) return;

  const hasIdentity = titleKeys.some(key => {
    const candidate = value[key];
    return typeof candidate === "string" || typeof candidate === "number";
  });
  if (hasIdentity) {
    records.push({ record: value, index: indexRef.value });
    indexRef.value += 1;
    return;
  }

  Object.values(value).forEach(nestedValue => {
    if (isObject(nestedValue) || Array.isArray(nestedValue)) {
      collectRecords(nestedValue, storageKey, records, indexRef);
    }
  });
}

function getPageResults(): GlobalSearchResult[] {
  return ROLE_PERMISSION_MODULE_OPTIONS
    .filter(module => !module.path.includes(":"))
    .map(module => ({
      id: `page:${module.path}`,
      title: module.label,
      subtitle: "Platform page",
      type: "page" as const,
      path: module.path,
      searchText: `${module.label} ${module.description} ${module.path}`.toLowerCase(),
    }));
}

function getRecordResults(): GlobalSearchResult[] {
  if (typeof window === "undefined") return [];

  const results: GlobalSearchResult[] = [];
  RECORD_SOURCES.forEach(source => {
    let records: unknown[] = [];
    try {
      records = source.getRecords();
    } catch {
      records = [];
    }

    records.forEach((value, index) => {
      if (!isObject(value)) return;
      const sanitized = safeValue(value);
      const title = getTitle(value, source.label);
      const subtitle = getSubtitle(value, source.label);
      results.push({
        id: `record:${source.key}:${index}:${String(value.id ?? title)}`,
        title,
        subtitle: `${source.label} · ${subtitle}`,
        type: "record",
        path: resolveRecordPath(source, value),
        searchText: `${title} ${subtitle} ${source.label} ${textFromValue(sanitized)}`.toLowerCase(),
      });
    });
  });

  Object.keys(window.localStorage).forEach(storageKey => {
    if (IGNORED_STORAGE_KEY.test(storageKey)) return;
    if (COVERED_STORAGE_KEYS.has(storageKey)) return;

    let parsed: unknown;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const records: Array<{ record: Record<string, unknown>; index: number }> = [];
    collectRecords(parsed, storageKey, records, { value: 0 });
    records.forEach(({ record, index }) => {
      const sanitized = safeValue(record);
      const title = getTitle(record, storageKey.replace(/[_-]+/g, " "));
      const subtitle = getSubtitle(record, storageKey);
      results.push({
        id: `record:${storageKey}:${index}`,
        title,
        subtitle,
        type: "record",
        path: getStorageRoute(storageKey),
        searchText: `${title} ${subtitle} ${storageKey} ${textFromValue(sanitized)}`.toLowerCase(),
      });
    });
  });
  return results;
}

export function searchGlobalPlatform(query: string): GlobalSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  return [...getPageResults(), ...getRecordResults()]
    .filter(result => terms.every(term => result.searchText.includes(term)))
    .filter(result => {
      const key = `${result.path}|${result.title.toLowerCase()}|${result.subtitle.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => {
      const firstTitle = first.title.toLowerCase();
      const secondTitle = second.title.toLowerCase();
      const firstScore = firstTitle === normalizedQuery ? 3 : firstTitle.startsWith(normalizedQuery) ? 2 : 1;
      const secondScore = secondTitle === normalizedQuery ? 3 : secondTitle.startsWith(normalizedQuery) ? 2 : 1;
      const typeScore = (result: GlobalSearchResult) => result.type === "record" ? 1 : 0;
      return secondScore - firstScore
        || typeScore(second) - typeScore(first)
        || first.title.localeCompare(second.title);
    })
    .slice(0, 40);
}