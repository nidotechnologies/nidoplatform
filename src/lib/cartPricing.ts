import { getClientCartPricingSettings, getSlabDiscountPct } from "./priceEngineStore";
import { computeCartGST, type GstSlab } from "./cartGstHelper";
import { getEffectiveTaxPctForCategory } from "./taxEngine";
import {
  getCartTaxRate,
  getCartUnitPriceInclusive,
  type VendorCartLine,
} from "./vendorCartPricing";

export type CartPricingItem = VendorCartLine & {
  quantity: number;
  clientId?: string;
  category?: string;
};

export interface CartPricingLine {
  taxRate: number;
  slabDiscountPct: number;
  clientDiscountPct: number;
  baseUnitPriceInclusive: number;
  preClientDiscountUnitPriceInclusive: number;
  checkoutUnitPriceInclusive: number;
  checkoutUnitPriceExclGst: number;
}

export interface CartPricingSummary {
  lines: CartPricingLine[];
  slabs: GstSlab[];
  totalGst: number;
  preTaxSubtotal: number;
  preClientDiscountSubtotal: number;
  clientDiscountAmount: number;
  shippingDeliveryFee: number;
  platformFeePct: number;
  platformFee: number;
  grandTotal: number;
}

/**
 * Calculate the customer checkout price once for Cart, Review, and saved orders.
 * Cart unit prices are GST-inclusive; the vendor landed cost is never used here.
 */
export function calculateCartPricing(items: CartPricingItem[]): CartPricingSummary {
  const lines = items.map((item) => {
    const taxRate = getCartTaxRate(item) ?? getEffectiveTaxPctForCategory(item.category || "");
    const baseUnitPriceInclusive = getCartUnitPriceInclusive(item, taxRate);
    const slabDiscountPct = item.clientId
      ? getSlabDiscountPct(item.clientId, item.category || "", item.quantity)
      : 0;
    const clientDiscountPct = item.clientId
      ? getClientCartPricingSettings(item.clientId).discountPct
      : 0;
    const preClientDiscountUnitPriceInclusive = baseUnitPriceInclusive * (1 - slabDiscountPct / 100);
    const checkoutUnitPriceInclusive =
      preClientDiscountUnitPriceInclusive * (1 - clientDiscountPct / 100);
    const checkoutUnitPriceExclGst =
      taxRate > 0
        ? checkoutUnitPriceInclusive * 100 / (100 + taxRate)
        : checkoutUnitPriceInclusive;

    return {
      taxRate,
      slabDiscountPct,
      clientDiscountPct,
      baseUnitPriceInclusive,
      preClientDiscountUnitPriceInclusive,
      checkoutUnitPriceInclusive,
      checkoutUnitPriceExclGst,
    };
  });

  const effectiveGst = computeCartGST(
    items.map((item, index) => ({
      inclusiveAmount: lines[index].checkoutUnitPriceInclusive * item.quantity,
      category: item.category,
      taxRate: lines[index].taxRate,
    })),
  );
  const beforeClientDiscount = computeCartGST(
    items.map((item, index) => ({
      inclusiveAmount: lines[index].preClientDiscountUnitPriceInclusive * item.quantity,
      category: item.category,
      taxRate: lines[index].taxRate,
    })),
  );

  const primaryClientId = items.find((item) => item.clientId)?.clientId || "";
  const clientPricing = primaryClientId
    ? getClientCartPricingSettings(primaryClientId)
    : { discountPct: 0, shippingDeliveryFee: 0, platformFeePct: 0 };
  const platformFee = (effectiveGst.preTaxSubtotal * clientPricing.platformFeePct) / 100;
  const shippingDeliveryFee = clientPricing.shippingDeliveryFee;

  return {
    lines,
    slabs: effectiveGst.slabs,
    totalGst: effectiveGst.totalGst,
    preTaxSubtotal: effectiveGst.preTaxSubtotal,
    preClientDiscountSubtotal: beforeClientDiscount.preTaxSubtotal,
    clientDiscountAmount: Math.max(0, beforeClientDiscount.preTaxSubtotal - effectiveGst.preTaxSubtotal),
    shippingDeliveryFee,
    platformFeePct: clientPricing.platformFeePct,
    platformFee,
    grandTotal: effectiveGst.preTaxSubtotal + effectiveGst.totalGst + shippingDeliveryFee + platformFee,
  };
}
