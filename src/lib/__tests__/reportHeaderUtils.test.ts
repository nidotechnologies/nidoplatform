import { describe, expect, it } from "vitest";
import { reportCenterDisplayColumn } from "@/lib/reportHeaderUtils";

describe("reportCenterDisplayColumn", () => {
  it("uses the selected client name instead of the fixed Apex label", () => {
    expect(reportCenterDisplayColumn(
      "Data / Relationship Owners / Apex / Name",
      "client",
      "Acme Industries",
    )).toBe("Data / Relationship Owners / Acme Industries / Name");
  });

  it("uses a generic client label when no single client is selected", () => {
    expect(reportCenterDisplayColumn(
      "Data / Key Contacts / Apex / Email",
      "client",
    )).toBe("Data / Key Contacts / Client / Email");
  });

  it("does not change unrelated report column labels", () => {
    expect(reportCenterDisplayColumn("Vendor Name", "vendor", "Acme Industries")).toBe("Vendor Name");
  });
});
