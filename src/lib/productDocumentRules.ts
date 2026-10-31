import {
  formatLeadTimeByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  getTenureBilling,
  isDigitalOnlyType,
  type ProductTypeMetadata,
} from "./productTypeRules";
import { getOrderProductTypeMetadata } from "./orderProductType";

type ProductDocumentItem = ProductTypeMetadata & {
  productCode?: string;
  productId?: string;
  productType?: string;
  name?: string;
  itemName?: string;
  itemDetails?: string;
  description?: string;
};

export const DIGITAL_PRODUCT_HEADERS = {
  quantity: "Users / Licenses",
  tenure: "Tenure / Billing",
  provisioning: "Provisioning Time",
} as const;

export function getDocumentProductMetadata(item: ProductDocumentItem): ProductTypeMetadata {
  return getOrderProductTypeMetadata(item);
}

export function getDocumentProductType(item: ProductDocumentItem): string {
  const metadata = getDocumentProductMetadata(item);
  return getProductType(
    metadata.commercialTerms?.productType || metadata.physicalType || metadata.productType,
  );
}

export function isDigitalDocumentProduct(item: ProductDocumentItem): boolean {
  return isDigitalOnlyType(getDocumentProductType(item));
}

export function getDocumentProductPresentation(
  item: ProductDocumentItem,
  values: { quantity?: number | string; leadTime?: number | string } = {},
) {
  const metadata = getDocumentProductMetadata(item);
  const type = getProductType(
    metadata.commercialTerms?.productType || metadata.physicalType || metadata.productType,
  );
  const digital = isDigitalOnlyType(type);
  const commercialTerms = metadata.commercialTerms;
  const tenureBilling = getTenureBilling(type);
  const leadTime = formatLeadTimeByType(values.leadTime, type);

  return {
    type,
    digital,
    pricingModel: commercialTerms?.pricingModel || getPricingModel(type),
    quantityLabel: digital ? DIGITAL_PRODUCT_HEADERS.quantity : getQuantityLabel(type),
    quantity: values.quantity ?? "—",
    tenureBilling: digital
      ? `${tenureBilling.tenure} · ${tenureBilling.billing}`
      : "—",
    provisioningTime: digital
      ? commercialTerms
        ? `${commercialTerms.leadTimePrimary}${commercialTerms.leadTimeSecondary ? ` · ${commercialTerms.leadTimeSecondary}` : ""}`
        : `${leadTime.primary}${leadTime.secondary ? ` · ${leadTime.secondary}` : ""}`
      : "—",
  };
}