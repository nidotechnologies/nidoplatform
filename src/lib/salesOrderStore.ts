// ── Sales Order Store ─────────────────────────────────────────────────────────
// Persists sales orders to localStorage. Fires a DOM event on every change.

const STORE_KEY = 'nido_sales_orders';
const COUNTER_KEY = 'nido_sales_order_counter';
import { getPrefix } from './configService';
import type { ProductCommercialTerms } from './productCommercialTerms';

export interface OrderLineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  hsnSac: string;
  qty: number;
  rate: number;
  discount: number;
  taxPercent: number;
  productType?: string;
  commercialTerms?: ProductCommercialTerms;
}

export interface OrderGstSlab {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
}

export type OrderStatus = 'Draft' | 'Confirmed' | 'Processing' | 'Completed' | 'Cancelled';

export interface StoredSalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate: string;
  clientName: string;
  contactPerson: string;
  billingAddress: string;
  shippingAddress: string;
  emails: string[];
  lineItems: OrderLineItem[];
  subtotal: number;
  gstSlabs: OrderGstSlab[];
  totalTax: number;
  adjustment: number;
  shippingCharges: number;
  grandTotal: number;
  termsConditions: string;
  customerNotes: string;
  status: OrderStatus;
  clientGstin?: string;
  placeOfSupply?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedAt?: string;
  assignedTo?: string;
  assignedRole?: string;
  assignedDepartment?: string;
}

export function getOrders(): StoredSalesOrder[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getActiveOrders(): StoredSalesOrder[] {
  return getOrders().filter(o => !o.archived);
}

export function getArchivedOrders(): StoredSalesOrder[] {
  return getOrders().filter(o => o.archived === true);
}

export function getOrderById(id: string): StoredSalesOrder | undefined {
  return getOrders().find(o => o.id === id);
}

export function saveOrder(order: StoredSalesOrder): void {
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event('nidoSalesOrdersUpdated'));
}

export function archiveOrder(id: string): void {
  const orders = getOrders().map(o =>
    o.id === id
      ? { ...o, archived: true, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : o,
  );
  localStorage.setItem(STORE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event('nidoSalesOrdersUpdated'));
}

export function restoreOrder(id: string): void {
  const orders = getOrders().map(o =>
    o.id === id
      ? { ...o, archived: false, archivedAt: undefined, updatedAt: new Date().toISOString() }
      : o,
  );
  localStorage.setItem(STORE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event('nidoSalesOrdersUpdated'));
}

export function generateOrderNumber(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `${getPrefix('salesOrder') || 'SO-'}${String(counter).padStart(6, '0')}`;
}
