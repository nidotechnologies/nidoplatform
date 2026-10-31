// Stock Engine — computes vendor allocation records for cart items.
//
// Enterprise Stock Flow:
//   • reserveStock / releaseStock / releasePartial / reserveExtra all operate on
//     reservedStock only — the physical currentStock (stock field) is NOT touched.
//   • currentStock is only reduced when a Purchase Order is raised, via consumeStockForPO().
//   • Available stock = currentStock − reservedStock — this is what the shop shows clients.
//   • Cancellations before a PO automatically restore available stock (reservedStock drops).
//
// Strategy: cheapest vendor fills first (same order as the price engine's vendor ranking).
// When releasing a partial reduction, we give stock back to the most-expensive vendor
// first (reverse order) so the cheap vendor's stock is consumed last and released last.
//
// reserveStock / releaseStock / releasePartial are kept for API compatibility
// (they still compute allocation records the order-details flow depends on)
// but they no longer mutate the vendorStore stock field.

import { getAllVendorProducts, updateVendorProduct, getAvailableStock } from './vendorStore';
import { computeVendorComparisons } from './priceEngineStore';

export interface StockAllocation {
  vendorId: string;
  /** VendorProduct.id — the row-level key needed by updateVendorProduct */
  vendorProductId: string;
  vendorName: string;
  allocated: number;
}

// ─── Reserve ─────────────────────────────────────────────────────────────────

/**
 * Reserve `qty` units for `masterProductCode` by incrementing reservedStock on
 * vendors cheapest-first. Does NOT reduce currentStock (stock field) — that only
 * happens when a PO is raised via consumeStockForPO().
 *
 * Returns the allocation list to store on the CartItem so the exact same units
 * can be released later.
 *
 * If total available stock < qty (partial fill), reserves only what's available
 * and returns the partial allocation.
 */
export function reserveStock(
  masterProductCode: string,
  qty: number,
  productCategory?: string,
): StockAllocation[] {
  if (qty <= 0) return [];

  // Read live vendor products to compute which vendors cover this qty.
  // NOTE: we intentionally do NOT deduct from vendor stock here.
  // Stock is only deducted when a PO is raised (see OrderDetailsPage handleRaisePOs).
  const storeMap = getAllVendorProducts();

  // Vendor comparisons sorted cheapest-first — defines fill order.
  const comparisons = computeVendorComparisons(masterProductCode, productCategory);

  const allocations: StockAllocation[] = [];
  let remaining = qty;

  for (const comp of comparisons) {
    if (remaining <= 0) break;

    const vendorProducts = storeMap[comp.vendorId] || [];
    const match = vendorProducts.find(
      p => p.masterProductCode === masterProductCode && p.status === 'Active',
    );
    if (!match) continue;

    // Use availableStock (current − reserved) to determine how much can be reserved.
    const available = getAvailableStock(match);
    if (available <= 0) continue;

    const take = Math.min(remaining, available);
    const newReserved = (parseInt(match.reservedStock || '0') || 0) + take;
    updateVendorProduct(comp.vendorId, match.id, {
      reservedStock: String(newReserved),
      lastStockUpdate: new Date().toISOString(),
    });

    allocations.push({
      vendorId: comp.vendorId,
      vendorProductId: match.id,
      vendorName: comp.vendorName,
      allocated: take,
    });
    remaining -= take;
  }

  return allocations;
}

// ─── Release (full) ──────────────────────────────────────────────────────────

/**
 * Return all units in `allocations` back to their vendors by decrementing
 * reservedStock. Call this when an item is removed from the cart, the cart is
 * cleared, or an order is cancelled before a PO has been raised.
 */
export function releaseStock(allocations: StockAllocation[]): void {
  if (!allocations?.length) return;

  const storeMap = getAllVendorProducts();

  for (const alloc of allocations) {
    const vendorProducts = storeMap[alloc.vendorId] || [];
    const match = vendorProducts.find(p => p.id === alloc.vendorProductId);
    if (!match) continue;

    const reserved = parseInt(match.reservedStock || '0') || 0;
    updateVendorProduct(alloc.vendorId, alloc.vendorProductId, {
      reservedStock: String(Math.max(0, reserved - alloc.allocated)),
      lastStockUpdate: new Date().toISOString(),
    });
  }
}

