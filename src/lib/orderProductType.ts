import { findCatalogProductByName, getCatalogProducts } from "./catalogStore";
import type { ProductTypeMetadata } from "./productTypeRules";

type OrderProductSnapshot = ProductTypeMetadata & {
  productCode?: string;
  name?: string;
  itemName?: string;
  itemDetails?: string;
};

/**
 * Orders created before product-type metadata was copied onto cart items can
 * still be classified from the original catalog product. Explicit order
 * metadata remains authoritative; the catalog is only a legacy recovery path.
 */
export function getOrderProductTypeMetadata(item: OrderProductSnapshot): ProductTypeMetadata {
  const catalogProduct = item.productCode
    ? getCatalogProducts().find((product) =>
        product.masterProductCode === item.productCode
        || product.skuCode === item.productCode,
      )
    : undefined;
  const matchedProduct = catalogProduct
    || (item.name || item.itemName || item.itemDetails
      ? findCatalogProductByName(item.name || item.itemName || item.itemDetails || "")
      : undefined);

  return {
    productType: item.productType || matchedProduct?.productType,
    physicalType: item.physicalType || matchedProduct?.physicalType,
    fulfillmentType: item.fulfillmentType,
    category: item.category || matchedProduct?.category,
    commercialTerms: item.commercialTerms,
  };
}