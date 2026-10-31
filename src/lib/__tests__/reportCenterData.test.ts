import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clientStore", () => ({
  getClients: () => [{ id: "client-1", name: "Acme" }],
}));
vi.mock("@/lib/clientCatalogStore", () => ({
  getClientCatalog: () => [{ productCode: "AC-1", name: "Acme Product", priceNum: 125, availability: "In stock" }],
}));
vi.mock("@/lib/catalogStore", () => ({
  getCatalogProducts: () => [{ id: "global-product", name: "Global Product" }],
}));
vi.mock("@/lib/clientDataStore", () => ({
  getClientOrders: (clientId: string) => [{
    id: "client-order-1",
    clientId,
    date: "2026-10-01",
    amountNum: 500,
    amount: "₹500",
    client: "Acme",
    status: "Processing",
    cartItems: [
      { name: "Acme Keyboard", productCode: "KB-1", quantity: 2, priceNum: 1500 },
      { name: "Nido Monitor", productCode: "MN-2", quantity: 1, priceNum: 7200 },
    ],
    orderNotes: "Call before delivery",
    deliveryAddress: "12 Market Road, Pune",
    deliveryDetails: {
      label: "Office",
      attentionName: "Asha",
      line1: "12 Market Road",
      line2: "Suite 4",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      zip: "411001",
      phone: "9876543210",
      instructions: "Use the rear entrance",
    },
  }],
  getClientServices: (clientId: string) => [{
    id: "client-service-1",
    clientId,
    name: "Cloud Hosting",
    provider: "Cloud Co",
    startDate: "2026-10-02",
    endDate: "2027-10-01",
    amount: "₹1,200/year",
    status: "Active",
    category: "Hosting",
  }],
}));
vi.mock("@/lib/salesOrderStore", () => ({
  getOrders: () => [{ id: "internal-order-1", orderNumber: "SO-1" }],
}));
vi.mock("@/lib/serviceRequestsStore", () => ({
  getServiceRequests: () => [{
    id: "service-request-1",
    clientId: "client-1",
    status: "Scheduled",
    createdAt: "2026-10-04",
    payload: {
      serviceName: "AMC maintenance",
      requestDate: "2026-10-03",
      assignment: { assignedVendor: "Service Partner" },
      appointments: [{ date: "2026-10-05", timeFrom: "09:00", timeTo: "10:00" }],
    },
  }],
}));
vi.mock("@/lib/invoiceStore", () => ({
  getInvoices: () => [{
    id: "invoice-1",
    invoiceNumber: "INV-1",
    clientId: "client-1",
    payments: [{ id: "payment-1", amount: 400, date: "2026-10-02", method: "Bank transfer" }],
    activity: [{ id: "activity-1", title: "Invoice sent", date: "2026-10-01" }],
  }],
}));
vi.mock("@/lib/paymentReceiptStore", () => ({
  getReceipts: () => [{
    id: "receipt-1",
    receiptNumber: "RCPT-1",
    clientId: "client-1",
    invoiceNumber: "INV-1",
    amountReceived: 400,
    paymentDate: "2026-10-02",
    status: "Reconciled",
  }],
}));

import {
  filterReportCenterRecords,
  getReportCenterRecords,
  getReportCenterDefaultColumns,
  getReportCenterCellValue,
  getReportCenterColumnsForRecords,
  getReportCenterExportData,
  getReportCenterMappedColumns,
  getReportCenterPreview,
  getReportCenterRows,
  loadReportCenterRecords,
  orderReportCenterColumns,
  REPORT_CENTER_COLUMNS,
  REPORT_CENTER_MODULES,
  uniqueReportCenterColumns,
} from "@/lib/reportCenterData";

