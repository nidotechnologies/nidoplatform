import { recordStockEvent } from './stockHistoryStore';
import { getVendorById } from './vendorDataStore';
import type { CatalogProduct, CatalogVariation } from './catalogStore';

const STORE_KEY = 'nido_vendor_products';

export interface VendorProduct {
  id: string;                // catalog product id
  vendorId: string;
  masterProductCode: string;
  skuCode: string;
  productName: string;
  category: string;
  brand: string;
  /** Snapshot of the master catalog fulfillment type at assignment time. */
  physicalType?: string;
  images: string[];
  /** Vendor-specific digital product variations and option price adjustments. */
  variations?: CatalogVariation[];
  price: string;
  moq: string;
  leadTime: string;
  /** Physical inventory with vendor. Keep in sync with physicalStock. */
  stock: string;
  /** Actual physical inventory with vendor (source of truth). */
  physicalStock?: string;
  /** Qty reserved by pending client orders (never manually edited). */
  reservedStock: string;
  /** Incoming / on-order stock (informational). */
  incomingStock?: string;
  /** ISO timestamp of the last stock update. */
  lastStockUpdate?: string;
  vendorProductCode: string;
  addedAt: string;
  status: 'Active' | 'Inactive';
}

type Store = Record<string, VendorProduct[]>;

// ─── Current-user helper (for history) ───────────────────────────────────────
function getCurrentUser(): string {
  try {
    const u = JSON.parse(localStorage.getItem('nido_user') || '{}');
    return u.email || u.name || 'System';
  } catch { return 'System'; }
}

/** Ensure every product has physicalStock / reservedStock populated. */
function migrateProduct(p: VendorProduct): VendorProduct {
  if (p.physicalStock !== undefined && p.reservedStock !== undefined) return p;
  return {
    ...p,
    physicalStock: p.physicalStock ?? p.stock ?? '0',
    reservedStock: p.reservedStock ?? '0',
  };
}

function readStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const migrated: Store = {};
    for (const [vendorId, products] of Object.entries(raw)) {
      migrated[vendorId] = (products as VendorProduct[]).map(migrateProduct);
    }
    return migrated;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event('vendorProductsUpdated'));
}

export function getVendorProducts(vendorId: string): VendorProduct[] {
  return readStore()[vendorId] || [];
}

export function isCatalogProductAlreadyAssigned(
  catalogProduct: Pick<CatalogProduct, 'id' | 'masterProductCode'>,
  vendorProducts: readonly Pick<VendorProduct, 'id' | 'masterProductCode'>[],
): boolean {
  const catalogId = String(catalogProduct.id ?? '').trim().toLocaleLowerCase();
  const masterProductCode = String(catalogProduct.masterProductCode ?? '').trim().toLocaleLowerCase();
  return vendorProducts.some((product) =>
    (catalogId && String(product.id ?? '').trim().toLocaleLowerCase() === catalogId)
    || (masterProductCode && String(product.masterProductCode ?? '').trim().toLocaleLowerCase() === masterProductCode),
  );
}

export function saveVendorProducts(vendorId: string, products: VendorProduct[]): void {
  const store = readStore();
  store[vendorId] = products;
  writeStore(store);
}

export function addVendorProducts(vendorId: string, newProducts: VendorProduct[]): void {
  const existing = getVendorProducts(vendorId);
  const existingIds = new Set(existing.map(p => p.id));
  const toAdd = newProducts.filter(p => !existingIds.has(p.id));
  saveVendorProducts(vendorId, [...existing, ...toAdd]);
}

/**
 * Update one or more fields on a vendor product.
 * @param _skipHistory  Pass true from named stock-mutation functions so they
 *                      can record a richer history entry themselves without
 *                      triggering a duplicate 'Vendor Stock Updated' entry.
 */
export function updateVendorProduct(
  vendorId: string,
  productId: string,
  updates: Partial<VendorProduct>,
  _skipHistory = false,
): void {
  const products = getVendorProducts(vendorId);
  const oldProduct = products.find(p => p.id === productId);

  const newProducts = products.map(p => {
    if (p.id !== productId) return p;
    const merged = { ...p, ...updates };
    // Admin manually edited stock only → sync to physicalStock so both stay in step.
    if (updates.stock !== undefined && updates.physicalStock === undefined) {
      merged.physicalStock = updates.stock;
    }
    // physicalStock explicitly provided → keep legacy stock field in sync.
    if (updates.physicalStock !== undefined) {
      merged.stock = updates.physicalStock;
    }
    return merged;
  });

  saveVendorProducts(vendorId, newProducts);

  // Record history for admin manual stock edits coming from Vendor Products page
  if (!_skipHistory && oldProduct && (updates.stock !== undefined || updates.physicalStock !== undefined)) {
    const newPhysical = parseInt(updates.physicalStock ?? updates.stock ?? oldProduct.physicalStock ?? '0') || 0;
    const oldPhysical = parseInt(oldProduct.physicalStock ?? oldProduct.stock ?? '0') || 0;
    if (newPhysical !== oldPhysical) {
      recordStockEvent({
        masterProductCode: oldProduct.masterProductCode,
        productName: oldProduct.productName,
        vendorId,
        vendorName: getVendorById(vendorId)?.name || vendorId,
        action: 'Vendor Stock Updated',
        field: 'physicalStock',
        qtyBefore: oldPhysical,
        qtyChanged: newPhysical - oldPhysical,
        qtyAfter: newPhysical,
        reference: 'Admin Edit',
        user: getCurrentUser(),
      });
    }
  }
}

