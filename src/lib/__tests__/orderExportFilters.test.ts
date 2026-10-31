import { describe, expect, it } from "vitest";
import {
  EMPTY_ORDER_EXPORT_FILTERS,
  filterOrdersForExport,
  normalizeExportDate,
} from "../orderExportFilters";

const records = [
  { date: "2026-10-01", status: "Processing", clientId: "client-1" },
  { date: "2026-10-15", status: "Shipped", clientId: "client-2" },
  { date: "2026-10-31", status: "Processing", clientId: "client-2" },
  { date: "", status: "Processing", clientId: "client-1" },
];

describe("order export filters", () => {
  it("keeps all records when no export options are selected", () => {
    expect(filterOrdersForExport(records, EMPTY_ORDER_EXPORT_FILTERS, {
      getDate: record => record.date,
      getStatus: record => record.status,
      getClient: record => record.clientId,
    })).toEqual(records);
  });

  it("combines inclusive date range, status, and client selections", () => {
    expect(filterOrdersForExport(records, {
      fromDate: "2026-10-15",
      toDate: "2026-10-31",
      statuses: ["Processing"],
      clients: ["client-2"],
    }, {
      getDate: record => record.date,
      getStatus: record => record.status,
      getClient: record => record.clientId,
    })).toEqual([records[2]]);
  });

  it("excludes records without a valid date when date bounds are selected", () => {
    expect(filterOrdersForExport(records, {
      fromDate: "2026-10-01",
      toDate: "",
      statuses: [],
      clients: [],
    }, {
      getDate: record => record.date,
      getStatus: record => record.status,
      getClient: record => record.clientId,
    })).toEqual(records.slice(0, 3));
  });

  it("normalizes ISO, day-first, and readable order dates", () => {
    expect(normalizeExportDate("2026-10-01T17:17:00.000Z")).toBe("2026-10-01");
    expect(normalizeExportDate("02/10/2026")).toBe("2026-10-02");
    expect(normalizeExportDate("Oct 1, 2026")).toBe("2026-10-01");
    expect(normalizeExportDate("not a date")).toBe("");
  });
});