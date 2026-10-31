import type { MyOrder, OrderCartItem } from "@/contexts/MyOrdersContext";
import type { ApprovalRequest } from "@/lib/approvalEngine";
import { getAllPOs, getPODisplayStatus, isPOConfirmed, type StoredPO } from "@/lib/purchaseOrderStore";

type ExportOptions = {
  approvalRequests?: ApprovalRequest[];
  hideInternal?: boolean;
  reportFrom?: string;
  reportTo?: string;
};

type CsvRow = Record<string, unknown>;
export type OrderReportRow = {
  order: MyOrder;
  itemIndex: number;
  fields: Record<string, unknown>;
};
type StoredNote = {
  id?: string;
  author?: string;
  date?: string;
  visibility?: string;
  text?: string;
  kind?: string;
};
type StoredDocument = {
  id?: string;
  name?: string;
  ext?: string;
  extension?: string;
  type?: string;
  size?: string;
  uploadedBy?: string;
  uploadedOn?: string;
  uploadedAt?: string;
  description?: string;
};
type LooseRecord = Record<string, unknown>;

const COLUMNS = [
  { header: "Report From", key: "Report From" },
  { header: "Report To", key: "Report To" },
  { header: "Master Order ID", key: "Master Order ID" },
  { header: "SUB ORDER ID", key: "Sub Order ID" },
  { header: "Client PO Reference", key: "Client PO Reference" },
  { header: "Client", key: "Client" },
  { header: "Client ID", key: "Client ID" },
  { header: "Created By", key: "Created By" },
  { header: "Created At", key: "Created At" },
  { header: "Requester", key: "Requester" },
  { header: "Requester Role", key: "Requester Role" },
  { header: "Ordered For", key: "Ordered For" },
  { header: "Assigned To", key: "Assigned To" },
  { header: "Assigned Role", key: "Assigned Role" },
  { header: "Order Date", key: "Order Date" },
  { header: "Order Time", key: "Order Time" },
  { header: "Current Order Status", key: "Current Order Status" },
  { header: "Approval Status", key: "Approval Status" },
  { header: "Approval Workflow", key: "Approval Workflow" },
  { header: "Approval Requested By", key: "Approval Requested By" },
  { header: "Approval Date", key: "Approval Date" },
  { header: "Approved By", key: "Approved By" },
  { header: "Updated By", key: "Updated By" },
  { header: "Last Updated At", key: "Last Updated At" },
  { header: "Update Count", key: "Update Count" },
  { header: "SLA Time", key: "SLA Time" },
  { header: "SLA Alert", key: "SLA Alert" },
  { header: "Order Total", key: "Order Total" },
  { header: "Payment Method", key: "Payment Method" },
  { header: "Payment Terms", key: "Payment Terms" },
  { header: "Delivery Attention", key: "Delivery Attention" },
  { header: "Delivery Address", key: "Delivery Address" },
  { header: "City", key: "City" },
  { header: "State", key: "State" },
  { header: "Country", key: "Country" },
  { header: "ZIP Code", key: "ZIP Code" },
  { header: "Delivery Phone", key: "Delivery Phone" },
  { header: "Delivery Notes", key: "Delivery Notes" },
  { header: "Checkout Note", key: "Checkout Note" },
  { header: "Order Notes", key: "Order Notes" },
  { header: "Cancel Reason", key: "Cancel Reason" },
  { header: "Item Name", key: "Item Name" },
  { header: "SKU / Product Code", key: "SKU / Product Code" },
  { header: "Category", key: "Category" },
  { header: "Quantity", key: "Quantity" },
  { header: "Unit Price", key: "Unit Price" },
  { header: "Line Amount", key: "Line Amount" },
  { header: "Item Status", key: "Item Status" },
  { header: "Item Status Updated At", key: "Item Status Updated At" },
  { header: "Reference Number", key: "Reference Number" },
  { header: "Serial Number", key: "Serial Number" },
  { header: "Tracking Number", key: "Tracking Number" },
  { header: "Tracking Carrier", key: "Tracking Carrier" },
  { header: "Tracking Note", key: "Tracking Note" },
  { header: "Selected Vendor", key: "Selected Vendor" },
  { header: "Vendor PO Numbers", key: "Vendor PO Numbers" },
  { header: "PO Created AT", key: "PO Created AT" },
  { header: "Vendor PO Statuses", key: "Vendor PO Statuses" },
  { header: "Last Updated BY", key: "Last Updated BY" },
  { header: "Last Updated At", key: "Vendor Last Updated At" },
  { header: "Last Comment", key: "Last Comment" },
];

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function jsonCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function safeDocument(document: unknown) {
  const doc = asRecord(document);
  if (!doc) return null;
  return {
    id: doc.id ?? "",
    name: doc.name ?? "",
    extension: doc.ext ?? doc.extension ?? "",
    type: doc.type ?? "",
    size: doc.size ?? "",
    uploadedBy: doc.uploadedBy ?? "",
    uploadedAt: doc.uploadedOn ?? doc.uploadedAt ?? "",
    description: doc.description ?? "",
  };
}

