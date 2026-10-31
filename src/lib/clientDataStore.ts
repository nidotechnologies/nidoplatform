import { formatCurrency } from "./formatters";

const ORDERS_KEY = "nido_client_orders_v1";
const SERVICES_KEY = "nido_client_services_v1";
const ACTIVITIES_KEY = "nido_client_activities_v1";
const DOCUMENTS_KEY = "nido_client_documents_v1";
const CONTRACTS_KEY = "nido_client_contracts_v1";

interface SharedOrderCartItem {
  id?: string | number;
  productCode?: string;
  name?: string;
  category?: string;
  priceNum?: number | string;
  quantity?: number | string;
  clientId?: string;
  subOrderId?: string;
}

interface SharedOrderRecord {
  id: string;
  cartItems?: SharedOrderCartItem[];
  createdBy?: string;
  client?: string;
  orderDate?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  updateCount?: number;
  totalAmount?: string;
  totalAmountNum?: number | string;
  status?: string;
  orderedFor?: string;
  deferPurchaseOrders?: boolean;
  requester?: string;
  requestedBy?: string;
  requesterId?: string;
  requestedById?: string;
  requesterEmail?: string;
  requestedByEmail?: string;
  requesterRole?: string;
  assigned?: string;
  assignedRole?: string;
  orderTime?: string;
  slaTime?: string | null;
  slaAlert?: boolean;
  poNumber?: string;
  paymentMethod?: string;
  paymentDetail?: string;
  paymentTerms?: string;
  orderNotes?: string;
  deliveryAddress?: string;
  deliveryDetails?: {
    label?: string;
    attentionName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    phone?: string;
    instructions?: string;
  };
  cancelReason?: string;
}

export interface ClientOrderRecord {
  id: string;
  clientId: string;
  date: string;
  items: number;
  amount: string;
  amountNum: number;
  client: string;
  status: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  updateCount?: number;
  totalAmountNum?: number;
  cartItems?: SharedOrderCartItem[];
  orderedFor?: string;
  deferPurchaseOrders?: boolean;
  requester?: string;
  requesterRole?: string;
  assigned?: string;
  assignedRole?: string;
  orderTime?: string;
  slaTime?: string | null;
  slaAlert?: boolean;
  paymentMethod?: string;
  paymentDetail?: string;
  paymentTerms?: string;
  orderNotes?: string;
  deliveryAddress?: string;
  deliveryDetails?: SharedOrderRecord["deliveryDetails"];
  cancelReason?: string;
  notes?: string;
  requestedBy?: string;
  requestedById?: string;
  requestedByEmail?: string;
  poNumber?: string;
  productDetails?: Array<{
    id?: string;
    productCode?: string;
    name: string;
    category?: string;
    priceNum?: number;
    quantity?: number;
    subOrderId?: string;
  }>;
}

export interface ClientServiceRecord {
  id: string;
  clientId: string;
  name: string;
  provider: string;
  startDate: string;
  endDate: string;
  amount: string;
  status: string;
  category: string;
  description?: string;
  requestedBy?: string;
  requestedById?: string;
  requestedByEmail?: string;
}

export type ClientActivityType = "Note" | "Comment" | "Update" | "Task" | "Mention";

export interface ClientActivityRecord {
  id: number;
  clientId: string;
  avatar: string;
  name: string;
  action: string;
  boldPart: string;
  type: ClientActivityType;
  completedBadge?: string;
  time: string;
  description: string;
  visibility: string;
  replies?: number;
  group: string;
  createdAt: string;
  actorId?: string;
  actorEmail?: string;
}

export interface ClientDocumentRecord {
  id: string;
  clientId: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadedOn: string;
  archived?: boolean;
  /** Persisted data URL for browser-only document uploads. */
  fileData?: string;
}

export interface ClientContractRecord {
  clientId: string;
  contractId: string;
  contractTitle: string;
  startDate?: string;
  endDate?: string;
  archivedAt?: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("nidoClientDataUpdated"));
}

function matchesClient(value: { clientId: string }, clientId: string): boolean {
  return value.clientId === clientId;
}

