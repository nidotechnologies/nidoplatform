import { beforeEach, describe, expect, it } from "vitest";
import { searchGlobalPlatform } from "@/lib/globalSearch";

describe("global platform search", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("finds platform pages and seeded records", () => {
    const pageResults = searchGlobalPlatform("purchase orders");
    expect(pageResults.some(result => result.type === "page" && result.path === "/purchase-orders")).toBe(true);

    const recordResults = searchGlobalPlatform("Raj Manufacturing");
    expect(recordResults.some(result =>
      result.type === "record"
      && result.title === "Raj Manufacturing"
      && result.path === "/clients/CI-00019",
    )).toBe(true);
  });

  it("searches record IDs and does not index sensitive fields", () => {
    localStorage.setItem("nido_support_tickets", JSON.stringify([{
      id: "CUSTOM-001",
      subject: "Northwind",
      status: "Active",
      password: "should never be searchable",
    }]));

    expect(searchGlobalPlatform("CUSTOM-001").some(result =>
      result.title === "Northwind" && result.path === "/support/ticket/CUSTOM-001",
    )).toBe(true);
    expect(searchGlobalPlatform("should never be searchable")).toHaveLength(0);
  });
});