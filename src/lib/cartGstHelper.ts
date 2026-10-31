// Cart GST Helper — extracts the GST already embedded in tax-inclusive item prices.
// The Client Price Engine builds finalPrice = preTax + tax, so priceNum in the cart
// already contains GST. We back-calculate it here by rate so summaries show the
// correct pre-tax subtotal + per-rate GST breakdown instead of adding tax twice.

import { getEffectiveTaxPctForCategory } from './taxEngine';

export interface GstSlab {
  rate: number;     // GST rate %, e.g. 18
  taxable: number;  // pre-tax amount for items at this rate (rounded)
  gst: number;      // GST amount for this slab (rounded)
}

export interface CartGstResult {
  slabs: GstSlab[];      // one entry per distinct rate, sorted ascending
  totalGst: number;      // sum of all slab gst values
  preTaxSubtotal: number; // sum of all pre-tax amounts (= total - totalGst)
  isMixed: boolean;      // true when 2+ distinct rates exist in the cart
}

/**
 * Given items whose `inclusiveAmount` is the tax-inclusive price total
 * (priceNum × qty, after any slab discounts), extract the GST component
 * per category rate and return the pre-tax subtotal + per-rate breakdown.
 *
 * Formula (tax-exclusive rate R added on top):
 *   preTax  = inclusiveAmount × 100 / (100 + R)
 *   gst     = inclusiveAmount − preTax
 */
export function computeCartGST(
  items: { inclusiveAmount: number; category?: string; taxRate?: number }[],
): CartGstResult {
  const rateMap = new Map<number, { preTax: number; gst: number }>();

  for (const item of items) {
    const rate = typeof item.taxRate === 'number' && Number.isFinite(item.taxRate)
      ? item.taxRate
      : getEffectiveTaxPctForCategory(item.category || '');
    const preTax = item.inclusiveAmount * 100 / (100 + rate);
    const gst   = item.inclusiveAmount - preTax;
    const prev  = rateMap.get(rate) ?? { preTax: 0, gst: 0 };
    rateMap.set(rate, { preTax: prev.preTax + preTax, gst: prev.gst + gst });
  }

  const slabs: GstSlab[] = [...rateMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, { preTax, gst }]) => ({
      rate,
      taxable: Math.round(preTax),
      gst:     Math.round(gst),
    }));

  const totalGst       = slabs.reduce((s, sl) => s + sl.gst, 0);
  const preTaxSubtotal = slabs.reduce((s, sl) => s + sl.taxable, 0);

  return { slabs, totalGst, preTaxSubtotal, isMixed: slabs.length > 1 };
}
