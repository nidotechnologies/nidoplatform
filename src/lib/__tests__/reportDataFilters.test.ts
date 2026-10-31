import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_FILTERS } from "@/contexts/ReportControlsContext";
import { normalizeReportColumns } from "@/lib/customReportOrderData";
import { applyReportFilters, getReportFieldValue } from "@/lib/reportData";

describe("report date and field filters", () => {
  it("maps selected columns to live records from their platform modules", () => {
    expect(getReportFieldValue(
      { __module: "Clients", id: "client-1", name: "Acme Ltd", email: "ops@acme.test" },
      "Client Name",
    )).toBe("Acme Ltd");
    expect(getReportFieldValue(
      { __module: "Clients", id: "client-1", rep: "Jordan Lee" },
      "Contact Person",
    )).toBe("Jordan Lee");
    expect(getReportFieldValue(
      { __module: "Vendors", id: "vendor-1", name: "North Supply", category: "Hardware" },
      "Vendor Name",
    )).toBe("North Supply");
    expect(getReportFieldValue(
      { __module: "Catalog", id: "product-1", productName: "Monitor", skuCode: "MON-01" },
      "SKU",
    )).toBe("MON-01");
    expect(getReportFieldValue(
      { __module: "Orders", id: "order-1", orderNumber: "SO-00001", clientName: "Acme Ltd" },
      "Client Name",
    )).toBe("Acme Ltd");
    expect(getReportFieldValue(
      { __module: "Users", id: "user-1", name: "Jordan Lee", department: "Operations" },
      "User Name",
    )).toBe("Jordan Lee");
  });

  it("uses distinct sales-order dates and totals in report output", () => {
    const order = {
      __module: "Orders",
      id: "internal-1",
      orderNumber: "SO-00001",
      createdAt: "2026-10-08",
      orderDate: "2026-10-09",
      subtotal: 100,
      totalTax: 18,
      grandTotal: 118,
      assignedTo: "Jordan Lee",
    };

    expect(getReportFieldValue(order, "ID")).toBe("SO-00001");
    expect(getReportFieldValue(order, "Order ID")).toBe("SO-00001");
    expect(getReportFieldValue(order, "Created On")).not.toBe(getReportFieldValue(order, "Order Date"));
    expect(getReportFieldValue(order, "Amount")).not.toBe(getReportFieldValue(order, "Total"));
    expect(getReportFieldValue(order, "Created By")).toBe("—");
  });

  it("removes unavailable fields and collapses duplicate report labels", () => {
    expect(normalizeReportColumns("Catalog", ["ID", "Created On", "Item Name", "Stock", "Unit"]))
      .toEqual(["ID", "Item Name"]);
    expect(normalizeReportColumns("Services", ["ID", "Created On", "Request Date"]))
      .toEqual(["ID", "Request Date"]);
    expect(normalizeReportColumns("Support Tickets", ["Ticket ID", "Resolution Date", "Subject"]))
      .toEqual(["Ticket ID", "Subject"]);
    expect(normalizeReportColumns("Clients", ["Created On", "Created By", "Client Name", "Contact Person"]))
      .toEqual(["Client Name", "Contact Person"]);
    expect(normalizeReportColumns("Users", ["ID", "Created By", "User Name"]))
      .toEqual(["ID", "User Name"]);
    expect(normalizeReportColumns("Orders", ["ID", "Order ID", "Amount", "Total"]))
      .toEqual(["Order ID", "Amount", "Total"]);
    expect(normalizeReportColumns("Orders", [
      "Master Order ID", "Order ID", "Client", "Client Name", "Order Status",
      "Current Order Status", "Amount", "Order Total", "Total", "Selected Vendor",
      "Vendor Name", "Order Notes", "Checkout Note",
    ])).toEqual(["Master Order ID", "Client", "Order Status", "Total", "Selected Vendor", "Order Notes"]);
  });

  it("filters an inclusive custom date range", () => {
    const records = [
      { id: "before", createdAt: "2026-10-07", status: "Paid" },
      { id: "start", createdAt: "2026-10-08", status: "Paid" },
      { id: "end", createdAt: "2026-10-10", status: "Pending" },
      { id: "after", createdAt: "2026-10-11", status: "Paid" },
    ];

    const result = applyReportFilters(records, {
      ...DEFAULT_REPORT_FILTERS,
      datePreset: "custom",
      dateFrom: "2026-10-08",
      dateTo: "2026-10-10",
    });

    expect(result.map((record) => record.id)).toEqual(["start", "end"]);
  });

  it("combines date, client, and status filters and excludes records without a date", () => {
    const records = [
      { id: "match", invoiceDate: "2026-10-09", clientName: "Acme", status: "Paid" },
      { id: "wrong-client", invoiceDate: "2026-10-09", clientName: "Other", status: "Paid" },
      { id: "wrong-status", invoiceDate: "2026-10-09", clientName: "Acme", status: "Pending" },
      { id: "missing-date", clientName: "Acme", status: "Paid" },
    ];

    const result = applyReportFilters(records, {
      ...DEFAULT_REPORT_FILTERS,
      datePreset: "custom",
      dateFrom: "2026-10-08",
      dateTo: "2026-10-10",
      client: "Acme",
      status: "Paid",
    });

    expect(result.map((record) => record.id)).toEqual(["match"]);
  });

  it("uses local calendar dates for the Today preset", () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const result = applyReportFilters(
      [{ id: "today", date: todayKey }, { id: "yesterday", date: yesterdayKey }],
      { ...DEFAULT_REPORT_FILTERS, datePreset: "today" },
    );

    expect(result.map((record) => record.id)).toEqual(["today"]);
  });
});
