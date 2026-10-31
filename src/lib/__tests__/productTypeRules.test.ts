import { describe, expect, it } from "vitest";
import { isDigitalOnlyProduct } from "../productTypeRules";

describe("isDigitalOnlyProduct", () => {
  it("recognizes digital fulfillment and explicitly digital product types", () => {
    expect(isDigitalOnlyProduct({ fulfillmentType: "digital" })).toBe(true);
    expect(isDigitalOnlyProduct({ productType: "Software Subscription" })).toBe(true);
    expect(isDigitalOnlyProduct({ category: "Cloud Services" })).toBe(true);
  });

  it("keeps physical, hybrid, conflicting, and unknown products address-required", () => {
    expect(isDigitalOnlyProduct({ fulfillmentType: "physical", productType: "Digital License" })).toBe(false);
    expect(isDigitalOnlyProduct({ fulfillmentType: "hybrid", productType: "Hybrid Digital" })).toBe(false);
    expect(isDigitalOnlyProduct({ productType: "Physical Product" })).toBe(false);
    expect(isDigitalOnlyProduct({ productType: "Product" })).toBe(false);
  });
});