describe("report center live data sources", () => {
  it("loads the selected client catalog instead of the global catalog", async () => {
    const records = await loadReportCenterRecords("Catalog", "client");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      clientId: "client-1",
      clientName: "Acme",
      productName: "Acme Product",
    });
  });

  it("loads client portal orders and maps their date and amount into report fields", () => {
    const [record] = getReportCenterRecords("Client Orders", "client");

    expect(record).toMatchObject({
      id: "client-order-1",
      clientId: "client-1",
      clientName: "Acme",
      orderDate: "2026-10-01",
      amount: 500,
      totalAmount: 500,
    });
  });

  it("maps checkout notes and delivery details into client order previews and exports", () => {
    const records = getReportCenterRecords("Client Orders", "client");
    const columns = [
      "Order Notes",
      "Delivery Address",
      "Delivery Details / Label",
      "Delivery Details / Attention Name",
      "Delivery Details / Line1",
      "Delivery Details / Line2",
      "Delivery Details / City",
      "Delivery Details / State",
      "Delivery Details / Country",
      "Delivery Details / Zip",
      "Delivery Details / Phone",
      "Delivery Details / Instructions",
    ];
    const preview = getReportCenterPreview(records, columns);
    const rows = getReportCenterRows(records, columns);

    expect(preview[0].values).toEqual(rows[0]);
    expect(rows[0]).toEqual({
      "Order Notes": "Call before delivery",
      "Delivery Address": "12 Market Road, Pune",
      "Delivery Details / Label": "Office",
      "Delivery Details / Attention Name": "Asha",
      "Delivery Details / Line1": "12 Market Road",
      "Delivery Details / Line2": "Suite 4",
      "Delivery Details / City": "Pune",
      "Delivery Details / State": "Maharashtra",
      "Delivery Details / Country": "India",
      "Delivery Details / Zip": "411001",
      "Delivery Details / Phone": "9876543210",
      "Delivery Details / Instructions": "Use the rear entrance",
    });
  });

  it("shows only product names in the Client Orders Cart Items column", () => {
    const records = getReportCenterRecords("Client Orders", "client");
    const columns = ["Cart Items"];
    const preview = getReportCenterPreview(records, columns);
    const rows = getReportCenterRows(records, columns);

    expect(preview[0].values["Cart Items"]).toBe("Acme Keyboard, Nido Monitor");
    expect(rows[0]["Cart Items"]).toBe("Acme Keyboard, Nido Monitor");
  });

  it("shows product names only for Item, Items, Line Items, and Cart Items columns", () => {
    const record = {
      item: { name: "Adapter", quantity: 4, sku: "AD-4", price: 250 },
      items: [
        { productName: "Keyboard", quantity: 2, sku: "KB-1", rate: 900 },
        { product: { name: "Monitor", sku: "MN-2" }, qty: 1, amount: 7200 },
      ],
      lineItems: [{ itemName: "Dock", quantity: 3, description: "USB-C docking station" }],
      cartItems: [{ name: "Mouse", quantity: 5, productCode: "MS-5" }],
    };

    expect(getReportCenterCellValue(record, "Item")).toBe("Adapter");
    expect(getReportCenterCellValue(record, "Items")).toBe("Keyboard, Monitor");
    expect(getReportCenterCellValue(record, "Line Items")).toBe("Dock");
    expect(getReportCenterCellValue(record, "Cart Items")).toBe("Mouse");
  });

  it("removes duplicate report columns from selection, preview, and exports", () => {
    const selected = ["Cart Items", "cart-items", "Cart Items"];
    const columns = uniqueReportCenterColumns(selected);
    const record = { cartItems: [{ name: "Keyboard", quantity: 2 }] };

    expect(columns).toEqual(["Cart Items"]);
    expect(orderReportCenterColumns("Client Orders", selected)).toEqual(["Cart Items"]);
    expect(getReportCenterPreview([record], selected)[0].values).toEqual({ "Cart Items": "Keyboard" });
    expect(getReportCenterRows([record], selected)[0]).toEqual({ "Cart Items": "Keyboard" });
    expect(getReportCenterExportData([record], selected)).toEqual([
      { key: "Cart Items", label: "Cart Items" },
    ]);
  });

  it("resolves nested values inside arrays and flattened workbook groups", () => {
    const record = {
      generalSpecs: [{ id: "GS-1", category: "Display", attributeValue: "27 inch" }],
      options: [{ id: "OPT-1", label: "Black", priceAdjustment: 15 }],
      activities: [{ title: "Updated", date: "2026-10-10" }],
      prefixes: [{ key: "order", label: "Order", value: "ORD-" }],
      productName: "Monitor",
    };

    expect(getReportCenterCellValue(record, "General / Category")).toBe("Display");
    expect(getReportCenterCellValue(record, "Option / Label")).toBe("Black");
    expect(getReportCenterCellValue(record, "Option / Price Adjustment")).toContain("15");
    expect(getReportCenterCellValue(record, "Activity / Title")).toBe("Updated");
    expect(getReportCenterCellValue(record, "Prefix / Value")).toBe("ORD-");
    expect(getReportCenterCellValue(record, "Detail / Name")).toBe("Monitor");
  });

  it("offers and exports only columns with values in the selected module's records", () => {
    const records = [{
      id: "ORDER-1",
      cartItems: [{ name: "Keyboard", quantity: 2 }],
    }];
    const available = getReportCenterColumnsForRecords("Client Orders", records)
      .flatMap((columnGroup) => columnGroup.columns);

    expect(available).toContain("Report Generated At");
    expect(available).toContain("ID");
    expect(available).toContain("Cart Items");
    expect(available).not.toContain("Payment Method");
    expect(getReportCenterMappedColumns(
      "Client Orders",
      ["ID", "Payment Method", "Cart Items"],
      records,
    )).toEqual(["ID", "Cart Items"]);
    expect(REPORT_CENTER_MODULES.internal).not.toContain("Transactions Ledger");
  });

  it("does not present non-ledger source documents as posted transaction-ledger entries", () => {
    expect(() => getReportCenterRecords("Transactions Ledger", "internal"))
      .toThrow(/ledger postings are not stored/i);
  });

  it("keeps each report module's column catalog free of duplicate labels", () => {
    Object.entries(REPORT_CENTER_COLUMNS).forEach(([, groups]) => {
      const columns = groups.flatMap((group) => group.columns);
      const identities = columns.map((column) => column.toLowerCase().replace(/[^a-z0-9]/g, ""));
      expect(new Set(identities).size).toBe(identities.length);
    });

    expect(getReportCenterCellValue({
      Items: JSON.stringify([{ name: "Serialized product", quantity: 3, price: 150 }]),
    }, "Items")).toBe("Serialized product");
  });

  it("loads client services and includes their start date in date filtering", () => {
    const records = getReportCenterRecords("Services", "client");
    const filtered = filterReportCenterRecords(records, {
      entityType: "client",
      entityIds: [],
      allEntities: true,
      dateBasis: "Created date",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    }, { client: [], vendor: [], internal: [] });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      serviceName: "Cloud Hosting",
      requestDate: "2026-10-02",
      clientName: "Acme",
      assignedTo: "Cloud Co",
    });
  });

  it("keeps internal sales orders on the internal Orders report", () => {
    expect(getReportCenterRecords("Orders", "internal")).toEqual([
      { id: "internal-order-1", orderNumber: "SO-1" },
    ]);
  });

  it("uses nested platform service-request payloads in both preview and export rows", () => {
    const records = getReportCenterRecords("Services Request Register", "client");
    const columns = ["Service Name", "Request Date", "Status", "Assignment / Assigned Vendor"];

    expect(records[0]).toMatchObject({
      id: "service-request-1",
      serviceName: "AMC maintenance",
      requestDate: "2026-10-03",
    });
    expect(getReportCenterPreview(records, columns)[0].values).toEqual(getReportCenterRows(records, columns)[0]);
    expect(getReportCenterPreview(records, columns)[0].values).toMatchObject({
      "Service Name": "AMC maintenance",
      "Request Date": expect.stringContaining("2026"),
      Status: "Scheduled",
      "Assignment / Assigned Vendor": "Service Partner",
    });
  });

  it("keeps invoice payments and activities as separate live report rows", () => {
    const records = getReportCenterRecords("Invoice Payments and Activity", "client");
    const columns = ["Invoice Number", "Event Type", "Payment / ID", "Activity / Title"];
    const rows = getReportCenterRows(records, columns);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Invoice Number": "INV-1",
      "Event Type": "Payment",
      "Payment / ID": "payment-1",
    });
    expect(rows[1]).toMatchObject({
      "Invoice Number": "INV-1",
      "Event Type": "Activity",
      "Activity / Title": "Invoice sent",
    });
  });

  it("maps a receipt to its invoice allocation for the report preview and export", () => {
    const records = getReportCenterRecords("Receipt Allocations", "client");
    const columns = ["Receipt ID", "Invoice ID", "Invoice Number", "Allocation Date", "Allocated Amount"];
    const preview = getReportCenterPreview(records, columns);
    const rows = getReportCenterRows(records, columns);

    expect(preview).toHaveLength(1);
    expect(preview[0].values).toEqual(rows[0]);
    expect(rows[0]).toMatchObject({
      "Receipt ID": "receipt-1",
      "Invoice ID": "invoice-1",
      "Invoice Number": "INV-1",
      "Allocated Amount": expect.stringContaining("400"),
    });
  });

  it("uses the workbook's exact column order for supported modules and report exports", () => {
    const columns = getReportCenterDefaultColumns("Client Orders");
    const reversedSelection = [...columns].reverse();
    const moduleOptions = REPORT_CENTER_MODULES.client;
    const workbookColumns = REPORT_CENTER_COLUMNS["Client Orders"].flatMap((group) => group.columns);
    expect(workbookColumns).toContain("Order Notes");
    expect(workbookColumns).toContain("Delivery Details / Instructions");
    expect(workbookColumns).not.toContain("Billing Address Line 1");
    expect(workbookColumns).not.toContain("Delivery Date");

    expect(columns).toEqual([
      "Report Date From",
      "Report Date To",
      "Report Date Basis",
      "Report Generated At",
      "Report Timezone",
      "ID",
    ]);
    expect(moduleOptions).toContain("Client Orders");
    expect(moduleOptions).not.toContain("Order Documents");
    expect(orderReportCenterColumns("Client Orders", reversedSelection)).toEqual(columns);
    const selectedWithName = ["Client Name", ...reversedSelection];
    const selectedSet = new Set(selectedWithName);
    expect(orderReportCenterColumns("Client Orders", selectedWithName)).toEqual([
      ...workbookColumns.filter((column) => selectedSet.has(column)),
    ]);
    expect(workbookColumns.slice(0, columns.length)).toEqual(columns);
  });
});
