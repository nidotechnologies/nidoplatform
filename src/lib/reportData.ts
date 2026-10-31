import { getClients } from "@/lib/clientStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getOrders } from "@/lib/salesOrderStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getUsers } from "@/lib/nidoUsersStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ReportFilters } from "@/contexts/ReportControlsContext";

export type ReportRecord = Record<string, unknown>;

export function getReportMonthKey(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getRecentReportMonths(count = 7, referenceDate = new Date()): Array<{ key: string; label: string }> {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - count + index + 1, 1);
    return {
      key: getReportMonthKey(date),
      label: new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(date),
    };
  });
}

function tagged<T extends object>(module: string, rows: T[]): ReportRecord[] {
  return rows.map((row) => ({ ...row, __module: module }));
}

function addLinkedClientNames(records: ReportRecord[]): ReportRecord[] {
  const clientNames = new Map<string, string>();
  for (const client of getClients()) {
    const row = client as ReportRecord;
    const name = String(row.name ?? row.clientName ?? row.companyName ?? "").trim();
    if (!name) continue;
    for (const key of [row.id, row.clientId]) {
      if (key !== undefined && key !== null && String(key).trim()) {
        clientNames.set(String(key), name);
      }
    }
  }
  return records.map((record) => {
    const payload = record.payload && typeof record.payload === "object"
      ? record.payload as ReportRecord
      : {};
    const clientId = record.clientId ?? payload.clientId;
    const linkedName = clientId === undefined || clientId === null
      ? undefined
      : clientNames.get(String(clientId));
    return {
      ...record,
      clientName: record.clientName ?? record.client ?? payload.clientName ?? linkedName,
    };
  });
}

export function getReportRecords(module: string): ReportRecord[] {
  switch (module) {
    case "Clients":
      return tagged("Clients", getClients());
    case "Vendors":
      return tagged("Vendors", getVendors());
    case "Catalog":
      return tagged("Catalog", getCatalogProducts());
    case "Orders":
      return tagged("Orders", getOrders());
    case "Services":
    case "Service Requests":
      return addLinkedClientNames(tagged("Services", getServiceRequests()));
    case "Support":
    case "Support Tickets":
      return addLinkedClientNames(tagged("Support Tickets", getSupportTickets()));
    case "Users":
      return tagged("Users", getUsers());
    case "All Modules":
      return [
        ...tagged("Clients", getClients()),
        ...tagged("Vendors", getVendors()),
        ...tagged("Catalog", getCatalogProducts()),
        ...tagged("Orders", getOrders()),
        ...addLinkedClientNames(tagged("Services", getServiceRequests())),
        ...addLinkedClientNames(tagged("Support Tickets", getSupportTickets())),
        ...tagged("Users", getUsers()),
      ];
    default:
      return [];
  }
}

const FIELD_ALIASES: Record<string, string[]> = {
  id: ["id", "employeeId", "clientId", "vendorId", "productId", "requestId", "number", "orderNumber", "poNumber"],
  createdon: ["createdAt", "createdOn", "createdOnDisplay", "created", "createdDate", "lastRunDate", "onboardedDate", "requestDate", "orderDate", "invoiceDate", "date", "timestamp", "created_at"],
  createdat: ["createdAt", "createdOn", "created", "lastRunDate", "requestDate", "orderDate", "invoiceDate", "date", "timestamp", "created_at"],
  createdby: ["createdByName", "createdBy", "createdByEmail", "requestedBy"],
  clientname: ["clientName", "client", "customerName"],
  clientid: ["clientId", "customerId"],
  clientemail: ["email", "clientEmail"],
  clientphone: ["phone", "mobile", "clientPhone"],
  clientcity: ["city", "billingCity", "shippingCity"],
  contactperson: ["contactPerson", "rep", "primaryContact"],
  clientstatus: ["clientStatus", "status"],
  clienttier: ["tier", "clientTier"],
  contractstart: ["contractStartDate", "contractStart"],
  contractend: ["contractEndDate", "contractEnd"],
  vendorname: ["vendorName", "selectedVendorName"],
  vendoremail: ["email", "vendorEmail"],
  vendorphone: ["phone", "vendorPhone"],
  vendorcategory: ["category"],
  vendorstatus: ["vendorStatus", "status"],
  rating: ["rating"],
  itemname: ["productName", "itemName", "item", "itemAsset", "name"],
  sku: ["sku", "skuCode", "productCode", "masterProductCode", "itemCode"],
  category: ["category", "requestType"],
  price: ["price", "unitPrice", "unitCost", "sellingPrice"],
  stock: ["stock", "quantity", "qty", "onHand", "availableStock"],
  unit: ["unit", "uom"],
  orderid: ["orderNumber", "id", "orderId"],
  orderdate: ["orderDate", "createdAt", "createdOn"],
  orderstatus: ["status"],
  amount: ["grandTotal", "totalAmount", "amount", "subtotal", "total"],
  tax: ["totalTax", "taxAmount", "tax"],
  total: ["grandTotal", "totalAmount", "total", "amount"],
  servicename: ["requestType", "serviceName", "name"],
  requestdate: ["requestDate", "createdAt", "createdOn"],
  status: ["status", "currentOrderStatus"],
  priority: ["priority"],
  assignedto: ["assignedTo", "agent", "owner"],
  ticketid: ["number", "ticketId", "id"],
  subject: ["subject", "title"],
  resolutiondate: ["resolvedAt", "resolutionDate", "closedAt"],
  agent: ["assignedTo", "agent"],
  username: ["name", "userName"],
  useremail: ["email", "userEmail"],
  userrole: ["role", "userRole"],
  userdepartment: ["department", "userDepartment"],
  userstatus: ["status", "userStatus"],
  jobtitle: ["jobTitle", "designation"],
  datejoined: ["dateOfJoining", "joinedAt"],
  lastlogin: ["lastLogin"],
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lookup(record: ReportRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
    const normalizedKey = normalized(key);
    const matchingKey = Object.keys(record).find((candidate) => normalized(candidate) === normalizedKey);
    if (matchingKey && record[matchingKey] !== undefined && record[matchingKey] !== null && record[matchingKey] !== "") {
      return record[matchingKey];
    }
  }
  const payload = record.payload;
  if (payload && typeof payload === "object") {
    const nested = payload as Record<string, unknown>;
    for (const key of keys) {
      const matchingKey = Object.keys(nested).find((candidate) => normalized(candidate) === normalized(key));
      if (matchingKey && nested[matchingKey] !== undefined && nested[matchingKey] !== null && nested[matchingKey] !== "") {
        return nested[matchingKey];
      }
    }
  }
  return undefined;
}

