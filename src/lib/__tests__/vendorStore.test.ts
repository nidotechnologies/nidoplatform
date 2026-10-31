import { describe, expect, it } from "vitest";
import { isCatalogProductAlreadyAssigned } from "../vendorStore";

describe("isCatalogProductAlreadyAssigned", () => {
  it("matches a vendor product by catalog ID", () => {
    expect(isCatalogProductAlreadyAssigned(
      { id: "catalog-1", masterProductCode: "MPC-1" },
      [{ id: "catalog-1", masterProductCode: "MPC-1" }],
    )).toBe(true);
  });

  it("matches legacy vendor records by master product code", () => {
    expect(isCatalogProductAlreadyAssigned(
      { id: "catalog-1", masterProductCode: "MPC-1" },
      [{ id: "legacy-id", masterProductCode: "mpc-1" }],
    )).toBe(true);
  });

  it("does not match an unassigned product", () => {
    expect(isCatalogProductAlreadyAssigned(
      { id: "catalog-1", masterProductCode: "MPC-1" },
      [{ id: "catalog-2", masterProductCode: "MPC-2" }],
    )).toBe(false);
  });
});