export function getClientOrders(clientId: string, clientName?: string): ClientOrderRecord[] {
  const saved = read<ClientOrderRecord[]>(ORDERS_KEY, []).filter((item) => matchesClient(item, clientId));
  try {
    const shared = JSON.parse(localStorage.getItem("nido_my_orders") || "[]") as SharedOrderRecord[];
    const sharedOrders = shared
      .filter((order) =>
        order.cartItems?.some((item) => item.clientId === clientId) ||
        order.client === clientId ||
        (clientName && order.client === clientName)
      )
      .map((order) => ({
        ...(order as unknown as Partial<ClientOrderRecord>),
        id: order.id,
        clientId,
        date: order.orderDate || "",
        items: order.cartItems?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || order.cartItems?.length || 0,
        amount: Number.isFinite(Number(order.totalAmountNum))
          ? formatCurrency(Number(order.totalAmountNum))
          : order.totalAmount || "",
        amountNum: Number(order.totalAmountNum || 0),
        client: order.client || clientName || clientId,
        status: order.status || "Processing",
        requestedBy: order.requester || order.requestedBy || "",
        requestedById: order.requesterId || order.requestedById || "",
        requestedByEmail: order.requesterEmail || order.requestedByEmail || "",
        poNumber: order.poNumber || "",
        productDetails: Array.isArray(order.cartItems)
          ? order.cartItems.map((item) => ({
              id: item.id === undefined ? undefined : String(item.id),
              productCode: item.productCode ? String(item.productCode) : undefined,
              name: String(item.name || ""),
              category: item.category ? String(item.category) : undefined,
              priceNum: Number(item.priceNum || 0),
              quantity: Number(item.quantity || 0),
              subOrderId: item.subOrderId ? String(item.subOrderId) : undefined,
            }))
          : [],
      }));
    const byId = new Map([...saved, ...sharedOrders].map((item) => [item.id, item]));
    return Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return saved;
  }
}

export function saveClientOrder(order: ClientOrderRecord): void {
  const all = read<ClientOrderRecord[]>(ORDERS_KEY, []);
  write(ORDERS_KEY, [order, ...all.filter((item) => item.id !== order.id)]);
}

export function getClientServices(clientId: string): ClientServiceRecord[] {
  return read<ClientServiceRecord[]>(SERVICES_KEY, []).filter((item) => matchesClient(item, clientId));
}

export function saveClientService(service: ClientServiceRecord): void {
  const all = read<ClientServiceRecord[]>(SERVICES_KEY, []);
  write(SERVICES_KEY, [service, ...all.filter((item) => item.id !== service.id)]);
}

export function getClientActivities(clientId: string): ClientActivityRecord[] {
  return read<ClientActivityRecord[]>(ACTIVITIES_KEY, [])
    .filter((item) => matchesClient(item, clientId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveClientActivity(activity: ClientActivityRecord): void {
  const all = read<ClientActivityRecord[]>(ACTIVITIES_KEY, []);
  write(ACTIVITIES_KEY, [activity, ...all.filter((item) => item.id !== activity.id)]);
}

export function getClientDocuments(clientId: string): ClientDocumentRecord[] {
  return read<ClientDocumentRecord[]>(DOCUMENTS_KEY, []).filter((item) => matchesClient(item, clientId));
}

export function saveClientDocument(document: ClientDocumentRecord): void {
  const all = read<ClientDocumentRecord[]>(DOCUMENTS_KEY, []);
  write(DOCUMENTS_KEY, [document, ...all.filter((item) => item.id !== document.id)]);
}

export function getClientContracts(clientId: string): ClientContractRecord[] {
  return read<ClientContractRecord[]>(CONTRACTS_KEY, [])
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function getClientContract(clientId: string, contractId?: string): ClientContractRecord | null {
  const contracts = read<ClientContractRecord[]>(CONTRACTS_KEY, []).filter((item) => item.clientId === clientId);
  return contractId
    ? contracts.find((item) => item.contractId === contractId) || null
    : contracts[0] || null;
}

export function saveClientContract(contract: ClientContractRecord): void {
  const all = read<ClientContractRecord[]>(CONTRACTS_KEY, []);
  const existingIndex = all.findIndex((item) =>
    item.clientId === contract.clientId && item.contractId === contract.contractId
  );
  if (existingIndex >= 0) {
    const existing = all[existingIndex];
    all[existingIndex] = existing.archivedAt && !contract.archivedAt
      ? { ...contract, archivedAt: existing.archivedAt }
      : contract;
  } else {
    all.push(contract);
  }
  write(CONTRACTS_KEY, all);
}

export function archiveClientContract(clientId: string, contractId: string): boolean {
  const all = read<ClientContractRecord[]>(CONTRACTS_KEY, []);
  const existingIndex = all.findIndex((item) =>
    item.clientId === clientId && item.contractId === contractId
  );
  if (existingIndex < 0) return false;

  const now = new Date().toISOString();
  const contract = all[existingIndex];
  all[existingIndex] = {
    ...contract,
    archivedAt: contract.archivedAt || now,
    updatedAt: now,
  };
  write(CONTRACTS_KEY, all);
  return true;
}