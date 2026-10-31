import { useEffect, useState } from "react";

export type StatusCategory = string;

export interface OrderStatusParticular {
  value: StatusCategory;
  description: string;
  iconKey: "orders" | "purchase-orders" | "transactions" | "support" | "other";
}

export interface ConfiguredOrderStatus {
  id: number;
  category: StatusCategory;
  color: string;
  name: string;
  description: string;
  sortOrder: number;
  visible: boolean;
  default: boolean;
}

export interface OrderStatusConfig {
  particulars: OrderStatusParticular[];
  statuses: ConfiguredOrderStatus[];
}

export const ORDER_STATUS_CONFIG_KEY = "nido_order_status_config";
export const ORDER_STATUS_CONFIG_EVENT = "nidoOrderStatusConfigUpdated";

export const DEFAULT_PARTICULARS: OrderStatusParticular[] = [
  { value: "Orders", description: "Customer order lifecycle", iconKey: "orders" },
  { value: "Purchase Orders", description: "Vendor purchase order lifecycle", iconKey: "purchase-orders" },
  { value: "Transactions", description: "Payment and reconciliation lifecycle", iconKey: "transactions" },
  { value: "Support Services", description: "Service request lifecycle", iconKey: "support" },
  { value: "Other", description: "Additional workflow statuses", iconKey: "other" },
];

export const DEFAULT_STATUSES: ConfiguredOrderStatus[] = [
  { id: 1, category: "Orders", color: "#f59e0b", name: "Pending", description: "Order awaiting review", sortOrder: 1, visible: true, default: true },
  { id: 2, category: "Orders", color: "#f97316", name: "Processing", description: "Order being processed", sortOrder: 2, visible: true, default: false },
  { id: 3, category: "Orders", color: "#10b981", name: "Approved", description: "Order approved", sortOrder: 3, visible: true, default: false },
  { id: 4, category: "Purchase Orders", color: "#6366f1", name: "Draft", description: "Purchase order being prepared", sortOrder: 1, visible: true, default: true },
  { id: 5, category: "Purchase Orders", color: "#8b5cf6", name: "Sent to Vendor", description: "Purchase order sent for vendor confirmation", sortOrder: 2, visible: true, default: false },
  { id: 6, category: "Transactions", color: "#0ea5e9", name: "Pending Payment", description: "Transaction awaiting payment", sortOrder: 1, visible: true, default: true },
  { id: 7, category: "Transactions", color: "#10b981", name: "Completed", description: "Transaction successfully completed", sortOrder: 2, visible: true, default: false },
  { id: 8, category: "Support Services", color: "#f59e0b", name: "Open", description: "Support request received and awaiting action", sortOrder: 1, visible: true, default: true },
  { id: 9, category: "Support Services", color: "#14b8a6", name: "Resolved", description: "Support request resolved", sortOrder: 2, visible: true, default: false },
];

const cloneDefaults = (): OrderStatusConfig => ({
  particulars: DEFAULT_PARTICULARS.map((particular) => ({ ...particular })),
  statuses: DEFAULT_STATUSES.map((status) => ({ ...status })),
});

function normalizeConfig(raw: Partial<OrderStatusConfig>): OrderStatusConfig {
  const fallback = cloneDefaults();
  const particulars = Array.isArray(raw.particulars) && raw.particulars.length
    ? raw.particulars
        .filter((particular): particular is OrderStatusParticular => Boolean(particular?.value))
        .map((particular) => ({
          value: String(particular.value),
          description: String(particular.description || "Custom workflow particular"),
          iconKey: particular.iconKey || "other",
        }))
    : fallback.particulars;
  const categoryNames = new Set(particulars.map((particular) => particular.value));
  const statuses = Array.isArray(raw.statuses)
    ? raw.statuses
        .filter((status): status is ConfiguredOrderStatus => Boolean(status?.name && status?.category))
        .map((status) => ({
          id: Number(status.id) || Date.now(),
          category: String(status.category),
          color: String(status.color || "#3B82F6"),
          name: String(status.name),
          description: String(status.description || ""),
          sortOrder: Number(status.sortOrder) || 0,
          visible: status.visible !== false,
          default: Boolean(status.default),
        }))
        .filter((status) => categoryNames.has(status.category))
    : fallback.statuses;

  return { particulars, statuses };
}

export function getOrderStatusConfig(): OrderStatusConfig {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const saved = localStorage.getItem(ORDER_STATUS_CONFIG_KEY);
    if (!saved) {
      const initial = cloneDefaults();
      localStorage.setItem(ORDER_STATUS_CONFIG_KEY, JSON.stringify(initial));
      return initial;
    }
    return normalizeConfig(JSON.parse(saved));
  } catch {
    return cloneDefaults();
  }
}

export function saveOrderStatusConfig(config: OrderStatusConfig): void {
  localStorage.setItem(ORDER_STATUS_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(ORDER_STATUS_CONFIG_EVENT));
}

export function addOrderStatusParticular(
  particular: Omit<OrderStatusParticular, "iconKey"> & { iconKey?: OrderStatusParticular["iconKey"] },
): OrderStatusParticular {
  const config = getOrderStatusConfig();
  const existing = config.particulars.find(
    (item) => item.value.toLowerCase() === particular.value.trim().toLowerCase(),
  );
  if (existing) return existing;

  const created = {
    value: particular.value.trim(),
    description: particular.description?.trim() || "Custom workflow particular",
    iconKey: particular.iconKey || "other",
  };
  saveOrderStatusConfig({ ...config, particulars: [...config.particulars, created] });
  return created;
}

export function addConfiguredOrderStatus(status: Omit<ConfiguredOrderStatus, "id">): ConfiguredOrderStatus {
  const config = getOrderStatusConfig();
  const created = { ...status, id: Date.now() };
  saveOrderStatusConfig({ ...config, statuses: [...config.statuses, created] });
  return created;
}

export function updateConfiguredOrderStatus(id: number, changes: Partial<ConfiguredOrderStatus>): void {
  const config = getOrderStatusConfig();
  saveOrderStatusConfig({
    ...config,
    statuses: config.statuses.map((status) => status.id === id ? { ...status, ...changes } : status),
  });
}

export function deleteConfiguredOrderStatus(id: number): void {
  const config = getOrderStatusConfig();
  saveOrderStatusConfig({ ...config, statuses: config.statuses.filter((status) => status.id !== id) });
}

export function getConfiguredStatusNames(
  category: StatusCategory,
  fallback: string[] = [],
  includeHidden = false,
): string[] {
  const configured = getOrderStatusConfig().statuses
    .filter((status) => status.category === category && (includeHidden || status.visible))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((status) => status.name);
  return Array.from(new Set([...configured, ...fallback]));
}

export function useOrderStatusConfig(): OrderStatusConfig {
  const [config, setConfig] = useState<OrderStatusConfig>(() => getOrderStatusConfig());

  useEffect(() => {
    const refresh = () => setConfig(getOrderStatusConfig());
    window.addEventListener(ORDER_STATUS_CONFIG_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ORDER_STATUS_CONFIG_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return config;
}