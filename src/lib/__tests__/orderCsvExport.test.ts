import { afterEach, describe, expect, it } from "vitest";
import { buildOrderReportRows, buildOrdersCsv, buildVendorOrdersCsv } from "../orderCsvExport";
import type { ApprovalRequest } from "../approvalEngine";
import type { MyOrder } from "@/contexts/MyOrdersContext";

const TEMPLATE_HEADERS = [
  "Report From", "Report To", "Master Order ID", "SUB ORDER ID", "Client PO Reference", "Client", "Client ID",
  "Created By", "Created At", "Requester", "Requester Role", "Ordered For", "Assigned To", "Assigned Role",
  "Order Date", "Order Time", "Current Order Status", "Approval Status", "Approval Workflow", "Approval Requested By",
  "Approval Date", "Approved By", "Updated By", "Last Updated At", "Update Count", "SLA Time", "SLA Alert",
  "Order Total", "Payment Method", "Payment Terms", "Delivery Attention", "Delivery Address", "City", "State",
  "Country", "ZIP Code", "Delivery Phone", "Delivery Notes", "Checkout Note", "Order Notes", "Cancel Reason",
  "Item Name", "SKU / Product Code", "Category", "Quantity", "Unit Price", "Line Amount", "Item Status",
  "Item Status Updated At", "Reference Number", "Serial Number", "Tracking Number", "Tracking Carrier",
  "Tracking Note", "Selected Vendor", "Vendor PO Numbers", "PO Created AT", "Vendor PO Statuses",
  "Last Updated BY", "Last Updated At", "Last Comment",
];

function parseCsv(csv: string): string[][] {
  const input = csv.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && next === "\n") i += 1;
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const order: MyOrder = {
  id: "ORD-000001",
  createdBy: "Rajesh Kumar",
  createdAt: "2026-10-01T17:17:00.000Z",
  updatedBy: "Admin User",
  updatedAt: "2026-10-02T08:30:00.000Z",
  updateCount: 1,
  client: "Raj Manufacturing",
  clientId: "CI-00019",
  clientColor: "#2563eb",
  clientInitial: "R",
  poNumber: "PO-045183",
  requester: "Rajesh Kumar",
  requesterRole: "Client Admin",
  requesterInitial: "R",
  requesterColor: "#2563eb",
  assigned: "Admin User",
  assignedRole: "System Admin",
  assignedInitial: "A",
  assignedColor: "#16a34a",
  orderDate: "Oct 1, 2026",
  orderTime: "10:47 PM",
  status: "Processing",
  slaTime: "2 days",
  slaAlert: false,
  totalAmount: "₹5,900",
  totalAmountNum: 5900,
  paymentMethod: "Company BAN",
  paymentTerms: "Net 30",
  deliveryAddress: "123 Tech Street, Mumbai",
  deliveryDetails: {
    attentionName: "Receiving Desk",
    line1: "123 Tech Street",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    zip: "400001",
    phone: "9000000000",
    instructions: "Use the east gate",
  },
  orderNotes: "=SUM(A1:A3)",
  cartItems: [{
    id: 2049,
    name: "Samsung Galaxy",
    image: "",
    priceNum: 5900,
    quantity: 1,
    category: "Electronics",
    specs: ["128GB"],
    moq: 1,
    clientId: "CI-00019",
    productCode: "MPC-2026-000001",
    subOrderId: "SO-ORD-000001-001",
  }],
};

afterEach(() => localStorage.clear());