export function getReportFieldValue(record: ReportRecord, column: string): string {
  const fieldKey = normalized(column);
  const module = String(record.__module ?? "");
  const orderClientName = ["client", "clientname"].includes(fieldKey) && module === "Orders";
  const requestClientName = fieldKey === "clientname" && ["Services", "Support Tickets"].includes(module);
  const isMasterOrderRow = module === "Orders" && record["Master Order ID"] !== undefined;
  if (
    fieldKey.startsWith("client")
    && module
    && module !== "Clients"
    && !orderClientName
    && !requestClientName
  ) return "—";
  if (fieldKey.startsWith("vendor") && module && module !== "Vendors") return "—";
  if (["orderid", "orderdate", "orderstatus"].includes(fieldKey) && module && module !== "Orders") return "—";
  if (["itemname", "sku", "stock", "unit"].includes(fieldKey) && module && module !== "Catalog") return "—";
  if (["servicename", "requestdate"].includes(fieldKey) && module && module !== "Services") return "—";
  if (["ticketid", "subject", "resolutiondate", "agent", "priority"].includes(fieldKey) && module && module !== "Support Tickets") return "—";
  if (fieldKey.startsWith("user") && module && module !== "Users") return "—";
  const aliases = FIELD_ALIASES[fieldKey] ?? [column];
  const moduleAliases = fieldKey === "clientname" && module === "Clients"
    ? ["clientName", "name", ...aliases]
    : fieldKey === "clientname" && module === "Orders"
      ? ["clientName", "client", ...aliases]
      : fieldKey === "clientname" && module === "Services"
        ? ["clientName", "client", ...aliases]
        : fieldKey === "vendorname" && module === "Vendors"
          ? ["vendorName", "name", ...aliases]
          : aliases;
  const orderRawValues: Record<string, unknown> = module === "Orders"
    ? {
        id: isMasterOrderRow ? record["Master Order ID"] : record.orderNumber ?? record.id,
        orderid: isMasterOrderRow ? record["Master Order ID"] : record.orderNumber ?? record.id,
        createdon: isMasterOrderRow ? record["Created At"] : record.createdAt ?? record.createdOn,
        createdat: isMasterOrderRow ? record["Created At"] : record.createdAt ?? record.createdOn,
        orderdate: isMasterOrderRow ? record["Order Date"] : record.orderDate ?? record.createdAt,
        createdby: isMasterOrderRow
          ? record["Created By"]
          : record.createdBy ?? record.createdByName,
        client: isMasterOrderRow ? record.Client : record.clientName ?? record.client,
        clientname: isMasterOrderRow ? record.Client : record.clientName ?? record.client,
        orderstatus: isMasterOrderRow ? record["Current Order Status"] : record.status ?? record.currentOrderStatus,
        currentorderstatus: isMasterOrderRow ? record["Current Order Status"] : record.status ?? record.currentOrderStatus,
        amount: isMasterOrderRow ? record["Order Total"] : record.subtotal,
        tax: isMasterOrderRow ? record.Tax : record.totalTax ?? record.taxAmount,
        total: isMasterOrderRow ? record["Order Total"] : record.grandTotal ?? record.totalAmount,
        ordertotal: isMasterOrderRow ? record["Order Total"] : record.grandTotal ?? record.totalAmount,
      }
    : {};
  const raw = Object.prototype.hasOwnProperty.call(orderRawValues, fieldKey)
    ? orderRawValues[fieldKey]
    : lookup(record, moduleAliases);
  if (raw === undefined || raw === null || raw === "") return "—";

  if (["amount", "tax", "total", "ordertotal", "price", "lineamount", "unitprice"].includes(fieldKey)) {
    const amount = Number(raw);
    return Number.isFinite(amount) ? formatCurrency(amount) : String(raw);
  }
  if (["createdon", "createdat", "orderdate", "requestdate", "resolutiondate", "contractstart", "contractend", "datejoined", "lastlogin"].includes(fieldKey)) {
    return formatDate(String(raw));
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function getReportRecordDate(record: ReportRecord): string {
  const value = lookup(record, FIELD_ALIASES.createdon);
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "";
  return toLocalDateKey(value);
}

function toLocalDateKey(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function datePresetRange(filters: ReportFilters, now = new Date()): [string, string] | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateKey = (date: Date) => toLocalDateKey(date);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  switch (filters.datePreset) {
    case "today":
      return [dateKey(today), dateKey(today)];
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return [dateKey(yesterday), dateKey(yesterday)];
    }
    case "week":
      return [dateKey(startOfWeek), dateKey(today)];
    case "lastweek": {
      const end = new Date(startOfWeek);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return [dateKey(start), dateKey(end)];
    }
    case "month":
      return [dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), dateKey(today)];
    case "lastmonth":
      return [
        dateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        dateKey(new Date(today.getFullYear(), today.getMonth(), 0)),
      ];
    case "quarter": {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      return [dateKey(new Date(today.getFullYear(), quarterStartMonth, 1)), dateKey(today)];
    }
    case "fy": {
      const fyYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return [dateKey(new Date(fyYear, 3, 1)), dateKey(today)];
    }
    case "custom":
      return [filters.dateFrom, filters.dateTo];
    case "all":
    default:
      return null;
  }
}

