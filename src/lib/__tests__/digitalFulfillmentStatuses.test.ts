import { describe, expect, it } from "vitest";
import {
  formatPartiallyProvisionedStatus,
  deriveDigitalFulfillmentStatus,
  getDigitalFulfillmentStatusIndex,
  getDigitalFulfillmentStatusSequence,
} from "@/lib/digitalFulfillmentStatuses";

describe("digital fulfillment stages", () => {
  it("does not invent a percentage-based provisioning milestone", () => {
    expect(getDigitalFulfillmentStatusSequence(10)).toEqual([
      "Pending",
      "Processing",
      "Provisioning",
      "Partially Provisioned",
      "Provisioned",
      "Activated",
      "Completed",
    ]);
  });

  it("formats only a valid, explicitly supplied partial quantity", () => {
    expect(formatPartiallyProvisionedStatus(3, 10)).toBe("Partially Provisioned (3/10)");
    expect(formatPartiallyProvisionedStatus(0, 10)).toBeNull();
    expect(formatPartiallyProvisionedStatus(10, 10)).toBeNull();
    expect(formatPartiallyProvisionedStatus(1.5, 10)).toBeNull();
    expect(formatPartiallyProvisionedStatus(1, 1)).toBeNull();
  });

  it("keeps count-bearing legacy/current labels on the partial stage", () => {
    expect(getDigitalFulfillmentStatusIndex("Partially Provisioned (3/10)", 10)).toBe(3);
    expect(getDigitalFulfillmentStatusIndex("Confirmed", 10)).toBe(1);
  });

  it("derives digital progress from recorded line quantities", () => {
    expect(deriveDigitalFulfillmentStatus([
      { status: "Partially Provisioned (3/10)", quantity: 10 },
      { status: "Pending", quantity: 2 },
    ])).toBe("Partially Provisioned");
    expect(deriveDigitalFulfillmentStatus([
      { status: "Provisioned", quantity: 10 },
      { status: "Activated", quantity: 2 },
    ])).toBe("Provisioned");
    expect(deriveDigitalFulfillmentStatus([
      { status: "Provisioning", quantity: 2 },
    ])).toBe("Provisioning");
    expect(deriveDigitalFulfillmentStatus([
      { status: "Confirmed", quantity: 2 },
    ])).toBe("Processing");
  });
});