function visibleRecords<T extends { visibility?: string }>(records: T[], hideInternal: boolean): T[] {
  return hideInternal ? records.filter((record) => record.visibility !== "Internal Note") : records;
}

function getOrderNotes(orderId: string, hideInternal: boolean) {
  const notes = readLocalJson<StoredNote[]>(`nido_notes_${orderId}`, []);
  return visibleRecords(Array.isArray(notes) ? notes : [], hideInternal)
    .map((note) => ({
      author: note.author ?? "",
      date: note.date ?? "",
      visibility: note.visibility ?? "",
      text: note.text ?? "",
      kind: note.kind ?? "",
    }));
}

function getOrderActivity(orderId: string, hideInternal: boolean) {
  const notes = readLocalJson<StoredNote[]>(`nido_notes_${orderId}`, []);
  const isCreationEvent = (note: StoredNote) =>
    note.id === `activity_order_placed_${orderId}`
    || note.text === `Order ${orderId} was placed.`;
  const allActivity = (Array.isArray(notes) ? notes : [])
    .filter((note) => Boolean(note.kind) && !isCreationEvent(note));
  return visibleRecords(allActivity, hideInternal);
}

function parseDate(value: unknown): number {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getLatestComment(
  orderNotes: StoredNote[],
  purchaseOrders: StoredPO[],
  hideInternal: boolean,
): StoredNote | undefined {
  const candidates = [
    ...orderNotes,
    ...purchaseOrders.flatMap((po) => po.notes || []),
  ].filter((note) =>
    !note.kind
    && Boolean(note.text?.trim())
    && (!hideInternal || note.visibility !== "Internal Note"),
  );

  // Both detail pages prepend new notes, so stable ties retain the newest
  // entry when their displayed timestamps have only minute-level precision.
  return candidates.reduce<StoredNote | undefined>((latest, note) =>
    !latest || parseDate(note.date) > parseDate(latest.date) ? note : latest,
  undefined);
}

function formatCsvDate(value: string | undefined): string {
  if (!value) return "";
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatCsvDateTime(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return value;

  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(hour12).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${meridiem}`;
}

function getApprovalRecords(order: MyOrder, requests: ApprovalRequest[]) {
  return requests
    .filter((request) => request.module === "Order" && request.reference === order.id)
    .sort((a, b) => parseDate(a.createdAt) - parseDate(b.createdAt));
}

function summarizeApproval(approval: ApprovalRequest | undefined) {
  if (!approval) {
    return {
      status: "",
      workflow: "",
      id: "",
      requestedBy: "",
      currentApprover: "",
      dueAt: "",
      approvalDate: "",
      approvedBy: "",
      history: "",
    };
  }
  const timeline: unknown[] = Array.isArray(approval.timeline)
    ? approval.timeline
    : Array.isArray(approval.steps) ? approval.steps : [];
  const approvedEvent = [...timeline]
    .reverse()
    .map(asRecord)
    .find((entry) => entry && /approv/i.test(String(entry.action ?? entry.status ?? entry.event ?? "")));
  const actor = approvedEvent?.actor
    ?? approvedEvent?.actedBy
    ?? approvedEvent?.approver
    ?? approvedEvent?.userName
    ?? approvedEvent?.user_name
    ?? approvedEvent?.user
    ?? approvedEvent?.user_id
    ?? "";
  const approvedAt = approvedEvent?.date
    ?? approvedEvent?.actedAt
    ?? approvedEvent?.timestamp
    ?? approvedEvent?.createdAt
    ?? approvedEvent?.created_at
    ?? "";
  return {
    status: approval.status ?? "",
    workflow: approval.workflow ?? "",
    id: approval.id ?? "",
    requestedBy: approval.requestedByName || approval.requestedBy || "",
    currentApprover: approval.currentApprover ?? "",
    dueAt: approval.dueAt ?? "",
    approvalDate: approvedAt,
    approvedBy: actor,
    history: jsonCell(timeline),
  };
}

function poMatchesItem(po: StoredPO, subOrderId: string, item: OrderCartItem): boolean {
  if (po.subOrderId === subOrderId || po.subOrderIds?.includes(subOrderId)) return true;
  return (po.items || []).some((line) => {
    if (line.subOrderId === subOrderId) return true;
    const productCode = String(item.productCode || "").trim();
    const sku = String(item.productCode || "").trim();
    const itemName = String(item.name || "").trim().toLowerCase();
    return Boolean(
      (productCode && String(line.productCode || "").trim() === productCode)
      || (sku && String(line.sku || "").trim() === sku)
      || (itemName && String(line.item || "").trim().toLowerCase() === itemName),
    );
  });
}

function safePo(po: StoredPO, subOrderId: string, hideInternal: boolean) {
  const lines = (po.items || []).filter((line) => line.subOrderId === subOrderId);
  const fallbackIndex = po.subOrderIds?.indexOf(subOrderId) ?? -1;
  const matchedLines = lines.length
    ? lines
    : fallbackIndex >= 0 && po.items?.[fallbackIndex]
      ? [po.items[fallbackIndex]]
      : po.items || [];
  return {
    poNumber: po.poNumber,
    status: po.status,
    createdAt: po.createdOn,
    createdDate: po.createdOnDisplay,
    requestedDelivery: po.requestedDelivery,
    vendor: {
      name: po.vendorName,
      id: po.vendorId,
      contact: po.vendorContact,
      email: po.vendorEmail,
      phone: po.vendorPhone,
      gstin: po.vendorGstin,
      address: po.vendorAddress,
    },
    paymentTerms: po.paymentTerms,
    subtotal: po.subtotal,
    sgst: po.sgstAmt,
    cgst: po.cgstAmt,
    total: po.grandTotal,
    cancelReason: po.cancelReason ?? "",
    items: matchedLines.map((line) => ({
      subOrderId: line.subOrderId,
      item: line.item,
      sku: line.sku,
      category: line.category,
      hsnCode: line.hsnCode,
      specs: line.specs,
      referenceNumber: line.referenceNumber,
      serialNumber: line.serialNumber,
      quantity: line.qty,
      unitPrice: line.unitPrice,
      subtotal: line.lineSubtotal,
      taxPercent: line.gstPct,
      status: line.status,
      cancelReason: line.cancelReason,
      tracking: line.tracking,
    })),
    documents: (po.documents || []).map(safeDocument).filter(Boolean),
    notes: visibleRecords(po.notes || [], hideInternal).map((note) => ({
      author: note.author,
      date: note.date,
      visibility: note.visibility,
      text: note.text,
      kind: note.kind ?? "",
    })),
  };
}

function toSubOrderId(order: MyOrder, item: OrderCartItem, index: number): string {
  return item.subOrderId || `SO-${order.id}-${String(index + 1).padStart(3, "0")}`;
}

function createRow(
  order: MyOrder,
  item: OrderCartItem | undefined,
  itemIndex: number,
  pos: StoredPO[],
  requests: ApprovalRequest[],
  hideInternal: boolean,
): CsvRow {
  const subOrderId = item ? toSubOrderId(order, item, itemIndex) : "";
  const relatedPos = item ? pos.filter((po) => po.orderId === order.id && poMatchesItem(po, subOrderId, item)) : [];
  const activity = getOrderActivity(order.id, hideInternal);
  const notes = getOrderNotes(order.id, hideInternal);
  const storedNotes = readLocalJson<StoredNote[]>(`nido_notes_${order.id}`, []);
  const creationEvent = (Array.isArray(storedNotes) ? storedNotes : [])
    .find((note) => note?.id === `activity_order_placed_${order.id}` || note?.text === `Order ${order.id} was placed.`);
  const latestEvent = [...activity].sort((a, b) => parseDate(b.date) - parseDate(a.date))[0];
  const orderUpdatedAt = order.updatedAt || "";
  const useStoredUpdate = parseDate(orderUpdatedAt) > parseDate(latestEvent?.date);
  const updatedCount = hideInternal
    ? activity.length
    : Math.max(activity.length, Number(order.updateCount) || 0);
  const createdAt = order.createdAt || creationEvent?.date || `${order.orderDate || ""} ${order.orderTime || ""}`.trim();
  const creator = order.createdBy || creationEvent?.author || order.requester || "";
  const approvalRecords = getApprovalRecords(order, requests);
  const approval = summarizeApproval(approvalRecords[approvalRecords.length - 1]);
  const storedSubItems = asRecord(readLocalJson<unknown>(`nido_subitems_${order.id}`, {})) || {};
  const subItemState = item ? asRecord(storedSubItems[subOrderId]) || {} : {};
  const poLines = relatedPos.flatMap((po) => {
    const direct = (po.items || []).filter((line) => line.subOrderId === subOrderId);
    if (direct.length) return direct;
    const idx = po.subOrderIds?.indexOf(subOrderId) ?? -1;
    return idx >= 0 && po.items?.[idx] ? [po.items[idx]] : [];
  });
  const itemStatus = subItemState.itemStatus
    || poLines.find((line) => line.status)?.status
    || (relatedPos.some((po) => isPOConfirmed(po)) ? "Processing" : "")
    || (order.status === "Cancelled" || order.status === "Draft" ? order.status : "Pending");
  const unitPrice = Number(item?.landedCost || item?.priceNum) || 0;
  const quantity = Number(item?.quantity) || 0;
  const storedDocuments = readLocalJson<StoredDocument[]>(`nido_docs_${order.id}`, []);
  const safeDocuments = (Array.isArray(storedDocuments) ? storedDocuments : []).map(safeDocument).filter(Boolean);
  const allVisibleActivity = activity.map((event) => ({
    actor: event.author ?? "",
    date: event.date ?? "",
    type: event.kind ?? "",
    visibility: event.visibility ?? "",
    change: event.text ?? "",
  }));
  const latestComment = getLatestComment(notes, relatedPos, hideInternal);
  const itemProcessingDetails = item ? {
    ...subItemState,
    tracking: subItemState.tracking || poLines.map((line) => line.tracking).filter(Boolean),
    selectedVendorId: item.selectedVendorId || "",
    stockAllocations: item.vendorAllocations || [],
  } : null;
  const itemTracking = asRecord(subItemState.tracking);
  const orderTracking = subItemState.trackingOwner === "order-details" ? itemTracking : null;
  const poTracking = poLines
    .map((line) => asRecord(line.tracking))
    .find((tracking) => tracking !== null) || null;
  const tracking = hideInternal
    ? orderTracking
    : orderTracking || itemTracking || poTracking;
  const latestPoUpdate = relatedPos
    .flatMap((po) => visibleRecords(po.notes || [], hideInternal))
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))[0];
  const delivery = order.deliveryDetails;
  const cancelReason = order.cancelReason
    || subItemState.cancelReason
    || poLines.find((line) => line.cancelReason)?.cancelReason
    || relatedPos.find((po) => po.cancelReason)?.cancelReason
    || "";

  return {
    "Record Type": item ? "Order Item" : "Order",
    "Master Order ID": order.id,
    "Client PO Reference": order.poNumber,
    "Client": order.client,
    "Client ID": order.clientId ?? item?.clientId ?? "",
    "Created By": hideInternal ? order.requester : creator,
    "Created At": createdAt,
    "Requester": order.requester,
    "Requester Role": order.requesterRole,
    "Ordered For": order.orderedFor ?? "",
    "Assigned To": order.assigned,
    "Assigned Role": order.assignedRole,
    "Order Date": order.orderDate,
    "Order Time": order.orderTime,
    "Current Order Status": order.status,
    "Approval Status": approval.status,
    "Approval Workflow": approval.workflow,
    "Approval Request ID": approval.id,
    "Approval Requested By": approval.requestedBy,
    "Current Approver": hideInternal ? "" : approval.currentApprover,
    "Approval Due At": approval.dueAt,
    "Approval Date": approval.approvalDate,
    "Approved By": hideInternal ? "" : approval.approvedBy,
    "Approval History": hideInternal ? "" : approval.history,
    "Updated By": hideInternal ? "" : useStoredUpdate ? order.updatedBy ?? "" : latestEvent?.author ?? "",
    "Last Updated At": hideInternal ? "" : useStoredUpdate ? orderUpdatedAt : latestEvent?.date ?? "",
    "Update Count": updatedCount,
    "Update History": jsonCell(allVisibleActivity),
    "SLA Time": order.slaTime ?? "",
    "SLA Alert": order.slaAlert,
    "Order Total": order.totalAmountNum ?? order.totalAmount,
    "Payment Method": order.paymentMethod ?? "",
    "Payment Terms": order.paymentTerms ?? "",
    "Delivery Address": order.deliveryAddress ?? "",
    "Report From": "",
    "Report To": "",
    "SUB ORDER ID": subOrderId,
    "Delivery Attention": delivery?.attentionName ?? "",
    City: delivery?.city ?? "",
    State: delivery?.state ?? "",
    Country: delivery?.country ?? "",
    "ZIP Code": delivery?.zip ?? "",
    "Delivery Phone": delivery?.phone ?? "",
    "Delivery Notes": delivery?.instructions ?? "",
    "Delivery Details": jsonCell(order.deliveryDetails),
    "Checkout Note": order.orderNotes ?? "",
    "Order Notes": order.orderNotes ?? "",
    "Cancel Reason": cancelReason,
    "Sub Order ID": subOrderId,
    "Item Name": item?.name ?? "",
    "Product ID": item?.id ?? "",
    "SKU / Product Code": item?.productCode ?? "",
    "Category": item?.category ?? "",
    "Product Type": item?.productType ?? item?.physicalType ?? "",
    "Fulfillment Type": item?.fulfillmentType ?? "",
    "Specifications": jsonCell(item?.specs ?? []),
    "Configuration": jsonCell(item?.configuration ?? {}),
    "Quantity": item?.quantity ?? "",
    "Unit Price": item ? unitPrice : "",
    "Line Amount": item ? unitPrice * quantity : "",
    "Item Status": itemStatus,
    "Item Status Updated At": subItemState.updatedOn ?? "",
    "Reference Number": subItemState.referenceNumber ?? poLines.find((line) => line.referenceNumber)?.referenceNumber ?? "",
    "Serial Number": subItemState.serialNumber ?? poLines.find((line) => line.serialNumber)?.serialNumber ?? "",
    "Tracking Details": jsonCell(itemProcessingDetails?.tracking ?? {}),
    "Tracking Number": tracking?.trackingNumber ?? tracking?.number ?? "",
    "Tracking Carrier": tracking?.carrier ?? "",
    "Tracking Note": tracking?.note ?? "",
    "Item Processing Details": jsonCell(itemProcessingDetails),
    "Selected Vendor": hideInternal ? "" : item?.selectedVendorName ?? relatedPos.map((po) => po.vendorName).filter(Boolean).join("; "),
    "Vendor PO Numbers": hideInternal ? "" : relatedPos.map((po) => po.poNumber).join("; "),
    "Vendor PO Statuses": hideInternal ? "" : relatedPos.map((po) => `${po.poNumber}: ${po.status}`).join("; "),
    "Vendor PO Created At": hideInternal ? "" : relatedPos.map((po) => `${po.poNumber}: ${po.createdOn}`).join("; "),
    "PO Created AT": hideInternal ? "" : relatedPos.map((po) => po.createdOn).join("; "),
    "Vendor PO Details": hideInternal ? "" : jsonCell(relatedPos.map((po) => safePo(po, subOrderId, hideInternal))),
    "Order Documents": jsonCell(safeDocuments),
    "Vendor PO Documents": hideInternal ? "" : jsonCell(relatedPos.flatMap((po) => (po.documents || []).flatMap((doc) => {
      const metadata = safeDocument(doc);
      return metadata ? [{ poNumber: po.poNumber, ...metadata }] : [];
    }))),
    "Vendor PO Notes": hideInternal ? "" : jsonCell(relatedPos.flatMap((po) =>
      visibleRecords(po.notes || [], hideInternal).map((note) => ({
        poNumber: po.poNumber,
        author: note.author,
        date: note.date,
        visibility: note.visibility,
        text: note.text,
        kind: note.kind ?? "",
      })),
    )),
    "Last Updated BY": hideInternal ? "" : latestPoUpdate?.author ?? "",
    "Vendor Last Updated At": hideInternal ? "" : latestPoUpdate?.date ?? "",
    "Last Comment": latestComment?.text ?? (hideInternal ? "" : latestPoUpdate?.text ?? ""),
    __approvalRecords: hideInternal ? "" : jsonCell(approvalRecords.map((record) => ({
      id: record.id,
      workflow: record.workflow,
      status: record.status,
      requestedBy: record.requestedByName || record.requestedBy,
      currentApprover: record.currentApprover,
      createdAt: record.createdAt,
      dueAt: record.dueAt,
      timeline: record.timeline || record.steps || [],
    }))),
  };
}

/**
 * Build the live report rows for master orders using the same order, approval,
 * fulfillment, activity, and vendor-PO data as the Orders export.
 */
export function buildOrderReportRows(
  orders: MyOrder[],
  { approvalRequests = [], hideInternal = false }: ExportOptions = {},
): OrderReportRow[] {
  const allPos = getAllPOs();
  return orders.flatMap((order) => {
    const items = order.cartItems || [];
    return items.length
      ? items.map((item, itemIndex) => ({
          order,
          itemIndex,
          fields: createRow(order, item, itemIndex, allPos, approvalRequests, hideInternal),
        }))
      : [{
          order,
          itemIndex: -1,
          fields: createRow(order, undefined, -1, allPos, approvalRequests, hideInternal),
        }];
  });
}

function serializeCsv(rows: CsvRow[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    const protectedText = typeof value === "string" && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${protectedText.replace(/"/g, '""')}"`;
  };
  const csvRows = [
    COLUMNS.map(({ header }) => header),
    ...rows.map((row) => COLUMNS.map(({ key }) =>
      key === "Created At" ? formatCsvDateTime(row[key]) : row[key],
    )),
  ];
  return `\uFEFF${csvRows.map((row) => row.map(escape).join(",")).join("\r\n")}`;
}

function fallbackOrderForPO(po: StoredPO): MyOrder {
  const status: MyOrder["status"] = (() => {
    switch (po.status) {
      case "Draft": return "Draft";
      case "Cancelled": return "Cancelled";
      case "Delivered":
      case "Completed": return "Delivered";
      case "Partially Shipped": return "Partially Shipped";
      case "Dispatched": return "Shipped";
      default: return "Processing";
    }
  })();
  return {
    id: po.orderId || po.poNumber,
    client: "",
    clientColor: "",
    clientInitial: "",
    poNumber: "",
    requester: "",
    requesterRole: "",
    requesterInitial: "",
    requesterColor: "",
    assigned: "",
    assignedRole: "",
    assignedInitial: "",
    assignedColor: "",
    orderDate: po.createdOnDisplay || "",
    orderTime: "",
    status,
    slaTime: "",
    slaAlert: false,
    totalAmount: String(po.grandTotal ?? ""),
    totalAmountNum: Number(po.grandTotal) || 0,
    createdAt: po.createdOn || "",
    paymentTerms: po.paymentTerms || "",
  };
}

function orderItemForPOLine(
  po: StoredPO,
  line: NonNullable<StoredPO["items"]>[number],
  order: MyOrder,
  lineIndex: number,
): OrderCartItem {
  const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const orderItem = order.cartItems?.find((item) =>
    (line.subOrderId && item.subOrderId === line.subOrderId)
    || (line.productCode && normalized(item.productCode) === normalized(line.productCode))
    || (line.sku && normalized(item.productCode) === normalized(line.sku))
    || (line.item && normalized(item.name) === normalized(line.item)),
  );
  const unitPrice = Number(line.unitPrice) || 0;
  return {
    ...(orderItem || {
      id: lineIndex + 1,
      image: "",
      moq: 1,
      specs: [],
    }),
    id: orderItem?.id ?? lineIndex + 1,
    name: line.item || orderItem?.name || po.item || "",
    image: orderItem?.image || "",
    priceNum: unitPrice,
    quantity: Number(line.qty) || 0,
    category: line.category || orderItem?.category || po.category || "",
    specs: Array.isArray(line.specs) ? line.specs : orderItem?.specs || [],
    moq: orderItem?.moq || 1,
    clientId: orderItem?.clientId || order.clientId || "",
    productCode: line.productCode || line.sku || orderItem?.productCode || po.sku || "",
    productType: line.productType || orderItem?.productType,
    physicalType: orderItem?.physicalType,
    fulfillmentType: orderItem?.fulfillmentType,
    selectedVendorId: po.vendorId,
    selectedVendorName: po.vendorName,
    vendorPrice: unitPrice,
    landedCost: unitPrice,
    clientSellingPriceExclGst: orderItem?.clientSellingPriceExclGst,
    gstSnapshot: orderItem?.gstSnapshot,
    hsnSnapshot: line.hsnCode || orderItem?.hsnSnapshot,
    vendorAllocations: orderItem?.vendorAllocations,
    subOrderId: line.subOrderId || po.subOrderId || orderItem?.subOrderId,
    configuration: orderItem?.configuration,
    configurationPriceAdjustment: orderItem?.configurationPriceAdjustment,
    stockReservationId: orderItem?.stockReservationId,
  };
}

export function buildVendorOrdersCsv(
  purchaseOrders: StoredPO[],
  {
    hideInternal = false,
    reportFrom,
    reportTo,
  }: Pick<ExportOptions, "hideInternal" | "reportFrom" | "reportTo"> = {},
): string {
  const formattedReportFrom = formatCsvDate(reportFrom);
  const formattedReportTo = formatCsvDate(reportTo);
  const savedOrders = readLocalJson<unknown>("nido_my_orders", []);
  const orderById = new Map(
    (Array.isArray(savedOrders) ? savedOrders as MyOrder[] : []).map((order) => [order.id, order]),
  );
  const rows: CsvRow[] = [];

  for (const po of purchaseOrders) {
    const order = orderById.get(po.orderId) || fallbackOrderForPO(po);
    const sourceLines = Array.isArray(po.items) && po.items.length > 0
      ? po.items
      : [{
          subOrderId: po.subOrderId || po.subOrderIds?.[0] || "",
          item: po.item || "",
          sku: po.sku || "",
          productCode: po.sku || "",
          category: po.category || "",
          hsnCode: po.hsnCode || "",
          specs: Array.isArray(po.specs) ? po.specs : [],
          referenceNumber: po.referenceNumber || "",
          serialNumber: po.serialNumber,
          qty: Number(po.qty) || 0,
          unitPrice: Number(po.unitPrice) || 0,
          lineSubtotal: Number(po.subtotal) || 0,
          status: getPODisplayStatus(po.status),
          tracking: null,
        }];
    const poLines = sourceLines.map((line, index) => ({
      ...line,
      subOrderId: line.subOrderId
        || po.subOrderIds?.[index]
        || (index === 0 ? po.subOrderId : `SO-${po.orderId}-${String(index + 1).padStart(3, "0")}`),
    }));

    poLines.forEach((line, index) => {
      const item = orderItemForPOLine(po, line, order, index);
      const rowPO: StoredPO = {
        ...po,
        subOrderId: line.subOrderId,
        subOrderIds: line.subOrderId ? [line.subOrderId] : [],
        items: [line],
      };
      const row = createRow(order, item, index, [rowPO], [], false);
      row["Report From"] = formattedReportFrom;
      row["Report To"] = formattedReportTo;

      if (hideInternal) {
        const visibleActivity = getOrderActivity(order.id, true);
        const visiblePONotes = visibleRecords(po.notes || [], true)
          .sort((a, b) => parseDate(b.date) - parseDate(a.date));
        row["Created By"] = order.requester || "";
        row["Approval Status"] = "";
        row["Approval Workflow"] = "";
        row["Approval Requested By"] = "";
        row["Approval Date"] = "";
        row["Approved By"] = "";
        row["Updated By"] = "";
        row["Last Updated At"] = "";
        row["Update Count"] = visibleActivity.length;
        row["Order Notes"] = order.orderNotes ?? "";
        row["Last Updated BY"] = visiblePONotes[0]?.author ?? "";
        row["Vendor Last Updated At"] = visiblePONotes[0]?.date ?? "";
        row["Last Comment"] = getLatestComment(getOrderNotes(order.id, true), [po], true)?.text
          ?? visiblePONotes[0]?.text
          ?? "";
      }
      rows.push(row);
    });
  }

  return serializeCsv(rows);
}

export function buildOrdersCsv(
  orders: MyOrder[],
  options: ExportOptions = {},
): string {
  const reportFrom = formatCsvDate(options.reportFrom);
  const reportTo = formatCsvDate(options.reportTo);
  return serializeCsv(buildOrderReportRows(orders, options).map(({ fields }) => ({
    ...fields,
    "Report From": reportFrom,
    "Report To": reportTo,
  })));
}