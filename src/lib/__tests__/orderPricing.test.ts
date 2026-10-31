import { describe, expect, it } from "vitest";
import { calculateRemainingOrderPricing } from "../orderPricing";

describe("calculateRemainingOrderPricing", () => {
  it("recalculates customer totals from checkout snapshots and keeps order fees for remaining items", () => {
    const order = {
      id: "ORD-100",
      totalAmount: "$385.00",
      totalAmountNum: 385,
      checkoutPricingSnapshot: {
        shippingDeliveryFee: 10,
        platformFeePct: 5,
      },
      cartItems: [
        {
          id: 1,
          subOrderId: "SO-ORD-100-001",
          priceNum: 120,
          checkoutUnitPriceInclusive: 240,
          checkoutGstRate: 20,
          quantity: 2,
          category: "Hardware",
        },
        {
          id: 2,
          subOrderId: "SO-ORD-100-002",
          priceNum: 120,
          checkoutUnitPriceInclusive: 120,
          checkoutGstRate: 20,
          quantity: 1,
          category: "Hardware",
        },
      ],
    };

    const remaining = calculateRemainingOrderPricing(
      order,
      new Set(["SO-ORD-100-001"]),
    );

    expect(remaining.preTaxSubtotal).toBe(100);
    expect(remaining.totalGst).toBe(20);
    expect(remaining.shippingDeliveryFee).toBe(10);
    expect(remaining.platformFee).toBe(5);
    expect(remaining.grandTotal).toBe(135);
  });

  it("preserves legacy order totals by allocating them in proportion to saved line values", () => {
    const order = {
      id: "ORD-200",
      totalAmount: "₹354.00",
      totalAmountNum: 354,
      cartItems: [
        {
          id: 1,
          subOrderId: "SO-ORD-200-001",
          priceNum: 118,
          gstSnapshot: 18,
          quantity: 1,
          category: "Hardware",
        },
        {
          id: 2,
          subOrderId: "SO-ORD-200-002",
          priceNum: 236,
          gstSnapshot: 18,
          quantity: 1,
          category: "Hardware",
        },
      ],
    };

    const remaining = calculateRemainingOrderPricing(
      order,
      new Set(["SO-ORD-200-001"]),
    );

    expect(remaining.grandTotal).toBe(236);
  });
});