// ─── Available stock helpers ──────────────────────────────────────────────────

/** Available stock = physicalStock − reservedStock (never negative). */
export function getAvailableStock(product: VendorProduct): number {
  const physical = parseInt(product.physicalStock ?? product.stock ?? '0') || 0;
  const reserved = parseInt(product.reservedStock ?? '0') || 0;
  return Math.max(0, physical - reserved);
}

/**
 * Total available stock for a product across ALL vendors.
 *
 * Computed as  sum(physicalStock) − sum(reservedStock)  — the same formula
 * that Stock Management uses for its summary row.  This is intentionally
 * different from summing per-vendor getAvailableStock(), which clamps each
 * vendor's value to 0 before adding.  When one vendor has
 * reservedStock > physicalStock (e.g. reservation placed before a manual
 * stock-out), the per-vendor sum over-reports available capacity.
 * Subtracting the totals once gives the correct platform-wide figure.
 */
export function getProductTotalAvailableStock(masterProductCode: string): number {
  const store = getAllVendorProducts();
  let totalPhysical = 0;
  let totalReserved = 0;
  for (const products of Object.values(store)) {
    for (const p of products) {
      if (p.masterProductCode === masterProductCode && p.status === 'Active') {
        totalPhysical += parseInt(p.physicalStock ?? p.stock ?? '0') || 0;
        totalReserved += parseInt(p.reservedStock ?? '0') || 0;
      }
    }
  }
  return Math.max(0, totalPhysical - totalReserved);
}

// ─── Enterprise stock reservation functions ──────────────────────────────────

/**
 * Reserve `qty` units for `masterProductCode` from `vendorId`.
 * Called when a client places an order (checkout).
 * Only increases reservedStock — physicalStock is unchanged.
 */
export function reserveVendorStock(
  vendorId: string,
  masterProductCode: string,
  qty: number,
  reference = 'Order',
): void {
  if (qty <= 0) return;
  const products = getVendorProducts(vendorId);
  const product = products.find(
    p => p.masterProductCode === masterProductCode && p.status === 'Active',
  );
  if (!product) return;
  const current = parseInt(product.reservedStock ?? '0') || 0;
  updateVendorProduct(vendorId, product.id, { reservedStock: String(current + qty) }, true);
  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: 'Order Reserved',
    field: 'reservedStock',
    qtyBefore: current,
    qtyChanged: qty,
    qtyAfter: current + qty,
    reference,
    user: getCurrentUser(),
  });
}

/**
 * Release `qty` units of reserved stock for `masterProductCode` from `vendorId`.
 * Called when an order is cancelled before a PO is raised.
 * Only decreases reservedStock — physicalStock is unchanged.
 */
export function releaseVendorReservation(
  vendorId: string,
  masterProductCode: string,
  qty: number,
  reference = 'Order Cancelled',
): void {
  if (qty <= 0) return;
  const products = getVendorProducts(vendorId);
  const product = products.find(p => p.masterProductCode === masterProductCode);
  if (!product) return;
  const current = parseInt(product.reservedStock ?? '0') || 0;
  const newReserved = Math.max(0, current - qty);
  updateVendorProduct(vendorId, product.id, { reservedStock: String(newReserved) }, true);
  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: 'Reservation Released',
    field: 'reservedStock',
    qtyBefore: current,
    qtyChanged: -(current - newReserved),
    qtyAfter: newReserved,
    reference,
    user: getCurrentUser(),
  });
}

/**
 * Convert `qty` units from Reserved → Allocated when a Draft PO is confirmed.
 * Decrements both reservedStock and physicalStock so the items are committed
 * to the order (no longer just tentatively held). Available stock stays the
 * same (physicalStock − reservedStock unchanged), but physicalStock correctly
 * reflects the items are now allocated and will leave the warehouse.
 */
