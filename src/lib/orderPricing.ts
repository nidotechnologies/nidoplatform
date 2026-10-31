import { computeCartGST } from "./cartGstHelper";
import { getEffectiveTaxPctForCategory } from "./taxEngine";
import { getCartTaxRate, getCartUnitPriceInclusive } from "./vendorCartPricing";

export interface OrderPricingItem {
  priceNum: number;
  quantity?: number;
  clientId?: string;
  category?: string;
  selectedVendorId?: string;
  vendorPrice?: number;
  clientSellingPriceExclGst?: number;
  gstSnapshot?: number;
  subOrderId?: string;
  checkoutUnitPriceInclusive?: number;
  checkoutGstRate?: number;
}

export interface OrderPricingSnapshot {
  shippingDeliveryFee: number;
  platformFeePct: number;
}

export interface OrderPricingSource {
  id: string;
  cartItems?: OrderPricingItem[];
  totalAmount?: string;
  totalAmountNum?: number;
  initialTotalAmountNum?: number;
  checkoutPricingSnapshot?: OrderPricingSnapshot;
}

export interface OrderPricingBreakdown {
  slabs: ReturnType<typeof computeCartGST>["slabs"];
  preTaxSubtotal: number;
  totalGst: number;
  shippingDeliveryFee: number;
  platformFee: number;
  otherAdjustments: number;
  grandTotal: number;
}

export function getOrderSubOrderId(orderId: string, item: OrderPricingItem, index: number): string {
  return item.subOrderId || `SO-${orderId}-${String(index + 1).padStart(3, "0")}`;
}

export function getOrderLineUnitPriceInclusive(item: OrderPricingItem): number {
  if (
    typeof item.checkoutUnitPriceInclusive === "number" &&
    Number.isFinite(item.checkoutUnitPriceInclusive)
  ) {
    return Math.max(0, item.checkoutUnitPriceInclusive);
  }
  const taxRate = getCartTaxRate(item) ?? getEffectiveTaxPctForCategory(item.category || "");
  return getCartUnitPriceInclusive({ ...item, priceNum: Number(item.priceNum) || 0 }, taxRate);
}

function parseStoredAmount(order: OrderPricingSource): number {
  if (typeof order.totalAmountNum === "number" && Number.isFinite(order.totalAmountNum)) {
    return Math.max(0, order.totalAmountNum);
  }
  const parsed = Number(String(order.totalAmount || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Rebuild the current customer-facing order total from the checkout snapshots.
 * Older orders did not persist discounted unit prices, so their stored original
 * total is apportioned across lines by their saved cart values instead.
 */
export function calculateRemainingOrderPricing(
  order: OrderPricingSource,
  cancelledSubOrderIds: Set<string>,
): OrderPricingBreakdown {
  const items = order.cartItems || [];
  const activeItems = items.filter(
    (item, index) => !cancelledSubOrderIds.has(getOrderSubOrderId(order.id, item, index)),
  );
  const hasCheckoutSnapshots = items.length > 0 && items.every(
    (item) =>
      typeof item.checkoutUnitPriceInclusive === "number" &&
      Number.isFinite(item.checkoutUnitPriceInclusive) &&
      typeof item.checkoutGstRate === "number" &&
      Number.isFinite(item.checkoutGstRate),
  );

  const gst = computeCartGST(
    activeItems.map((item) => {
      const rate = hasCheckoutSnapshots
        ? item.checkoutGstRate!
        : getCartTaxRate(item) ?? getEffectiveTaxPctForCategory(item.category || "");
      const inclusiveUnitPrice = hasCheckoutSnapshots
        ? item.checkoutUnitPriceInclusive!
        : getOrderLineUnitPriceInclusive(item);
      return {
        inclusiveAmount: inclusiveUnitPrice * Math.max(0, Number(item.quantity) || 0),
        category: item.category,
        taxRate: rate,
      };
    }),
  );

  if (hasCheckoutSnapshots && order.checkoutPricingSnapshot) {
    const shippingDeliveryFee = activeItems.length
      ? Math.max(0, Number(order.checkoutPricingSnapshot.shippingDeliveryFee) || 0)
      : 0;
    const platformFee =
      (gst.preTaxSubtotal * Math.max(0, Number(order.checkoutPricingSnapshot.platformFeePct) || 0)) / 100;
    const grandTotal = gst.preTaxSubtotal + gst.totalGst + shippingDeliveryFee + platformFee;
    return {
      slabs: gst.slabs,
      preTaxSubtotal: gst.preTaxSubtotal,
      totalGst: gst.totalGst,
      shippingDeliveryFee,
      platformFee,
      otherAdjustments: 0,
      grandTotal,
    };
  }

  if (items.length === 0) {
    const grandTotal = parseStoredAmount(order);
    return {
      slabs: gst.slabs,
      preTaxSubtotal: gst.preTaxSubtotal,
      totalGst: gst.totalGst,
      shippingDeliveryFee: 0,
      platformFee: 0,
      otherAdjustments: grandTotal - gst.preTaxSubtotal - gst.totalGst,
      grandTotal,
    };
  }

  const initialTotal =
    typeof order.initialTotalAmountNum === "number" && Number.isFinite(order.initialTotalAmountNum)
      ? Math.max(0, order.initialTotalAmountNum)
      : parseStoredAmount(order);
  const allLineValue = items.reduce(
    (sum, item) => sum + (Number(item.priceNum) || 0) * Math.max(0, Number(item.quantity) || 0),
    0,
  );
  const remainingLineValue = activeItems.reduce(
    (sum, item) => sum + (Number(item.priceNum) || 0) * Math.max(0, Number(item.quantity) || 0),
    0,
  );
  const grandTotal = allLineValue > 0
    ? initialTotal * (remainingLineValue / allLineValue)
    : activeItems.length === 0
      ? 0
      : initialTotal;

  return {
    slabs: gst.slabs,
    preTaxSubtotal: gst.preTaxSubtotal,
    totalGst: gst.totalGst,
    shippingDeliveryFee: 0,
    platformFee: 0,
    otherAdjustments: grandTotal - gst.preTaxSubtotal - gst.totalGst,
    grandTotal,
  };
}
