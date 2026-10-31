import { describe, expect, it } from "vitest";
import {
  formatConfigurationLabel,
  getProductConfigurationEntries,
  getProductSpecLines,
} from "../productConfiguration";

describe("product configuration presentation", () => {
  it("turns legacy indexed option keys into readable labels", () => {
    expect(formatConfigurationLabel("license-type-0")).toBe("License Type");
    expect(formatConfigurationLabel("Storage Tier (2)")).toBe("Storage Tier (2)");
  });

  it("keeps selected values and omits empty options", () => {
    expect(getProductConfigurationEntries({
      "license-type-0": "Business",
      Region: "India",
      "Optional field": " ",
    })).toEqual([
      ["License Type", "Business"],
      ["Region", "India"],
    ]);
  });

  it("removes legacy configuration text from specs when structured values exist", () => {
    expect(getProductSpecLines(
      ["CPU: 8 core", "Configuration: License Type: Business"],
      { "license-type-0": "Business" },
    )).toEqual(["CPU: 8 core"]);
    expect(getProductSpecLines(["Configuration: Catalog detail"])).toEqual(["Configuration: Catalog detail"]);
  });
});