export function convertReservedToAllocated(
  vendorId: string,
  masterProductCode: string,
  qty: number,
  reference = 'PO Confirmed',
): void {
  if (qty <= 0) return;
  const products = getVendorProducts(vendorId);
  const product = products.find(p => p.masterProductCode === masterProductCode);
  if (!product) return;
  const currentReserved = parseInt(product.reservedStock ?? '0') || 0;
  const currentPhysical = parseInt(product.physicalStock ?? product.stock ?? '0') || 0;
  const convertQty = Math.min(qty, currentReserved);
  if (convertQty <= 0) return;
  const newReserved = currentReserved - convertQty;
  const newPhysical = Math.max(0, currentPhysical - convertQty);
  updateVendorProduct(vendorId, product.id, {
    reservedStock: String(newReserved),
    physicalStock: String(newPhysical),
    stock: String(newPhysical),
  }, true);
  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: 'PO Confirmed – Reserved→Allocated',
    field: 'physicalStock',
    qtyBefore: currentPhysical,
    qtyChanged: -convertQty,
    qtyAfter: newPhysical,
    reference,
    user: getCurrentUser(),
  });
}

/**
 * Deduct `qty` units of physicalStock from the PO vendor, and release `qty`
 * units of reservedStock from whichever vendor(s) actually hold the reservation.
 *
 * Why cross-vendor release?  The checkout reservation is placed on the cheapest
 * vendor at cart time.  The admin may later select a *different* vendor when
 * raising the PO.  If we only released the reservation on the PO vendor, and
 * that vendor held 0 reserved, the total reserved would stay unchanged while
 * total physical dropped — so available would fall incorrectly.
 *
 * By scanning all vendors and releasing exactly `qty` of reserved (greedily,
 * largest reservation first), totalPhysical − totalReserved stays the same
 * before and after the PO, keeping the shop display unchanged.
 */
export function deductPhysicalStock(
  vendorId: string,
  masterProductCode: string,
  qty: number,
  reference = 'PO Raised',
): void {
  if (qty <= 0) return;

  // ── 1. Deduct physicalStock from the PO vendor ────────────────────────────
  const products = getVendorProducts(vendorId);
  const product = products.find(
    p => p.masterProductCode === masterProductCode && p.status === 'Active',
  );
  if (!product) return;
  const physical = parseInt(product.physicalStock ?? product.stock ?? '0') || 0;
  const newPhysical = Math.max(0, physical - qty);
  // Only update physicalStock here; reservedStock is released cross-vendor below.
  updateVendorProduct(vendorId, product.id, {
    physicalStock: String(newPhysical),
    stock: String(newPhysical),
  }, true);

  // ── 2. Release `qty` of reservedStock across all vendors ──────────────────
  // Scan all vendors that hold reserved stock for this product and release
  // up to `qty` total, greedy (most-reserved vendor first), so the total
  // reserved drops by exactly qty regardless of which vendor supplied the PO.
  let toRelease = qty;
  const store = getAllVendorProducts();
  // Sort vendors: most reserved first so we drain large reservations first.
  const vendorEntries = Object.entries(store)
    .map(([vId, vProducts]) => ({
      vId,
      vp: vProducts.find(
        p => p.masterProductCode === masterProductCode && p.status === 'Active',
      ),
    }))
    .filter((e): e is { vId: string; vp: VendorProduct } => !!e.vp)
    .sort((a, b) => {
      const ra = parseInt(a.vp.reservedStock ?? '0') || 0;
      const rb = parseInt(b.vp.reservedStock ?? '0') || 0;
      return rb - ra; // descending
    });

  for (const { vId, vp } of vendorEntries) {
    if (toRelease <= 0) break;
    const reserved = parseInt(vp.reservedStock ?? '0') || 0;
    if (reserved <= 0) continue;
    const release = Math.min(reserved, toRelease);
    updateVendorProduct(vId, vp.id, { reservedStock: String(reserved - release) }, true);
    toRelease -= release;
  }

  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: 'PO Raised',
    field: 'both',
    qtyBefore: physical,
    qtyChanged: -(physical - newPhysical),
    qtyAfter: newPhysical,
    reference,
    user: getCurrentUser(),
  });
}

/**
 * Restore `qty` units to physicalStock AND reservedStock on the PO vendor
 * when a PO is cancelled.
 *
 * Both physical and reserved are restored to the PO vendor so that
 * totalPhysical − totalReserved (= available stock) stays the same before
 * and after the cancellation, matching the state just before the PO was raised.
 */