function normalizedFieldValue(record: ReportRecord, candidates: string[]): string {
  const raw = lookup(record, candidates);
  return raw === undefined || raw === null ? "" : String(raw).toLowerCase();
}

/** Apply the common report toolbar filters to a module's source records. */
export function applyReportFilters<T extends object>(records: T[], filters: ReportFilters): T[] {
  const range = datePresetRange(filters);
  const selectedFields: Array<[string, string[]]> = [
    [filters.client, ["clientName", "client", "companyName", "name"]],
    [filters.vendor, ["vendorName", "vendor", "name"]],
    [filters.category, ["category", "requestType", "action"]],
    [filters.status, ["status", "severity", "lastRunStatus"]],
    [filters.user, ["user", "userName", "createdByName", "createdBy", "requestedBy", "assignedTo", "agent"]],
    [filters.branch, ["branch", "location", "branchName"]],
    [filters.department, ["department", "departmentName", "team"]],
  ];

  return records.filter((source) => {
    const record = source as ReportRecord;
    if (range) {
      const [from, to] = range;
      const recordDate = getReportRecordDate(record);
      if ((from || to) && !recordDate) return false;
      if (from && recordDate < from) return false;
      if (to && recordDate > to) return false;
    }

    return selectedFields.every(([selected, fields]) => {
      if (!selected) return true;
      const value = normalizedFieldValue(record, fields);
      return Boolean(value) && value === selected.toLowerCase();
    });
  });
}

export function applyStoredReportFilters<T extends ReportRecord>(
  records: T[],
  filters: Array<{ field: string; operator: string; value: string }> = [],
): T[] {
  const activeFilters = filters.filter((filter) => filter.field && filter.operator && filter.value !== "");
  if (activeFilters.length === 0) return records;
  return records.filter((record) => activeFilters.every((filter) => {
    const current = getReportFieldValue(record, filter.field);
    const target = filter.value;
    const left = current.toLowerCase();
    const right = target.toLowerCase();
    switch (filter.operator.toLowerCase()) {
      case "contains":
        return left.includes(right);
      case "does not contain":
        return !left.includes(right);
      case "not equals":
      case "is not":
        return left !== right;
      case "greater than":
        return Number(current.replace(/[^\d.-]/g, "")) > Number(target);
      case "less than":
        return Number(current.replace(/[^\d.-]/g, "")) < Number(target);
      case "is empty":
        return current === "—";
      case "is not empty":
        return current !== "—";
      case "equals":
      case "is":
      default:
        return left === right;
    }
  }));
}
