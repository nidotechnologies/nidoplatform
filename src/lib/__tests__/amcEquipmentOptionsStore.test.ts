import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCustomAMCEquipmentOption,
  getCustomAMCEquipmentOptions,
} from "@/lib/amcEquipmentOptionsStore";

describe("AMC equipment option store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists new categories, brands, and models in their selected hierarchy", () => {
    const updated = vi.fn();
    window.addEventListener("amcEquipmentOptionsUpdated", updated);

    expect(addCustomAMCEquipmentOption("category", "Lab Equipment")).toEqual({
      value: "Lab Equipment",
      added: true,
    });
    addCustomAMCEquipmentOption("brand", "Acme Medical", "Lab Equipment");
    addCustomAMCEquipmentOption("model", "Analyzer 4000", "Lab Equipment", "Acme Medical");

    expect(getCustomAMCEquipmentOptions()).toEqual({
      categories: ["Lab Equipment"],
      brandsByCategory: { "Lab Equipment": ["Acme Medical"] },
      modelsByCategory: { "Lab Equipment": { "Acme Medical": ["Analyzer 4000"] } },
    });
    expect(updated).toHaveBeenCalledTimes(3);
    window.removeEventListener("amcEquipmentOptionsUpdated", updated);
  });

  it("returns the existing option instead of saving a case-insensitive duplicate", () => {
    addCustomAMCEquipmentOption("category", "Lab Equipment");

    expect(addCustomAMCEquipmentOption("category", "  lab   equipment ")).toEqual({
      value: "Lab Equipment",
      added: false,
    });
    expect(getCustomAMCEquipmentOptions().categories).toEqual(["Lab Equipment"]);
  });
});