export function restorePhysicalStock(
  vendorId: string,
  masterProductCode: string,
  qty: number,
  reference = 'PO Cancelled',
): void {
  if (qty <= 0) return;
  const products = getVendorProducts(vendorId);
  const product = products.find(p => p.masterProductCode === masterProductCode);
  if (!product) return;
  const physical = parseInt(product.physicalStock ?? product.stock ?? '0') || 0;
  const reserved = parseInt(product.reservedStock ?? '0') || 0;
  const newPhysical = physical + qty;
  // Restore reserved on the PO vendor so available = totalPhysical − totalReserved
  // remains unchanged through the cancel (mirrors the cross-vendor release done at raise).
  const newReserved = reserved + qty;
  updateVendorProduct(vendorId, product.id, {
    physicalStock: String(newPhysical),
    stock: String(newPhysical),
    reservedStock: String(newReserved),
  }, true);
  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: 'PO Cancelled',
    field: 'both',
    qtyBefore: physical,
    qtyChanged: qty,
    qtyAfter: newPhysical,
    reference,
    user: getCurrentUser(),
  });
}

/**
 * Manual stock adjustment from the Stock Management module.
 * Stock In / Stock Out affect physicalStock only (reservedStock is untouched).
 * Stock Correction sets physicalStock to an exact value.
 */
export function manualStockAdjustment(
  vendorId: string,
  masterProductCode: string,
  adjustType: 'Stock In' | 'Stock Out' | 'Stock Correction',
  qty: number,
  reference: string,
): void {
  if (qty < 0) return;
  const products = getVendorProducts(vendorId);
  const product = products.find(p => p.masterProductCode === masterProductCode);
  if (!product) return;
  const physical = parseInt(product.physicalStock ?? product.stock ?? '0') || 0;

  let newPhysical: number;
  if (adjustType === 'Stock In') {
    newPhysical = physical + qty;
  } else if (adjustType === 'Stock Out') {
    newPhysical = Math.max(0, physical - qty);
  } else {
    // Stock Correction — set to exact value
    newPhysical = qty;
  }

  updateVendorProduct(vendorId, product.id, {
    physicalStock: String(newPhysical),
    stock: String(newPhysical),
  }, true);

  const changed = newPhysical - physical;
  recordStockEvent({
    masterProductCode,
    productName: product.productName,
    vendorId,
    vendorName: getVendorById(vendorId)?.name || vendorId,
    action: adjustType,
    field: 'physicalStock',
    qtyBefore: physical,
    qtyChanged: changed,
    qtyAfter: newPhysical,
    reference,
    user: getCurrentUser(),
  });
}

export function removeVendorProduct(vendorId: string, productId: string): void {
  const products = getVendorProducts(vendorId).filter(p => p.id !== productId);
  saveVendorProducts(vendorId, products);
}

export function getAllVendorProducts(): Record<string, VendorProduct[]> {
  return readStore();
}

// ─── Global VPC sequence counter ─────────────────────────────────────────────
// A dedicated localStorage key stores the highest VPC number ever issued.
// This is a monotonic counter: it only ever increases, even when products are
// deleted or VPC values are manually edited, so codes are never reused.
//
// On first use the counter is bootstrapped by scanning all existing products
// so that any products added before this code was deployed are accounted for.

import { getPrefix } from './configService';

const VPC_COUNTER_KEY = 'nido_vpc_counter';
// Historical bootstrap regex — always matches the original VPC- default so
// existing product codes are counted regardless of the current prefix setting.
const VPC_RE = /^VPC-(\d+)$/i;

function readVpcCounter(): number {
  try {
    const raw = localStorage.getItem(VPC_COUNTER_KEY);
    if (raw !== null) return Math.max(0, parseInt(raw, 10) || 0);
  } catch { /* ignore */ }
  // First run: bootstrap from existing products
  const store = readStore();
  let max = 0;
  for (const products of Object.values(store)) {
    for (const p of products) {
      const m = VPC_RE.exec(p.vendorProductCode?.trim() ?? '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return max;
}

function writeVpcCounter(value: number): void {
  try { localStorage.setItem(VPC_COUNTER_KEY, String(value)); } catch { /* ignore */ }
}

/**
 * Peek at the current counter value without incrementing it.
 * Use this to compute preview VPC codes for display only —
 * the counter is not advanced, so cancelling wastes nothing.
 */
export function peekVpcCounter(): number {
  return readVpcCounter();
}

/**
 * Reserve `count` sequential VPC codes atomically.
 * The counter is incremented before returning so the same codes
 * are never issued twice, even across separate sessions.
 *
 * Returns an array of strings: ['VPC-00001', 'VPC-00002', …]
 */
export function reserveVendorProductCodes(count: number): string[] {
  if (count <= 0) return [];
  const prefix = getPrefix('vendorProductCode') || 'VPC-';
  const current = readVpcCounter();
  const codes = Array.from({ length: count }, (_, i) =>
    `${prefix}${String(current + 1 + i).padStart(5, '0')}`
  );
  writeVpcCounter(current + count);
  return codes;
}

/** Convenience wrapper for a single VPC code. */
export function reserveVendorProductCode(): string {
  return reserveVendorProductCodes(1)[0];
}

/** VPC format regex — exported so the UI can validate user-edited codes. */
export const VPC_FORMAT_RE = VPC_RE;