// ─── Release (partial) ───────────────────────────────────────────────────────

/**
 * Release `qtyToRelease` units back to vendors from an existing allocation,
 * starting from the most-expensive vendor (end of the list), by decrementing
 * reservedStock.
 *
 * Returns the updated allocation (with reduced allocated values).
 */
export function releasePartial(
  allocations: StockAllocation[],
  qtyToRelease: number,
): StockAllocation[] {
  if (qtyToRelease <= 0 || !allocations?.length) return allocations;

  // Work on a copy; adjust allocated counts from most-expensive (last) vendor first.
  // NOTE: vendor stock field is NOT modified — only the allocation records are updated.
  const updated = allocations.map(a => ({ ...a }));
  const storeMap = getAllVendorProducts();
  let remaining = qtyToRelease;

  for (let i = updated.length - 1; i >= 0 && remaining > 0; i--) {
    const alloc = updated[i];
    const toReturn = Math.min(remaining, alloc.allocated);
    if (toReturn <= 0) continue;
    const vendorProducts = storeMap[alloc.vendorId] || [];
    const match = vendorProducts.find(p => p.id === alloc.vendorProductId);
    if (match) {
      const reserved = parseInt(match.reservedStock || '0') || 0;
      updateVendorProduct(alloc.vendorId, alloc.vendorProductId, {
        reservedStock: String(Math.max(0, reserved - toReturn)),
        lastStockUpdate: new Date().toISOString(),
      });
    }

    alloc.allocated -= toReturn;
    remaining -= toReturn;
  }

  return updated.filter(a => a.allocated > 0);
}

// ─── Reserve extra (qty increase) ────────────────────────────────────────────

/**
 * Add `extraQty` more units to an existing allocation.
 * Returns the merged allocation (existing + new units).
 */
export function reserveExtra(
  masterProductCode: string,
  extraQty: number,
  existingAllocations: StockAllocation[],
  productCategory?: string,
): StockAllocation[] {
  if (extraQty <= 0) return existingAllocations;

  const newAllocs = reserveStock(masterProductCode, extraQty, productCategory);

  // Merge: if the same vendorProductId appears in both, sum the allocated counts.
  const merged = [...existingAllocations.map(a => ({ ...a }))];
  for (const na of newAllocs) {
    const existing = merged.find(a => a.vendorProductId === na.vendorProductId);
    if (existing) {
      existing.allocated += na.allocated;
    } else {
      merged.push(na);
    }
  }
  return merged;
}

// ─── Consume for PO ──────────────────────────────────────────────────────────

/**
 * Called when a Purchase Order is raised. Reduces the vendor's physical
 * currentStock (stock) AND releases the corresponding reservedStock, so the
 * net effect on availableStock is zero — the product simply moves from
 * "reserved" to "physically consumed by PO".
 *
 * allocations: array of { vendorId, masterProductCode, qty } for each PO line.
 */
export function consumeStockForPO(
  allocations: Array<{ vendorId: string; masterProductCode: string; qty: number }>,
): void {
  const storeMap = getAllVendorProducts();

  for (const { vendorId, masterProductCode, qty } of allocations) {
    if (qty <= 0) continue;
    const vendorProducts = storeMap[vendorId] || [];
    const match = vendorProducts.find(
      p => p.masterProductCode === masterProductCode && p.status === 'Active',
    );
    if (!match) continue;

    const currentStock = parseInt(match.stock || '0') || 0;
    const reservedStock = parseInt(match.reservedStock || '0') || 0;

    updateVendorProduct(vendorId, match.id, {
      stock: String(Math.max(0, currentStock - qty)),
      reservedStock: String(Math.max(0, reservedStock - qty)),
      lastStockUpdate: new Date().toISOString(),
    });
  }
}
