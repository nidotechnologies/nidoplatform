import {
  formatLeadTimeByType,
  getAvailabilityByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  type StockStatus,
} from "./productTypeRules";

export interface ProductCommercialTerms {
  productType: string;
  pricingModel: string;
  quantityLabel: string;
  moq: number;
  moqLabel: string;
  leadTimePrimary: string;
  leadTimeSecondary?: string;
  availabilityPrimary: string;
  availabilityStatus: StockStatus | "Instant" | "—";
  availabilityIsUnlimited: boolean;
}

export function getProductCommercialTerms(
  type: string | undefined,
  values: { moq?: number | string; leadTime?: number | string; stock?: number },
): ProductCommercialTerms {
  const productType = getProductType(type);
  const quantityLabel = getQuantityLabel(productType);
  const moq = Math.max(0, typeof values.moq === "string" ? parseInt(values.moq, 10) || 0 : values.moq || 0);
  const leadTime = formatLeadTimeByType(values.leadTime, productType);
  const availability = values.stock === undefined && !productType.toLowerCase().includes("digital")
    ? { primary: "—", status: "—" as const, isUnlimited: false }
    : getAvailabilityByType(values.stock || 0, productType);

  return {
    productType,
    pricingModel: getPricingModel(productType),
    quantityLabel,
    moq,
    moqLabel: moq > 0 ? `${moq} ${quantityLabel}` : "—",
    leadTimePrimary: leadTime.primary,
    leadTimeSecondary: leadTime.secondary,
    availabilityPrimary: availability.primary,
    availabilityStatus: availability.status,
    availabilityIsUnlimited: availability.isUnlimited,
  };
}

export function getAvailabilityLabel(terms: ProductCommercialTerms): string {
  if (terms.availabilityPrimary === "—") return "—";
  return terms.availabilityIsUnlimited
    ? `${terms.availabilityPrimary} · Instant`
    : `${terms.availabilityPrimary} · ${terms.availabilityStatus}`;
}

export function getCommercialTermsLines(terms: ProductCommercialTerms): string[] {
  return [
    `Pricing Model: ${terms.pricingModel}`,
    `MOQ / Min Qty: ${terms.moqLabel}`,
    `Lead Time / SLA: ${terms.leadTimePrimary}${terms.leadTimeSecondary ? ` · ${terms.leadTimeSecondary}` : ""}`,
    `Availability: ${getAvailabilityLabel(terms)}`,
  ];
}