describe("buildOrdersCsv", () => {
  it("matches the workbook columns exactly and exports their order and item details", () => {
    localStorage.setItem("nido_notes_ORD-000001", JSON.stringify([
      {
        id: "status-change-1",
        author: "Admin User",
        date: "Oct 2, 2026 08:30 AM",
        text: "Order status changed from Draft to Processing.",
        visibility: "Internal Note",
        kind: "status-change",
      },
      {
        id: "activity_order_placed_ORD-000001",
        author: "Rajesh Kumar",
        date: "Oct 1, 2026 10:47 PM",
        text: "Order ORD-000001 was placed.",
        visibility: "Internal Note",
        kind: "activity",
      },
      {
        id: "note-1",
        author: "Rajesh Kumar",
        date: "Oct 2, 2026 08:31 AM",
        text: "Please call before delivery.",
        visibility: "External Note",
      },
    ]));
    localStorage.setItem("nido_docs_ORD-000001", JSON.stringify([{
      id: "doc-1",
      name: "purchase-request.pdf",
      ext: "pdf",
      size: "42 KB",
      type: "Purchase Request",
      uploadedBy: "Rajesh Kumar",
      uploadedOn: "Oct 1, 2026",
      description: "Signed request",
      dataUrl: "private-file-payload",
      passwordHash: "private-document-password-hash",
    }]));
    localStorage.setItem("nido_all_purchase_orders", JSON.stringify([{
      poNumber: "VPO-0001",
      orderId: order.id,
      subOrderId: "SO-ORD-000001-001",
      subOrderIds: ["SO-ORD-000001-001"],
      items: [{
        subOrderId: "SO-ORD-000001-001",
        item: "Samsung Galaxy",
        sku: "MPC-2026-000001",
        productCode: "MPC-2026-000001",
        category: "Electronics",
        hsnCode: "8517",
        specs: ["128GB"],
        referenceNumber: "REF-1",
        tracking: { number: "TRACK-1", carrier: "UPS", note: "Shipped on Oct 1", link: "https://example.com/track" },
        qty: 1,
        unitPrice: 5000,
        lineSubtotal: 5000,
        status: "Processing",
      }],
      vendorId: "VND-1001",
      vendorName: "InfoTech Pvt. Ltd.",
      vendorContact: "Vendor Contact",
      vendorEmail: "vendor@example.com",
      vendorPhone: "9000000000",
      vendorGstin: "GST-123",
      vendorAddress: "Mumbai",
      vendorAddressLine1: "",
      vendorAddressLine2: "",
      vendorCity: "Mumbai",
      vendorState: "Maharashtra",
      vendorPincode: "400001",
      item: "Samsung Galaxy",
      sku: "MPC-2026-000001",
      category: "Electronics",
      hsnCode: "8517",
      specs: ["128GB"],
      referenceNumber: "REF-1",
      qty: 1,
      unitPrice: 5000,
      subtotal: 5000,
      sgstPct: 9,
      cgstPct: 9,
      sgstAmt: 450,
      cgstAmt: 450,
      grandTotal: 5900,
      paymentTerms: "Net 30",
      status: "Confirmed",
      createdOn: "2026-10-01T17:20:00.000Z",
      createdOnDisplay: "01/10/2026",
      requestedDelivery: "Oct 10, 2026",
      documents: [{ id: "po-doc", name: "vendor-po.pdf", ext: "pdf", type: "PO", uploadedBy: "Admin", uploadedOn: "Oct 1, 2026", dataUrl: "po-private-payload" }],
      notes: [{ id: "po-note", author: "Admin", initials: "A", color: "#000", date: "Oct 1, 2026", text: "PO issued", visibility: "Internal Note", kind: "activity" }],
    }]));

    const csv = buildOrdersCsv([{ ...order, createdAt: "2026-10-01T17:17:00" }], {
      reportFrom: "2026-10-01",
      reportTo: "2026-10-31",
      approvalRequests: [{
        id: "approval-1",
        workflowId: "workflow-1",
        workflow: "Order approval",
        workflowVersion: 1,
        module: "Order",
        trigger: "Order placed",
        reference: order.id,
        requestedBy: "user-1",
        requestedByName: "Rajesh Kumar",
        currentApprover: "Admin User",
        currentLevel: 1,
        status: "Approved",
        context: {},
        createdAt: "2026-10-01T17:18:00.000Z",
        timeline: [{ action: "Approved", actor: "Admin User", date: "Oct 2, 2026 08:20 AM" }],
      }],
    });

    const rows = parseCsv(csv);
    const [headers, data] = rows;
    expect(headers).toEqual(TEMPLATE_HEADERS);
    expect(data).toHaveLength(TEMPLATE_HEADERS.length);

    const cell = (header: string, occurrence = 0) => {
      let seen = 0;
      const index = headers.findIndex((value) => {
        if (value !== header) return false;
        if (seen === occurrence) return true;
        seen += 1;
        return false;
      });
      return data[index];
    };

    expect(cell("Report From")).toBe("01/10/2026");
    expect(cell("Report To")).toBe("31/10/2026");
    expect(cell("Master Order ID")).toBe(order.id);
    expect(cell("Created At")).toBe("01/10/2026 05:17 PM");
    expect(cell("SUB ORDER ID")).toBe("SO-ORD-000001-001");
    expect(cell("Approval Workflow")).toBe("Order approval");
    expect(cell("Delivery Attention")).toBe("Receiving Desk");
    expect(cell("City")).toBe("Mumbai");
    expect(cell("Delivery Notes")).toBe("Use the east gate");
    expect(cell("Checkout Note")).toBe("'=SUM(A1:A3)");
    expect(cell("Unit Price")).toBe("5900");
    expect(cell("Line Amount")).toBe("5900");
    expect(cell("Tracking Number")).toBe("TRACK-1");
    expect(cell("Tracking Carrier")).toBe("UPS");
    expect(cell("Tracking Note")).toBe("Shipped on Oct 1");
    expect(cell("Selected Vendor")).toBe("InfoTech Pvt. Ltd.");
    expect(cell("PO Created AT")).toBe("2026-10-01T17:20:00.000Z");
    expect(cell("Last Updated BY")).toBe("Admin");
    expect(cell("Last Updated At", 1)).toBe("Oct 1, 2026");
    expect(cell("Last Comment")).toBe("Please call before delivery.");
    expect(cell("Order Notes")).toBe("'=SUM(A1:A3)");
    expect(csv).not.toContain("Record Type");
    expect(csv).not.toContain("All Approval Requests");
    expect(csv).not.toContain("Order Documents");
    expect(csv).not.toContain("Update History");
    expect(csv).not.toContain("purchase-request.pdf");
    expect(csv).not.toContain("vendor-po.pdf");
    expect(csv).not.toContain("private-file-payload");
    expect(csv).not.toContain("private-document-password-hash");
    expect(csv).not.toContain("po-private-payload");
  });

  it("builds report rows from the saved master order and item records", () => {
    const approvalRequest: ApprovalRequest = {
      id: "APR-1",
      workflowId: "WF-1",
      workflow: "Order approval",
      workflowVersion: 1,
      module: "Order",
      trigger: "Order Placed",
      reference: order.id,
      requestedBy: "user-1",
      requestedByName: "Rajesh Kumar",
      currentApprover: "Admin User",
      currentLevel: 1,
      status: "Approved",
      amount: order.totalAmountNum,
      context: {},
      createdAt: "2026-10-01T17:17:00.000Z",
      timeline: [{
        action: "approve",
        user_name: "Admin User",
        created_at: "2026-10-02T08:30:00.000Z",
      }],
    };
    const rows = buildOrderReportRows([order], { approvalRequests: [approvalRequest] });
    expect(rows).toHaveLength(1);
    expect(rows[0].order.id).toBe(order.id);
    expect(rows[0].fields).toMatchObject({
      "Master Order ID": order.id,
      "SUB ORDER ID": "SO-ORD-000001-001",
      "Client": order.client,
      "Client ID": "CI-00019",
      "Item Name": "Samsung Galaxy",
      "SKU / Product Code": "MPC-2026-000001",
      "Order Total": 5900,
      "Delivery Attention": "Receiving Desk",
      "Checkout Note": "=SUM(A1:A3)",
      "Approval Status": "Approved",
      "Approval Workflow": "Order approval",
      "Approval Requested By": "Rajesh Kumar",
      "Approval Date": "2026-10-02T08:30:00.000Z",
      "Approved By": "Admin User",
    });
  });

  it("omits internal notes and vendor procurement details for client-portal exports", () => {
    localStorage.setItem("nido_notes_ORD-000001", JSON.stringify([
      { id: "internal", author: "Staff", date: "Oct 2, 2026", text: "Internal review", visibility: "Internal Note" },
      { id: "external", author: "Client", date: "Oct 2, 2026", text: "External update", visibility: "External Note" },
    ]));
    const csv = buildOrdersCsv([order], { hideInternal: true });
    const rows = parseCsv(csv);
    const headers = rows[0];
    const data = rows[1];
    const cell = (header: string) => data[headers.indexOf(header)];
    expect(cell("Order Notes")).toBe("'=SUM(A1:A3)");
    expect(cell("Last Comment")).toBe("External update");
    expect(cell("Last Comment")).not.toContain("Internal review");
    expect(csv).not.toContain("InfoTech Pvt. Ltd.");
  });

  it("exports Vendor Orders with the same workbook headers and PO line data", () => {
    localStorage.setItem("nido_my_orders", JSON.stringify([order]));
    const csv = buildVendorOrdersCsv([{
      poNumber: "VPO-0001",
      orderId: order.id,
      subOrderId: "SO-ORD-000001-001",
      subOrderIds: ["SO-ORD-000001-001"],
      items: [{
        subOrderId: "SO-ORD-000001-001",
        item: "Samsung Galaxy",
        sku: "MPC-2026-000001",
        productCode: "MPC-2026-000001",
        category: "Electronics",
        hsnCode: "8517",
        specs: ["128GB"],
        referenceNumber: "REF-1",
        qty: 1,
        unitPrice: 5000,
        lineSubtotal: 5000,
        status: "Processing",
        tracking: { number: "TRACK-1", carrier: "UPS", note: "On the way", link: "https://example.com/track" },
      }],
      vendorId: "VND-1001",
      vendorName: "InfoTech Pvt. Ltd.",
      vendorContact: "",
      vendorEmail: "",
      vendorPhone: "",
      vendorGstin: "",
      vendorAddress: "",
      vendorAddressLine1: "",
      vendorAddressLine2: "",
      vendorCity: "",
      vendorState: "",
      vendorPincode: "",
      item: "Samsung Galaxy",
      sku: "MPC-2026-000001",
      category: "Electronics",
      hsnCode: "8517",
      specs: ["128GB"],
      referenceNumber: "REF-1",
      qty: 1,
      unitPrice: 5000,
      subtotal: 5000,
      sgstPct: 0,
      cgstPct: 0,
      sgstAmt: 0,
      cgstAmt: 0,
      grandTotal: 5000,
      paymentTerms: "Net 30",
      status: "Confirmed",
      createdOn: "2026-10-01T17:20:00.000Z",
      createdOnDisplay: "01/10/2026",
      requestedDelivery: "Oct 10, 2026",
      documents: [],
      notes: [
        { id: "old-comment", author: "Admin", initials: "A", color: "#000", date: "Oct 1, 2026 08:00 AM", text: "Older note", visibility: "Internal Note" },
        { id: "new-comment", author: "Admin", initials: "A", color: "#000", date: "Oct 2, 2026 08:31 AM", text: "Newest vendor note", visibility: "Internal Note" },
      ],
    }], {
      reportFrom: "2026-10-01",
      reportTo: "2026-10-31",
    });

    const [headers, data] = parseCsv(csv);
    expect(headers).toEqual(TEMPLATE_HEADERS);
    expect(data).toHaveLength(TEMPLATE_HEADERS.length);

    const cell = (header: string) => data[headers.indexOf(header)];
    expect(cell("Master Order ID")).toBe(order.id);
    expect(cell("Report From")).toBe("01/10/2026");
    expect(cell("Report To")).toBe("31/10/2026");
    expect(cell("Created At")).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/);
    expect(cell("SUB ORDER ID")).toBe("SO-ORD-000001-001");
    expect(cell("Item Name")).toBe("Samsung Galaxy");
    expect(cell("Unit Price")).toBe("5000");
    expect(cell("Line Amount")).toBe("5000");
    expect(cell("Tracking Number")).toBe("TRACK-1");
    expect(cell("Selected Vendor")).toBe("InfoTech Pvt. Ltd.");
    expect(cell("Vendor PO Numbers")).toBe("VPO-0001");
    expect(cell("Order Notes")).toBe("'=SUM(A1:A3)");
    expect(cell("Last Comment")).toBe("Newest vendor note");
  });
});