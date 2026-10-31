/**
 * Pricing helpers for cart/order lines.
 *
 * A Shop selection stores the vendor's raw unit price separately from the
 * catalog selling price. Once a vendor is selected, that snapshot is the
 * source of truth for the customer-facing line price and GST rate. The
 * landed cost remains available for the supplier PO.
 */

export type VendorCartLine = {
  priceNum: number;
  selectedVendorId?: string;
  vendorPrice?: number;
  /** Client selling price before GST, snapshotted when the item is added. */
  clientSellingPriceExclGst?: number;
  gstSnapshot?: number;
  category?: string;
};

function hasVendorPrice(item: VendorCartLine): boolean {
  return Boolean(
    item.selectedVendorId &&
    typeof item.vendorPrice === "number" &&
    Number.isFinite(item.vendorPrice),
  );
}

/** Customer-facing unit price before GST. Legacy lines use their stored price. */
export function getCartUnitPriceExclGst(item: VendorCartLine, fallbackTaxRate = 0): number {
  if (
    typeof item.clientSellingPriceExclGst === "number" &&
    Number.isFinite(item.clientSellingPriceExclGst)
  ) {
    return Math.max(0, item.clientSellingPriceExclGst);
  }
  return hasVendorPrice(item)
    ? Math.max(0, item.vendorPrice ?? 0)
    : Math.max(0, (item.priceNum || 0) * 100 / (100 + fallbackTaxRate));
}

/** Tax rate captured with the vendor selection, with a legacy fallback. */
export function getCartTaxRate(item: VendorCartLine): number | undefined {
  if (
    item.selectedVendorId &&
    typeof item.gstSnapshot === "number" &&
    Number.isFinite(item.gstSnapshot)
  ) {
    return item.gstSnapshot;
  }
  return undefined;
}

/** Customer-facing unit price including the selected vendor's GST. */
export function getCartUnitPriceInclusive(
  item: VendorCartLine,
  fallbackTaxRate: number,
): number {
  if (!hasVendorPrice(item)) return Math.max(0, item.priceNum || 0);
  const taxRate = getCartTaxRate(item);
  const rate = typeof taxRate === "number" && Number.isFinite(taxRate)
    ? taxRate
    : fallbackTaxRate;
  return getCartUnitPriceExclGst(item) * (1 + rate / 100);
}