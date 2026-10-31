import type { ReportColumnGroup, ReportEntityType } from "@/components/reports/report-center/ReportsCenterUI";
import { getClients } from "@/lib/clientStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getClientCatalog } from "@/lib/clientCatalogStore";
import {
  getClientActivities,
  getClientContract,
  getClientDocuments,
  getClientOrders,
  getClientServices,
} from "@/lib/clientDataStore";
import { getReportRecords, getReportFieldValue, type ReportRecord } from "@/lib/reportData";
import { buildOrderReportRows } from "@/lib/orderCsvExport";
import type { MyOrder } from "@/contexts/MyOrdersContext";
import { getInvoices } from "@/lib/invoiceStore";
import { getOrders } from "@/lib/salesOrderStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getRoles, getUsers } from "@/lib/nidoUsersStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getAllVendorProducts } from "@/lib/vendorStore";
import { getQuotes } from "@/lib/quoteStore";
import { getReceipts } from "@/lib/paymentReceiptStore";
import { getAllThresholds, getStockHistory } from "@/lib/stockHistoryStore";
import {
  getApprovalSLA,
  getBusinessCalendar,
  getClientSLA,
  getEscalationRules,
  getProcurementSLA,
  getServiceSLA,
  getSLAAuditLog,
  getVendorSLA,
} from "@/lib/slaEngine";
import { getTaxAuditLog } from "@/lib/taxEngine";
import { getImpersonationAudit } from "@/lib/impersonationStore";
import { getBuiltinReportViews, getCustomReports } from "@/lib/reportStore";
import { loadApprovalBootstrap } from "@/lib/approvalEngine";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getPortalRoles, getPortalUsers } from "@/lib/portalUserStore";
import { getAllRolePermissions } from "@/lib/permissionsStore";
import { getUserDocuments } from "@/lib/nidoUserDocumentsStore";
import { getUserNotes } from "@/lib/nidoUserNotesStore";
import { getAutoAssignmentSettings } from "@/lib/autoAssignmentStore";
import {
  getAllClientPricing,
  getAllProductPricing,
  getClientCartPricingSettings,
  getClientCommonSettings,
  getClientPriceSlabs,
  getClientProductProfitRules,
  getClientProfitSettings,
  getGlobalCategoryRules,
  getVendorCommonSettings,
} from "@/lib/priceEngineStore";
import { getAllRecurring } from "@/lib/recurringInvoiceStore";
import { getOrderStatusConfig } from "@/lib/orderStatusStore";
import { getConfig } from "@/lib/configService";
import { getReportCenterHistory, getReportCenterSchedules } from "@/lib/reportCenterStore";
import { REPORT_WORKBOOK_COLUMNS, REPORT_WORKBOOK_MODULE_ORDER } from "@/lib/reportWorkbookColumns.generated";

const LIVE_MODULES_BY_TYPE: Record<ReportEntityType, Set<string>> = {
  client: new Set([
    "Client Orders", "Client Order Items", "Client Master and Onboarding", "Client Contracts",
    "Client Users and External Stakeholders", "Client Roles and Permissions", "Client Addresses",
    "Client Activity", "Client Documents", "Client Catalog", "Sales Quotes", "Sales Quote Items",
    "Sales Orders", "Sales Order Items", "Invoices and Proforma Invoices", "Invoice Items",
    "Invoice Payments and Activity", "Recurring Invoices", "Payment Receipts", "Receipt Allocations",
    "Credit Notes", "Credit Note Items", "Renewals", "Services Request Register", "AMC Requests",
    "Repair Requests", "Rental Requests", "Recycle and Disposal Requests", "Regular Purchase Requests",
    "Support Parent Tickets", "Support Child Tickets", "Ticket Conversations and Attachments",
    "Dashboard and Client Activity Summary",
  ]),
  vendor: new Set([
    "Vendor Orders", "Vendor Order Items", "Vendor PO Notes", "Vendor PO Documents", "Purchase Orders",
    "Purchase Order Items", "Bills", "Bill Items", "Payments Made", "Payment Made Allocations",
    "Vendor Credits", "Vendor Credit Items", "Vendor Master and Onboarding", "Vendor Categories",
    "Vendor Payments Overview", "Vendor Catalog", "Vendor SLA Policies",
    "Procurement SLA Stages", "Vendor Performance",
  ]),
  internal: new Set([
    "Nido Users", "Nido Roles", "Role Permissions", "Departments and Hierarchy",
    "User Login History", "User Notes", "User Documents", "Automatic Assignment Rules", "Master Catalog",
    "Product Specifications", "Product Variants", "Vendor Catalog", "Client Catalog", "Product Commercial Terms",
    "Price Engine and Vendor Comparison", "Client Pricing and Margins", "Pricing Slabs and Rules",
    "Vendor Pricing Charges", "Inventory Balances", "Stock Movements",
    "Returns and Cancellations", "Renewals", "Services Request Register", "AMC Requests", "Repair Requests",
    "Rental Requests", "Recycle and Disposal Requests", "Regular Purchase Requests", "AMC Visit Schedule",
    "Regular Purchase Items", "Service Appointments and Assignments", "Support Parent Tickets",
    "Support Child Tickets", "Ticket Conversations and Attachments", "Approval Workflows",
    "Approval Workflow Conditions", "Approval Workflow Levels", "Approval Requests",
    "Approval Decisions and History", "Vendor SLA Policies", "Client SLA Tiers", "Procurement SLA Stages",
    "Service SLA Policies", "Approval SLA Policies", "SLA Escalation Rules", "SLA Business Calendar",
    "SLA Audit History", "SLA Outcomes and Breaches", "Client and Vendor Spend", "Sales Revenue and Profit",
    "AR and AP Ageing", "Vendor Performance",
    "Organization and General Settings", "Order Status Configuration", "Tax Audit",
    "Tax Transaction Reconciliation", "Audit and Impersonation", "Report Definitions", "Scheduled Reports",
    "Report Download and Email History", "Product Categories Brands and Tags", "Expenses",
  ]),
};

export const REPORT_CENTER_MODULES: Record<ReportEntityType, string[]> = {
  client: REPORT_WORKBOOK_MODULE_ORDER.filter((module) => LIVE_MODULES_BY_TYPE.client.has(module)),
  vendor: REPORT_WORKBOOK_MODULE_ORDER.filter((module) => LIVE_MODULES_BY_TYPE.vendor.has(module)),
  internal: REPORT_WORKBOOK_MODULE_ORDER.filter((module) => LIVE_MODULES_BY_TYPE.internal.has(module)),
};

const group = (label: string, ...columns: string[]): ReportColumnGroup => ({ label, columns });

const LEGACY_REPORT_CENTER_COLUMNS: Record<string, ReportColumnGroup[]> = {
  "Products / Catalog": [group("PRODUCTS", "Vendor Name", "Product Name", "SKU", "Product Code", "Category", "Brand", "Unit Price", "Stock", "Reserved Stock", "Incoming Stock", "MOQ", "Lead Time", "Status", "Created date")],
  "Vendor Orders": [group("VENDOR ORDERS", "Vendor Name", "Order ID", "Order Date", "Order Status", "Amount", "PO Reference")],
  "Purchase Orders": [group("PURCHASE ORDERS", "Vendor Name", "PO Number", "Created On", "Status", "Amount", "Delivery Date")],
  RFQs: [group("RFQS", "RFQ Number", "Vendor Name", "Created On", "Status", "Amount")],
  "Client Orders": [group("CLIENT ORDERS", "Client Name", "Order ID", "Order Date", "Order Status", "Amount")],
  Catalog: [group("CATALOG", "Item Name", "SKU", "Category", "Price", "Stock", "Status")],
  Services: [group("SERVICES", "Service Name", "Request Date", "Client Name", "Status", "Assigned To")],
  "Invoices / Bills": [group("INVOICES AND BILLS", "Document Type", "Invoice / Bill Number", "Client Name", "Vendor Name", "Date", "Due Date", "Status", "Amount")],
  Payments: [group("PAYMENTS", "Payment Type", "Payment Number", "Client Name", "Vendor Name", "Payment Date", "Status", "Amount", "Method")],
  "Vendor Credits": [group("VENDOR CREDITS", "Credit Number", "Vendor Name", "Credit Date", "Status", "Amount", "Associated Bill")],
  SLA: [group("SLA", "Vendor Name", "Client Name", "Event", "Status", "Created On", "Description")],
  Users: [group("USERS", "Name", "Email", "Department", "Role", "Status", "Created date")],
  Departments: [group("DEPARTMENTS", "Department", "User Count", "Status")],
  Orders: [group("ORDERS", "Client Name", "Order ID", "Order Date", "Order Status", "Amount")],
  Approvals: [group("APPROVALS", "Record Type", "Name", "Module", "Status", "Created On", "Requested By")],
  Finance: [group("FINANCE", "Document Type", "Document Number", "Client Name", "Vendor Name", "Date", "Status", "Amount")],
  "Audit Trail": [group("AUDIT", "Event", "User", "Module", "Action", "Timestamp", "Status")],
  Inventory: [group("INVENTORY", "Product Name", "SKU", "Vendor Name", "Action", "Quantity", "Timestamp", "Reference")],
  Support: [group("SUPPORT", "Ticket ID", "Subject", "Client Name", "Priority", "Status", "Assigned To", "Created On")],
  Tax: [group("TAX", "Event", "Category", "Tax Type", "Rate", "Created On", "User")],
  "Sales Reports": [group("SALES", "Document Type", "Client Name", "Document Number", "Date", "Status", "Amount")],
  "Procurement Reports": [group("PROCUREMENT", "Vendor Name", "Document Type", "Document Number", "Date", "Status", "Amount")],
  "Vendor Performance": [group("VENDOR PERFORMANCE", "Vendor Name", "Category", "Status", "Rating", "PO Count", "Spend")],
  "Client Reports": [group("CLIENT REPORTS", "Client Name", "Document Type", "Document Number", "Date", "Status", "Amount")],
  "Internal Stakeholders": [group("INTERNAL STAKEHOLDERS", "Name", "Email", "Department", "Role", "Status")],
  "External Stakeholders": [group("EXTERNAL STAKEHOLDERS", "Name", "Entity Type", "Email", "Status", "Created date")],
  "Custom Reports": [group("SAVED REPORTS", "Name", "Report Type", "Module", "Frequency", "Last Run Status", "Created date")],
};

const CLIENT_ORDER_SUPPORTED_COLUMNS = new Set([
  "Report Date From", "Report Date To", "Report Date Basis", "Report Generated At", "Report Timezone",
  "ID", "Created By", "Requester ID", "Requester Email", "Created At", "Updated By", "Updated At",
  "Update Count", "Client ID", "Client", "PO Number", "Requester", "Ordered For", "Defer Purchase Orders",
  "Requester Role", "Assigned", "Assigned Role", "Order Date", "Order Time", "Status", "SLA Time",
  "SLA Alert", "Total Amount", "Cart Items", "Total Amount Num", "Payment Method", "Payment Detail",
  "Payment Terms", "Order Notes", "Delivery Address", "Delivery Details / Label",
  "Delivery Details / Attention Name", "Delivery Details / Line1", "Delivery Details / Line2",
  "Delivery Details / City", "Delivery Details / State", "Delivery Details / Country",
  "Delivery Details / Zip", "Delivery Details / Phone", "Delivery Details / Instructions", "Cancel Reason",
  "Approved By", "Approved Date", "Approval Status", "Ordered Item Count", "Total Quantity", "Last Comment",
]);

const RAW_REPORT_CENTER_COLUMNS: Record<string, ReportColumnGroup[]> = {
  ...LEGACY_REPORT_CENTER_COLUMNS,
  ...Object.fromEntries(
    [...new Set(Object.values(REPORT_CENTER_MODULES).flat())].map((module) => [
      module,
      [group(
        "WORKBOOK COLUMN ORDER",
        ...(REPORT_WORKBOOK_COLUMNS[module] ?? []).filter((column) =>
          module !== "Client Orders" || CLIENT_ORDER_SUPPORTED_COLUMNS.has(column),
        ),
      )],
    ]),
  ),
};

export function uniqueReportCenterColumns(columns: string[]): string[] {
  const seen = new Set<string>();
  return columns.filter((column) => {
    const identity = normalize(column);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export const REPORT_CENTER_COLUMNS: Record<string, ReportColumnGroup[]> = Object.fromEntries(
  Object.entries(RAW_REPORT_CENTER_COLUMNS).map(([module, groups]) => {
    const seen = new Set<string>();
    const uniqueGroups = groups
      .map((columnGroup) => ({
        ...columnGroup,
        columns: columnGroup.columns.filter((column) => {
          const identity = normalize(column);
          if (!identity || seen.has(identity)) return false;
          seen.add(identity);
          return true;
        }),
      }))
      .filter((columnGroup) => columnGroup.columns.length > 0);
    return [module, uniqueGroups];
  }),
);

export function orderReportCenterColumns(module: string, selectedColumns: string[]): string[] {
  const selected = new Set(selectedColumns.map(normalize));
  const canonical = REPORT_CENTER_COLUMNS[module]?.flatMap((columnGroup) => columnGroup.columns) ?? [];
  const ordered = canonical.filter((column) => selected.has(normalize(column)));
  const canonicalSet = new Set(canonical.map(normalize));
  if (module === "Client Orders") return ordered;
  return uniqueReportCenterColumns([
    ...ordered,
    ...selectedColumns.filter((column) => !canonicalSet.has(normalize(column))),
  ]);
}

export function getReportCenterDefaultColumns(module: string, count = 6): string[] {
  return (REPORT_CENTER_COLUMNS[module]?.flatMap((columnGroup) => columnGroup.columns) ?? []).slice(0, count);
}

export function withReportRunMetadata(
  records: ReportRecord[],
  draft: Pick<{
    dateFrom: string;
    dateTo: string;
    dateBasis: string;
  }, "dateFrom" | "dateTo" | "dateBasis">,
  generatedAt = new Date(),
): ReportRecord[] {
  const timezone = getConfig().localization.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const metadata: ReportRecord = {
    reportDateFrom: draft.dateFrom,
    reportDateTo: draft.dateTo,
    reportDateBasis: draft.dateBasis,
    reportGeneratedAt: generatedAt.toISOString(),
    reportTimezone: timezone,
  };
  return records.map((record) => ({ ...record, ...metadata }));
}

const toRecords = <T extends object>(items: T[]): ReportRecord[] =>
  items.map((item) => ({ ...item }) as ReportRecord);

function readLocalArray(key: string): ReportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is ReportRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];
  } catch {
    return [];
  }
}

function readLocalObject(key: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readMatchingField(record: ReportRecord, ...names: string[]): unknown {
  for (const name of names) {
    const key = Object.keys(record).find((candidate) => normalize(candidate) === normalize(name));
    const value = key ? record[key] : undefined;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numberFrom(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
    const cleaned = Number(String(value).replace(/,/g, "").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(cleaned)) return cleaned;
  }
  return undefined;
}

function mapVendorProducts(): ReportRecord[] {
  const vendorsById = new Map(getVendors().map((vendor) => [String(vendor.id), vendor.name]));
  return Object.entries(getAllVendorProducts()).flatMap(([vendorId, products]) =>
    products.map((product) => ({
      ...(product as unknown as ReportRecord),
      vendorId,
      vendorName: vendorsById.get(vendorId) ?? "",
      detail: product as unknown as ReportRecord,
    })),
  );
}

function mapClientAddresses(): ReportRecord[] {
  return getClients().flatMap((client) => {
    const onboarding = (client.lastUpdatedFormData ?? client.onboardingFormData ?? {}) as ReportRecord;
    const result: ReportRecord[] = [];

    for (const addressType of ["Billing", "Shipping"] as const) {
      const prefix = addressType.toLowerCase();
      const structured = client[`${prefix}AddressDetails`];
      const addressDetails = structured && typeof structured === "object" && !Array.isArray(structured)
        ? structured as ReportRecord
        : {};
      const field = (...names: string[]) => {
        const structuredValue = readMatchingField(addressDetails, ...names);
        if (structuredValue !== undefined) return structuredValue;
        const formValue = readMatchingField(onboarding, ...names);
        if (formValue !== undefined) return formValue;
        const addressSpecificNames = names.filter((name) => normalize(name).startsWith(prefix));
        return readMatchingField(client as unknown as ReportRecord, ...addressSpecificNames);
      };
      const line1 = field(`${prefix}_address`, `${prefix}AddressLine1`, "addressLine1");
      const line2 = field(`${prefix}_address_line2`, `${prefix}AddressLine2`, "addressLine2");
      const attention = field(`${prefix}_attention`, "attentionName", "attention");
      const city = field(`${prefix}_city`, `${prefix}City`, "city");
      const state = field(`${prefix}_state`, `${prefix}State`, "state");
      const zip = field(`${prefix}_pincode`, `${prefix}Pincode`, "zip", "zipCode");
      const country = field(`${prefix}_country`, `${prefix}Country`, "country");
      const phone = field(`${prefix}_phone`, "phone");
      const phoneCountryCode = field(`${prefix}_phone_country_code`, "phoneCountryCode");
      const faxNumber = field(`${prefix}_fax_number`, "faxNumber");
      const hasAddress = [line1, line2, city, state, zip, country, attention, phone, faxNumber]
        .some((value) => value !== undefined && value !== null && value !== "");
      if (!hasAddress) continue;

      result.push({
        id: `${client.id}:${prefix}`,
        label: addressType,
        addressType,
        line1,
        line2,
        addressLine1: line1,
        addressLine2: line2,
        attention,
        attentionName: attention,
        city,
        state,
        zip,
        pinCode: zip,
        country,
        phone,
        phoneCountryCode,
        faxNumber,
        clientId: client.id,
        clientName: client.name,
        createdBy: client.createdBy,
        createdAt: client.createdAt,
        updatedBy: client.updatedBy,
        updatedAt: client.updatedAt,
      });
    }

    return result;
  });
}

function mapClientCatalogRecords(): ReportRecord[] {
  return getClients().flatMap((client) => {
    const clientId = String(client.id);
    const clientName = String(client.name ?? clientId);
    return getClientCatalog(clientId).map((product, index) => ({
      ...(product as unknown as ReportRecord),
      id: `${clientId}:${product.productCode || product.sku || index}`,
      clientId,
      clientName,
      productName: product.name,
      price: product.priceNum ?? product.price,
      stock: product.availability,
      status: product.availability,
    }));
  });
}

function mapProductSpecificationRecords(): ReportRecord[] {
  return getCatalogProducts().flatMap((product) => {
    const shared = {
      ...(product as unknown as ReportRecord),
      masterProductCode: product.masterProductCode,
      sku: product.skuCode,
    };
    const specifications = (product.specifications ?? []).map((specification, index) => ({
      ...shared,
      ...(specification as unknown as ReportRecord),
      specificationGroup: "Specifications",
      sortOrder: index + 1,
    }));
    const generalSpecs = (product.generalSpecs ?? []).map((specification, index) => ({
      ...shared,
      general: specification as unknown as ReportRecord,
      specification: specification.category,
      value: specification.attributeValue,
      specificationGroup: "General",
      sortOrder: index + 1,
    }));
    return [...specifications, ...generalSpecs];
  });
}

function mapProductVariantRecords(): ReportRecord[] {
  return getCatalogProducts().flatMap((product) =>
    (product.variations ?? []).flatMap((variation) => {
      const options = Array.isArray(variation.options) ? variation.options : [];
      const base = {
        ...(product as unknown as ReportRecord),
        ...(variation as unknown as ReportRecord),
        masterProductCode: product.masterProductCode,
        variantId: variation.id,
        status: product.publishStatus,
        name: variation.name,
        options,
      };
      return options.length
        ? options.map((option) => ({
            ...base,
            id: option.id,
            option: option as unknown as ReportRecord,
          }))
        : [{ ...base, id: variation.id }];
    }),
  );
}

function mapProductTaxonomy(): ReportRecord[] {
  const taxonomy = new Map<string, { type: string; name: string; productCount: number }>();
  const add = (type: string, rawName: unknown) => {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) return;
    const key = `${type}:${normalize(name)}`;
    const existing = taxonomy.get(key);
    if (existing) existing.productCount += 1;
    else taxonomy.set(key, { type, name, productCount: 1 });
  };

  getCatalogProducts().forEach((product) => {
    add("Category", product.category);
    add("Brand", product.brand);
    (product.tags ?? []).forEach((tag) => add("Tag", tag));
  });

  return [...taxonomy.values()].map((entry) => ({
    ...entry,
    masterDataType: entry.type,
    taxonomyType: entry.type,
  }));
}

function mapPriceEngineComparisons(): ReportRecord[] {
  const productsByCode = new Map(
    getCatalogProducts().map((product) => [String(product.masterProductCode), product]),
  );

  return getAllProductPricing().flatMap((pricing) => {
    const catalogProduct = productsByCode.get(String(pricing.masterProductCode));
    const comparisons = Array.isArray(pricing.vendorComparisons) ? pricing.vendorComparisons : [];
    const productRecord: ReportRecord = {
      ...(catalogProduct as unknown as ReportRecord | undefined),
      masterProductCode: pricing.masterProductCode,
      productName: pricing.productName,
      sku: pricing.sku,
      category: pricing.category,
      vendorComparisons: comparisons,
      winningVendor: pricing.winningVendor ?? undefined,
      landedCostPerUnit: pricing.winningVendor ? pricing.landedCostPerUnit : undefined,
      moq: catalogProduct?.moq,
    };
    if (!comparisons.length) {
      return [{
        ...pricing,
        landedCostPerUnit: undefined,
        moq: undefined,
        winningVendor: undefined,
        product: productRecord,
        vendorComparisons: [],
      }];
    }
    return comparisons.map((comparison) => ({
      ...(comparison as unknown as ReportRecord),
      product: productRecord,
      vendorComparisons: comparisons,
      winningVendor: pricing.winningVendor,
      selectedVendorId: pricing.winningVendor?.vendorId,
      masterProductCode: pricing.masterProductCode,
      productName: pricing.productName,
      currency: comparison.currency,
    }));
  });
}

function mapVendorPricingChargeRecords(): ReportRecord[] {
  const configuredVendors = readLocalObject("nido_price_engine_vendor_settings");
  return getVendors().flatMap((vendor) => {
    const vendorId = String(vendor.id);
    const configured = configuredVendors[vendorId];
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) return [];

    const settings = getVendorCommonSettings(vendorId);
    const charges = Array.isArray(settings.extraCharges) ? settings.extraCharges : [];
    const chargeRows: (ReportRecord | undefined)[] = charges.length
      ? charges.map((charge) => charge as unknown as ReportRecord)
      : [undefined];
    return chargeRows.map((charge) => ({
      ...vendor,
      ...settings,
      vendorId,
      vendorName: vendor.name,
      ...(charge ? { charge, chargeType: "Extra charge" } : {}),
      currency: vendor.currency,
    }));
  });
}

function mapClientPricingMargins(): ReportRecord[] {
  const productsByCode = new Map(
    getCatalogProducts().map((product) => [String(product.masterProductCode), product]),
  );
  const categoryRules = getGlobalCategoryRules();

  return getAllClientPricing().map((pricing) => {
    const settings = getClientCommonSettings(String(pricing.clientId));
    const profit = getClientProfitSettings(String(pricing.clientId));
    const cart = getClientCartPricingSettings(String(pricing.clientId));
    const calc = pricing.calc;
    const cost = pricing.winningVendor ? numberFrom(pricing.landedCostPerUnit) : undefined;
    const categoryRule = categoryRules.find((rule) =>
      normalize(rule.category) === normalize(pricing.category),
    );
    const riskBufferAmount = cost !== undefined && categoryRule
      ? cost * Number(categoryRule.bufferPct || 0) / 100
      : undefined;

    return {
      ...(pricing as unknown as ReportRecord),
      landedCostPerUnit: cost,
      product: {
        ...(productsByCode.get(String(pricing.masterProductCode)) as unknown as ReportRecord | undefined),
        masterProductCode: pricing.masterProductCode,
        productName: pricing.productName,
        sku: pricing.sku,
        category: pricing.category,
      },
      settings: settings as unknown as ReportRecord,
      profit: profit as unknown as ReportRecord,
      cart: cart as unknown as ReportRecord,
      vendorId: pricing.winningVendor?.vendorId,
      currency: getConfig().localization.currency,
      baseCost: cost,
      riskBufferAmount,
      operationalCostAmount: calc?.perUnitTotal,
      marginAmount: calc?.profit,
      marginPercent: calc && calc.subtotal > 0 ? calc.profit / calc.subtotal * 100 : undefined,
      clientPriceExcludingTax: calc?.preTaxFinalPrice,
      clientPriceIncludingTax: calc?.finalPrice,
    };
  });
}

function mapPricingSlabsAndRules(): ReportRecord[] {
  const clients = getClients();
  const clientNameById = new Map(clients.map((client) => [String(client.id), String(client.name ?? client.id)]));
  const productsByCode = new Map(
    getCatalogProducts().map((product) => [String(product.masterProductCode), product]),
  );
  const clientRules = clients.flatMap((client) => [
    ...getClientPriceSlabs(String(client.id)).map((slab) => ({
      ...(slab as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
      ruleType: "Client price slab",
    })),
    ...getClientProductProfitRules(String(client.id)).map((rule) => ({
      ...(rule as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
      ruleType: "Client product profit",
      product: {
        ...(productsByCode.get(String(rule.masterProductCode)) as unknown as ReportRecord | undefined),
        ...rule,
      },
    })),
  ]);
  const globalRules = getGlobalCategoryRules().map((rule) => ({
    ...(rule as unknown as ReportRecord),
    name: rule.category,
    ruleType: "Global category pricing",
    category: rule as unknown as ReportRecord,
  }));
  return [...globalRules, ...clientRules].map((record) => ({
    ...record,
    clientName: record.clientName ?? clientNameById.get(String(record.clientId ?? "")),
  }));
}

function mapInventoryBalances(): ReportRecord[] {
  const vendorsById = new Map(getVendors().map((vendor) => [String(vendor.id), vendor]));
  const pricesByCode = new Map(
    getAllProductPricing().map((pricing) => [String(pricing.masterProductCode), pricing]),
  );
  const thresholds = getAllThresholds();
  const configuredCurrency = getConfig().localization.currency;

  return Object.entries(getAllVendorProducts()).flatMap(([vendorId, products]) => {
    const vendor = vendorsById.get(vendorId);
    return products.map((product) => {
      const code = String(product.masterProductCode || product.id);
      const physicalStock = numberFrom(product.physicalStock, product.stock) ?? 0;
      const reservedStock = numberFrom(product.reservedStock) ?? 0;
      const incomingStock = numberFrom(product.incomingStock);
      const availableQuantity = Math.max(0, physicalStock - reservedStock);
      const basePrice = numberFrom(product.price);
      const productPricing = pricesByCode.get(code);
      const vendorComparison = productPricing?.vendorComparisons.find((comparison) =>
        String(comparison.vendorId) === vendorId,
      );

      return {
        ...(product as unknown as ReportRecord),
        id: `${vendorId}:${product.id}:${code}`,
        vendorId,
        vendorName: vendor?.name ?? "",
        productName: product.productName,
        masterProductCode: product.masterProductCode,
        sku: product.skuCode,
        stock: physicalStock,
        currentStock: physicalStock,
        onHandQuantity: physicalStock,
        reservedStock,
        reservedQuantity: reservedStock,
        incomingStock,
        incomingQuantity: incomingStock,
        availableQuantity,
        basePrice,
        landedCostPerUnit: vendorComparison?.landedCostPerUnit,
        threshold: thresholds[code] ?? thresholds[String(product.id)],
        stockValue: basePrice === undefined ? undefined : availableQuantity * basePrice,
        lastStockUpdate: product.lastStockUpdate,
        currency: vendor?.currency ?? configuredCurrency,
      };
    });
  });
}

function mapOrderStatusConfiguration(): ReportRecord[] {
  const config = getOrderStatusConfig();
  const particulars = config.particulars.map((particular) => ({
    ...particular,
    id: particular.value,
    category: particular.value,
  })) as ReportRecord[];

  return config.statuses.map((status) => ({
    ...(status as unknown as ReportRecord),
    particular: particulars.find((particular) =>
      normalize(String(particular.value)) === normalize(status.category),
    ),
  }));
}

function mapScheduledReportRecords(): ReportRecord[] {
  const entitiesByType = getReportCenterEntities();
  return toRecords(getReportCenterSchedules()).map((schedule) => {
    const draft = (schedule.draft ?? {}) as unknown as ReportRecord;
    const entityType = String(draft.entityType ?? "internal") as ReportEntityType;
    const allEntities = draft.allEntities === true || schedule.allEntities;
    const entityIds = Array.isArray(draft.entityIds)
      ? draft.entityIds.map(String)
      : schedule.entityIds.map(String);
    const availableEntities = entitiesByType[entityType] ?? [];
    const entities = allEntities
      ? availableEntities
      : availableEntities.filter((entity) => entityIds.includes(entity.id));

    return {
      ...schedule,
      type: schedule.reportType,
      moduleId: schedule.module,
      entityMode: allEntities ? "All" : "Selected",
      entities,
      columns: Array.isArray(draft.selectedColumns) ? draft.selectedColumns : [],
      dateBasis: draft.dateBasis,
      from: draft.dateFrom,
      to: draft.dateTo,
      format: draft.format,
      period: schedule.dateRange,
      recipients: schedule.recipients,
      subject: schedule.name,
      enabled: schedule.status === "active",
      scheduleId: schedule.id,
      nextRunAt: schedule.nextRun,
      draft,
    };
  });
}

function mapReportDefinitionRecords(): ReportRecord[] {
  const builtins = getBuiltinReportViews().map((view) => ({
    ...(view as unknown as ReportRecord),
    type: "Built-in",
    moduleId: view.module,
    columns: view.selectedColumns,
    reportId: view.id,
    visibility: "Global",
  }));
  const custom = getCustomReports().map((report) => ({
    ...(report as unknown as ReportRecord),
    type: report.reportType,
    moduleId: report.module,
    columns: report.selectedColumns,
    recipients: report.emailRecipients,
    subject: report.name,
    reportId: report.id,
  }));
  return [...builtins, ...custom];
}

function mapReportHistoryRecords(): ReportRecord[] {
  return toRecords(getReportCenterHistory()).map((history) => {
    const draft = (history.draft ?? {}) as unknown as ReportRecord;
    return {
      ...history,
      at: history.generatedAtIso || history.generatedAt,
      type: history.reportType,
      moduleId: history.module,
      records: history.rowCount,
      periodLabel: history.period,
      selectedColumns: history.columns.map((column) => column.label || column.key),
      dateBasis: draft.dateBasis,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      spec: draft,
      sentAt: history.delivery === "Email" && history.status === "completed"
        ? history.generatedAtIso || history.generatedAt
        : undefined,
    };
  });
}

function mapClientVendorSpendRecords(): ReportRecord[] {
  const config = getConfig();
  const currency = config.localization.currency;
  const baseCurrency = config.localization.baseCurrency;
  const exchangeRates = config.localization.exchangeRates as unknown as ReportRecord;
  const documents = [
    ...getAllFinanceRecords(),
    ...toRecords(getOrders()).map((record) => ({ ...record, documentType: "Sales order" })),
    ...mapPurchaseOrders().map((record) => ({ ...record, documentType: "Purchase order" })),
    ...mapExpenses().map((record) => ({ ...record, documentType: "Expense" })),
  ];

  return documents.map((record) => {
    const documentType = String(record.documentType ?? record.paymentType ?? "");
    const amount = numberFrom(record.grandTotal, record.totalAmount, record.amountReceived, record.amount, record.total);
    const isInvoice = /invoice/i.test(documentType);
    const isBill = /^bill$/i.test(documentType);
    const isCredit = /credit/i.test(documentType);
    const isPayment = /payment|receipt/i.test(`${documentType} ${record.paymentType ?? ""}`);
    const isOrder = /order/i.test(documentType);
    const netInvoice = isInvoice ? numberFrom(record.subtotal, record.netAmount, amount) : undefined;
    const netBill = isBill ? numberFrom(record.subtotal, record.netAmount, amount) : undefined;
    const creditValue = isCredit ? numberFrom(record.creditAmount, record.grandTotal, record.amount, record.total) : undefined;
    const paidValue = isPayment ? numberFrom(record.amountReceived, record.amount, record.totalAmount) : undefined;
    const sourceCurrency = String(record.currency ?? currency);
    const rate = numberFrom(exchangeRates[sourceCurrency]);

    return {
      ...record,
      documentType,
      transactionDate: record.invoiceDate ?? record.billDate ?? record.paymentDate ?? record.orderDate ?? record.date ?? record.createdAt,
      orderCount: isOrder ? 1 : undefined,
      orderedValue: isOrder ? amount : undefined,
      invoicedNetValue: netInvoice,
      billNetValue: netBill,
      creditValue,
      paidValue,
      outstandingValue: numberFrom(record.balanceDue, record.outstandingAmount),
      taxAmount: numberFrom(record.taxAmount, record.totalTax),
      freightAmount: numberFrom(record.freightAmount, record.shippingAmount, record.shippingCost),
      netSpend: isBill
        ? (netBill ?? 0) - (creditValue ?? 0)
        : isCredit
          ? -(creditValue ?? 0)
          : undefined,
      currency: sourceCurrency,
      baseCurrency,
      exchangeRate: rate,
    };
  });
}

function mapSalesRevenueRecords(): ReportRecord[] {
  const invoices = mapInvoiceRecords();
  const products = new Map(
    getCatalogProducts().map((product) => [String(product.masterProductCode), product]),
  );
  return invoices.flatMap((invoice) => {
    const lines = Array.isArray(invoice.lineItems)
      ? invoice.lineItems as ReportRecord[]
      : Array.isArray(invoice.items)
        ? invoice.items as ReportRecord[]
        : [];
    const invoiceLines = lines.length ? lines : [invoice];
    return invoiceLines.map((line, index) => {
      const quantity = numberFrom(line.quantity, line.qty, line.units);
      const rate = numberFrom(line.rate, line.unitPrice, line.price);
      const discount = numberFrom(line.discount, line.discountAmount) ?? 0;
      const revenue = numberFrom(line.lineTaxableAmount, line.lineSubtotal, line.taxableAmount, line.netAmount)
        ?? (quantity !== undefined && rate !== undefined ? Math.max(0, quantity * rate - discount) : undefined)
        ?? (line === invoice ? numberFrom(invoice.subtotal, invoice.netAmount) : undefined);
      const credit = numberFrom(line.salesCreditAmount, line.creditAmount);
      const netRevenue = revenue !== undefined ? revenue - (credit ?? 0) : undefined;
      const explicitCogs = numberFrom(line.matchedCostOfGoodsSold, line.costOfGoodsSold, line.cogsAmount);
      const unitCost = numberFrom(line.landedCostPerUnit, line.unitCost);
      const cogs = explicitCogs ?? (
        quantity !== undefined && unitCost !== undefined ? quantity * unitCost : undefined
      );
      const freightCost = numberFrom(line.freightCost, line.freightAmount);
      const operationalCost = numberFrom(line.operationalCost, line.operationalCostAmount);
      const grossProfit = netRevenue !== undefined && cogs !== undefined
        ? netRevenue - cogs - (freightCost ?? 0)
        : undefined;
      const netProfit = grossProfit !== undefined
        ? grossProfit - (operationalCost ?? 0)
        : undefined;
      const productCode = String(line.masterProductCode ?? line.productCode ?? line.sku ?? "");
      const product = products.get(productCode);

      return {
        ...invoice,
        ...line,
        id: lines.length ? `${invoice.id ?? invoice.invoiceNumber ?? "invoice"}:${line.id ?? index + 1}` : invoice.id,
        clientId: invoice.clientId ?? line.clientId,
        clientName: invoice.clientName ?? invoice.customerName ?? line.clientName,
        vendorId: line.vendorId ?? invoice.vendorId,
        productCode: productCode || undefined,
        productName: line.productName ?? line.itemName ?? product?.productName,
        category: line.category ?? product?.category,
        unitsSold: quantity,
        invoiceNetRevenue: revenue,
        salesCreditAmount: credit,
        netRevenue,
        matchedCostOfGoodsSold: cogs,
        freightCost,
        operationalCost,
        grossProfit,
        grossMarginPercent: grossProfit !== undefined && netRevenue
          ? grossProfit / netRevenue * 100
          : undefined,
        netProfit,
        netMarginPercent: netProfit !== undefined && netRevenue
          ? netProfit / netRevenue * 100
          : undefined,
        unmatchedCostAmount: line.unmatchedCostAmount,
        currency: invoice.currency ?? line.currency ?? getConfig().localization.currency,
      };
    });
  });
}

function mapAgeingRecords(): ReportRecord[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const invoices = mapInvoiceRecords();
  const bills = getBills();
  const receipts = toRecords(getReceipts());
  const vendorPayments = getPaymentsMade();
  const clientCredits = mapCreditNotes();
  const vendorCredits = getVendorCredits();

  const mapDocument = (
    document: ReportRecord,
    side: "AR" | "AP",
  ): ReportRecord => {
    const number = String(document.invoiceNumber ?? document.billNumber ?? document.number ?? document.id ?? "");
    const linkedPayments = side === "AR"
      ? receipts.filter((receipt) =>
          String(receipt.invoiceNumber ?? "") === number ||
          String(receipt.invoiceId ?? "") === String(document.id ?? ""),
        )
      : vendorPayments.flatMap((payment) => {
          const allocations = Array.isArray(payment.allocations)
            ? payment.allocations as ReportRecord[]
            : [];
          return allocations
            .filter((allocation) =>
              String(allocation.billNumber ?? "") === number ||
              String(allocation.billId ?? "") === String(document.id ?? ""),
            )
            .map((allocation) => ({ ...allocation, payment }));
        });
    const embeddedPayments = Array.isArray(document.payments) ? document.payments as ReportRecord[] : [];
    const payments = embeddedPayments.length
      ? embeddedPayments
      : linkedPayments;
    const appliedPayments = payments.reduce((sum, payment) =>
      sum + (numberFrom(payment.amountReceived, payment.allocatedAmount, payment.amount, payment.totalAmount) ?? 0),
    0);
    const credits = side === "AR" ? clientCredits : vendorCredits;
    const linkedCredits = credits.filter((credit) =>
      (String(credit.invoiceNumber ?? credit.billNumber ?? credit.associatedBillNumber ?? "") === number) ||
      String(credit.invoiceId ?? credit.billId ?? "") === String(document.id ?? ""),
    );
    const appliedCredits = linkedCredits.reduce((sum, credit) =>
      sum + (numberFrom(credit.creditAmount, credit.grandTotal, credit.amount, credit.total) ?? 0),
    0);
    const originalAmount = numberFrom(document.grandTotal, document.totalAmount, document.amount, document.subtotal) ?? 0;
    const explicitBalance = numberFrom(document.balanceDue, document.openBalance, document.outstandingAmount);
    const openBalance = Math.max(0, explicitBalance ?? originalAmount - appliedPayments - appliedCredits);
    const dueDateValue = document.dueDate ?? document.paymentDueDate;
    const dueDate = dueDateValue ? new Date(String(dueDateValue)) : undefined;
    const daysOverdue = dueDate && Number.isFinite(dueDate.getTime())
      ? Math.max(0, Math.floor((todayStart.getTime() - new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()) / 86400000))
      : 0;
    const dueTime = dueDate?.getTime() ?? Number.NaN;
    const notDue = Number.isFinite(dueTime) && dueTime >= todayStart.getTime() ? openBalance : 0;
    const bucket = (minDays: number, maxDays?: number) =>
      daysOverdue >= minDays && (maxDays === undefined || daysOverdue <= maxDays) ? openBalance : 0;

    return {
      ...document,
      ledgerSide: side,
      documentId: document.id,
      documentNumber: number,
      documentDate: document.invoiceDate ?? document.billDate ?? document.date ?? document.createdAt,
      dueDate: dueDateValue,
      originalAmount,
      appliedPayments,
      appliedCredits,
      openBalance,
      daysOverdue,
      notDueAmount: notDue,
      "1To30Days": bucket(1, 30),
      "31To60Days": bucket(31, 60),
      "61To90Days": bucket(61, 90),
      over90Days: bucket(91),
      currency: document.currency ?? getConfig().localization.currency,
      ownerId: document.ownerId ?? document.createdById,
    };
  };

  return [
    ...invoices.map((invoice) => mapDocument(invoice, "AR")),
    ...bills.map((bill) => mapDocument(bill, "AP")),
  ];
}

function mapClientOrderRecords(): ReportRecord[] {
  const clients = getClients();
  const clientsById = new Map(clients.map((client) => [String(client.id), String(client.name ?? client.id)]));
  const sourceOrders = readLocalArray("nido_my_orders");
  const sourceOrdersById = new Map(sourceOrders.map((order) => [String(order.id ?? ""), order]));
  const orderFieldsById = new Map<string, ReportRecord>();
  for (const row of buildOrderReportRows(sourceOrders as unknown as MyOrder[])) {
    if (!orderFieldsById.has(row.order.id)) orderFieldsById.set(row.order.id, row.fields);
  }

  return clients.flatMap((client) => {
    const clientId = String(client.id);
    const clientName = clientsById.get(clientId) ?? clientId;
    return getClientOrders(clientId, clientName).map((order) => {
      const sourceOrder = sourceOrdersById.get(String(order.id)) ?? {};
      const itemRecords = (
        [
          sourceOrder.cartItems,
          order.productDetails,
          order.cartItems,
        ].find((items) => Array.isArray(items) && items.length > 0) ?? []
      ) as ReportRecord[];
      const totalQuantity = itemRecords.reduce(
        (sum, item) => sum + Number(item.quantity ?? item.qty ?? 0),
        0,
      );

      return {
        ...sourceOrder,
        ...(order as unknown as ReportRecord),
        ...(orderFieldsById.get(String(order.id)) ?? {}),
        clientId,
        clientName: order.client && order.client !== clientId ? order.client : clientName,
        orderDate: order.date || sourceOrder.orderDate || "",
        amount: order.amountNum,
        totalAmount: sourceOrder.totalAmountNum ?? order.amountNum,
        totalAmountNum: sourceOrder.totalAmountNum ?? order.amountNum,
        cartItems: itemRecords,
        orderedItemCount: itemRecords.length,
        totalQuantity: totalQuantity || Number(order.items) || 0,
      };
    });
  });
}

function mapClientServiceRecords(): ReportRecord[] {
  const clients = getClients();
  return clients.flatMap((client) => {
    const clientId = String(client.id);
    const clientName = String(client.name ?? clientId);
    return getClientServices(clientId).map((service) => ({
      ...(service as unknown as ReportRecord),
      clientId,
      clientName,
      serviceName: service.name,
      requestDate: service.startDate,
      assignedTo: service.provider,
    }));
  });
}

function getVendorStakeholderType(vendor: ReportRecord): "Vendor" | "Partner" | "Third Party" {
  const declared = String(
    vendor.stakeholderType ?? vendor.relationshipType ?? vendor.partnerType ?? "",
  ).toLowerCase();
  const category = String(vendor.category ?? "").toLowerCase();
  if (declared.includes("partner") || category.includes("partner")) return "Partner";
  if (declared.includes("third") || category.includes("third")) return "Third Party";
  return "Vendor";
}

function mapDepartments(): ReportRecord[] {
  const users = toRecords(getUsers());
  const counts = new Map<string, number>();
  for (const user of users) {
    const department = String(user.department ?? user.departmentName ?? "").trim();
    if (department) counts.set(department, (counts.get(department) ?? 0) + 1);
  }
  return [...counts.entries()].map(([department, userCount]) => ({
    id: department,
    department,
    userCount,
    status: "Active",
  }));
}

function getBills(): ReportRecord[] {
  return readLocalArray("nido_purchase_bills_v1").map((record) => ({ ...record, documentType: "Bill" }));
}

function getVendorCredits(): ReportRecord[] {
  return readLocalArray("nido_purchase_vendor_credits_v1");
}

function getPaymentsMade(): ReportRecord[] {
  return readLocalArray("nido_purchase_payments_made_v1").map((record) => ({ ...record, paymentType: "Vendor payment" }));
}

function getApprovalRecords(): ReportRecord[] {
  const store = readLocalObject("nido_local_approval_engine");
  const workflows = Array.isArray(store.workflows) ? store.workflows : [];
  const requests = Array.isArray(store.requests) ? store.requests : [];
  return [
    ...workflows.filter((record): record is ReportRecord => Boolean(record) && typeof record === "object").map((record) => ({ ...record, recordType: "Workflow" })),
    ...requests.filter((record): record is ReportRecord => Boolean(record) && typeof record === "object").map((record) => ({ ...record, recordType: "Request" })),
  ];
}

function approvalRecordsForModule(
  module: string,
  workflows: ReportRecord[],
  requests: ReportRecord[],
): ReportRecord[] {
  switch (module) {
    case "Approval Workflows":
      return workflows;
    case "Approval Workflow Conditions":
      return childRecords(workflows, ["conditions", "workflowConditions"]);
    case "Approval Workflow Levels":
      return childRecords(workflows, ["levels", "approvalLevels"]);
    case "Approval Requests":
      return requests;
    case "Approval Decisions and History":
      return childRecords(requests, ["decisions", "history", "steps"]);
    default:
      return [...workflows, ...requests];
  }
}

function getAuditRecords(): ReportRecord[] {
  return [
    ...toRecords(getStockHistory()).map((record) => ({ ...record, event: "Stock event" })),
    ...toRecords(getTaxAuditLog()).map((record) => ({ ...record, event: "Tax configuration event" })),
    ...toRecords(getSLAAuditLog()).map((record) => ({ ...record, event: "SLA event" })),
    ...toRecords(getImpersonationAudit()).map((record) => ({ ...record, event: "Impersonation event" })),
  ];
}

function getAllFinanceRecords(): ReportRecord[] {
  return [
    ...toRecords(getInvoices()).map((record) => ({ ...record, documentType: "Invoice" })),
    ...getBills(),
    ...toRecords(getReceipts()).map((record) => ({ ...record, paymentType: "Client receipt" })),
    ...getPaymentsMade(),
    ...getVendorCredits().map((record) => ({ ...record, documentType: "Vendor credit" })),
    ...mapCreditNotes().map((record) => ({ ...record, documentType: "Credit note" })),
  ];
}

function recordsFrom(value: unknown): ReportRecord[] {
  if (Array.isArray(value)) {
    return value.filter((record): record is ReportRecord =>
      Boolean(record) && typeof record === "object" && !Array.isArray(record),
    );
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? [value as ReportRecord]
    : [];
}

function childRecords(records: ReportRecord[], childKeys: string[]): ReportRecord[] {
  return records.flatMap((record) => {
    const payload = record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? record.payload as ReportRecord
      : {};
    const details = record.details && typeof record.details === "object" && !Array.isArray(record.details)
      ? record.details as ReportRecord
      : {};
    const childKey = childKeys.find((key) =>
      [record[key], payload[key], details[key]].some((value) => Array.isArray(value) && value.length > 0),
    ) ?? childKeys.find((key) =>
      Array.isArray(record[key]) || Array.isArray(payload[key]) || Array.isArray(details[key]),
    );
    if (!childKey) return [];
    const parentId = String(record.id ?? record.number ?? record.poNumber ?? record.invoiceNumber ?? "");
    const children = [
      record[childKey],
      payload[childKey],
      details[childKey],
    ].find((value) => Array.isArray(value) && value.length > 0)
      ?? record[childKey]
      ?? payload[childKey]
      ?? details[childKey] as unknown[];
    return children.flatMap((child, index) => {
      if (!child || typeof child !== "object" || Array.isArray(child)) return [];
      return [{
        ...record,
        ...(child as ReportRecord),
        id: String((child as ReportRecord).id ?? `${parentId}:${childKey}:${index + 1}`),
        parentRecordId: parentId,
        parentRecordType: childKey,
        childIndex: index + 1,
      }];
    });
  });
}

function mapVendorCategories(): ReportRecord[] {
  const vendors = getVendors();
  const countByCategory = new Map<string, number>();
  vendors.forEach((vendor) => {
    const category = String(vendor.category ?? "").trim();
    if (category) countByCategory.set(category.toLowerCase(), (countByCategory.get(category.toLowerCase()) ?? 0) + 1);
  });
  return vendors.filter((vendor) => String(vendor.category ?? "").trim()).map((vendor) => ({
    ...vendor,
    vendorId: vendor.vendorId ?? vendor.id,
    vendorName: vendor.vendorName ?? vendor.name,
    categoryId: vendor.categoryId,
    categoryName: vendor.category,
    parentCategoryId: vendor.parentCategoryId ?? "",
    description: vendor.categoryDescription ?? "",
    vendorCount: countByCategory.get(String(vendor.category).toLowerCase()) ?? 0,
  }));
}

function mapVendorPerformance(): ReportRecord[] {
  const purchaseOrders = mapPurchaseOrders();
  const slaEvents = toRecords(getSLAAuditLog());
  const currency = getConfig().localization.currency;
  return toRecords(getVendors()).map((vendor) => {
    const vendorId = String(vendor.vendorId ?? vendor.id);
    const vendorName = String(vendor.vendorName ?? vendor.name ?? vendorId);
    const orders = purchaseOrders.filter((order) =>
      String(order.vendorId ?? "") === vendorId ||
      String(order.vendorName ?? "").toLowerCase() === vendorName.toLowerCase(),
    );
    const cancelledOrders = orders.filter((order) => /cancel/i.test(String(order.status ?? "")));
    const acceptedOrders = orders.filter((order) => /accept|process|deliver|complete/i.test(String(order.status ?? "")));
    const deliveredOrders = orders.filter((order) => /deliver|complete/i.test(String(order.status ?? "")));
    const items = orders.flatMap((order) => Array.isArray(order.items) ? order.items as ReportRecord[] : []);
    const quantityOf = (item: ReportRecord) => Number(item.qty ?? item.quantity ?? 0);
    const itemsOrdered = items.reduce((total, item) => total + quantityOf(item), 0)
      || orders.reduce((total, order) => total + Number(order.qty ?? 0), 0);
    const itemsDelivered = items.reduce((total, item) =>
      total + (/deliver|complete|received/i.test(String(item.status ?? "")) ? quantityOf(item) : 0), 0,
    ) || deliveredOrders.reduce((total, order) => total + Number(order.qty ?? 0), 0);
    const datedDeliveries = deliveredOrders.flatMap((order) => {
      const expected = order.requestedDelivery ?? order.expectedDeliveryDate;
      const actual = order.deliveredAt ?? order.actualDeliveryDate;
      const expectedTime = expected ? new Date(String(expected)).getTime() : Number.NaN;
      const actualTime = actual ? new Date(String(actual)).getTime() : Number.NaN;
      return Number.isFinite(expectedTime) && Number.isFinite(actualTime) ? [{
        onTime: actualTime <= expectedTime,
      }] : [];
    });
    const matchingSlaEvents = slaEvents.filter((event) =>
      (String(event.vendorId ?? "") === vendorId ||
        String(event.vendorName ?? "").toLowerCase() === vendorName.toLowerCase()) &&
      /breach|missed|penalty/i.test(String(event.status ?? event.outcome ?? event.event ?? "")),
    );
    const poSpend = orders.reduce((total, order) => total + Number(order.grandTotal ?? order.totalAmount ?? 0), 0);
    const totalSpend = Number(vendor.totalSpend ?? 0) || poSpend;
    return {
      ...vendor,
      vendorId,
      vendorName,
      ordersReceived: orders.length,
      ordersAccepted: acceptedOrders.length,
      ordersCancelled: cancelledOrders.length,
      itemsOrdered,
      itemsDelivered,
      onTimeDeliveries: datedDeliveries.filter((delivery) => delivery.onTime).length,
      lateDeliveries: datedDeliveries.filter((delivery) => !delivery.onTime).length,
      onTimeDeliveryPercent: datedDeliveries.length
        ? datedDeliveries.filter((delivery) => delivery.onTime).length / datedDeliveries.length * 100
        : undefined,
      fulfillmentPercent: itemsOrdered ? itemsDelivered / itemsOrdered * 100 : undefined,
      averageResponseHours: vendor.averageResponseHours ?? vendor.responseHours,
      averageLeadTimeDays: vendor.averageLeadTimeDays ?? vendor.leadTimeDays,
      qualityScore: vendor.performanceQuality ?? vendor.rating,
      complianceScore: vendor.performanceCompliance,
      complaintCount: vendor.complianceIssues,
      slaBreachCount: matchingSlaEvents.length,
      penaltyAmount: matchingSlaEvents.reduce((total, event) => total + Number(event.penaltyAmount ?? 0), 0) || undefined,
      currency: vendor.currency ?? currency,
      totalSpend,
      performanceRating: vendor.rating ?? vendor.score,
    };
  });
}

function mapClientMasterRecords(): ReportRecord[] {
  return toRecords(getClients()).map((client) => {
    const onboarding = client.onboardingFormData ?? client.lastUpdatedFormData ?? {};
    return {
      ...client,
      clientId: client.clientId ?? client.id,
      clientName: client.clientName ?? client.name,
      onboarding: onboarding as ReportRecord,
    };
  });
}

function mapClientContracts(): ReportRecord[] {
  return getClients().flatMap((client) => {
    const contract = getClientContract(String(client.id));
    return contract ? [{
      ...(contract as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
    }] : [];
  });
}

function mapClientActivityRecords(): ReportRecord[] {
  return getClients().flatMap((client) =>
    getClientActivities(String(client.id)).map((activity) => ({
      ...(activity as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
    })),
  );
}

function mapClientDocumentRecords(): ReportRecord[] {
  return getClients().flatMap((client) =>
    getClientDocuments(String(client.id)).map((document) => ({
      ...(document as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
    })),
  );
}

function mapPortalUserRecords(): ReportRecord[] {
  const clientNames = new Map(getClients().map((client) => [String(client.id), String(client.name ?? client.id)]));
  return getPortalUsers().map((user) => ({
    ...(user as unknown as ReportRecord),
    clientName: clientNames.get(String(user.clientId)) ?? "",
    profile: user.details as ReportRecord | undefined,
  }));
}

function mapPortalRoleRecords(): ReportRecord[] {
  return getClients().flatMap((client) =>
    getPortalRoles(String(client.id)).map((role) => ({
      ...(role as unknown as ReportRecord),
      clientId: client.id,
      clientName: client.name,
    })),
  );
}

function mapUserNotesAndDocuments(kind: "notes" | "documents"): ReportRecord[] {
  return getUsers().flatMap((user) => {
    const details = kind === "notes" ? getUserNotes(String(user.id)) : getUserDocuments(String(user.id));
    return details.map((detail) => ({
      ...(detail as unknown as ReportRecord),
      userId: user.id,
      userName: user.name,
      department: user.department,
    }));
  });
}

function mapUserLoginHistory(): ReportRecord[] {
  return toRecords(getUsers()).flatMap((user) => {
    const history = Array.isArray(user.loginHistory) ? user.loginHistory as ReportRecord[] : [];
    return history.map((login) => ({
      ...user,
      loginHistory: login,
      login,
      userId: user.id,
      userName: user.name,
    }));
  });
}

function mapRolePermissions(): ReportRecord[] {
  return Object.entries(getAllRolePermissions()).flatMap(([roleName, modules]) =>
    Object.entries(modules).map(([module, actions]) => ({
      ...(actions as ReportRecord),
      roleName,
      module,
    })),
  );
}

function mapClientRolePermissions(): ReportRecord[] {
  const users = getPortalUsers();
  return mapPortalRoleRecords().flatMap((role) => {
    const permissions = Array.isArray(role.permissions) ? role.permissions : [];
    const assignedUserCount = users.filter((user) =>
      String(user.clientId) === String(role.clientId) && user.role === role.name,
    ).length;
    const rows = permissions.length ? permissions : [{}];
    return rows.map((permission) => ({
      ...role,
      permission,
      permissions,
      assignedUserCount,
    }));
  });
}

function mapServiceRequests(module?: string): ReportRecord[] {
  const requests = toRecords(getServiceRequests()).map((request) => {
    const payload = request.payload && typeof request.payload === "object" && !Array.isArray(request.payload)
      ? request.payload as ReportRecord
      : {};
    return { ...payload, ...request, payload };
  });
  if (!module) return requests;
  const query = module.toLowerCase();
  const terms: Record<string, string[]> = {
    "AMC Requests": ["amc"],
    "Repair Requests": ["repair"],
    "Rental Requests": ["rental"],
    "Recycle and Disposal Requests": ["recycle", "disposal"],
    "Regular Purchase Requests": ["regular purchase", "purchase request"],
  };
  const matches = terms[module] ?? [];
  return requests.filter((request) => {
    const searchable = [request.type, request.requestType, request.category, request.serviceType, request.title]
      .map((value) => String(value ?? "").toLowerCase()).join(" ");
    return matches.some((term) => searchable.includes(term)) || searchable.includes(query);
  });
}

function mapPurchaseOrders(): ReportRecord[] {
  return toRecords(getAllPOs());
}

function mapInvoiceRecords(): ReportRecord[] {
  return toRecords(getInvoices()).map((record) => ({ ...record, documentType: "Invoice" }));
}

function mapInvoicePaymentAndActivityRecords(): ReportRecord[] {
  return mapInvoiceRecords().flatMap((invoice) => {
    const payments = Array.isArray(invoice.payments) ? invoice.payments as ReportRecord[] : [];
    const activities = [
      ...(Array.isArray(invoice.activity) ? invoice.activity as ReportRecord[] : []),
      ...(Array.isArray(invoice.activities) ? invoice.activities as ReportRecord[] : []),
    ];
    return [
      ...payments.map((payment) => ({
        ...invoice,
        payment,
        eventType: "Payment",
        recordedAt: payment.date ?? payment.createdAt,
      })),
      ...activities.map((activity) => ({
        ...invoice,
        activity,
        eventType: "Activity",
        recordedAt: activity.date ?? activity.createdAt,
      })),
    ];
  });
}

function mapReceiptAllocationRecords(): ReportRecord[] {
  const invoicesByNumber = new Map(
    getInvoices().map((invoice) => [String(invoice.invoiceNumber), invoice]),
  );
  return toRecords(getReceipts()).map((receipt) => {
    const invoice = invoicesByNumber.get(String(receipt.invoiceNumber));
    const amount = receipt.amountReceived;
    return {
      ...receipt,
      receiptId: receipt.id,
      clientId: invoice?.clientId ?? receipt.clientId,
      invoiceId: invoice?.id ?? receipt.invoiceId,
      allocationDate: receipt.paymentDate,
      allocatedAmount: amount,
      allocatedBy: receipt.createdBy,
      reversalReference: receipt.reference,
      allocation: {
        invoiceNumber: receipt.invoiceNumber,
        amount,
        date: receipt.paymentDate,
        status: receipt.status,
      },
    };
  });
}

function linkedChildRecords(
  records: ReportRecord[],
  childKeys: string[],
  relation: "clientOrder" | "quote" | "salesOrder" | "invoice" | "receipt" | "creditNote" | "purchaseOrder" | "bill" | "payment" | "vendorCredit" | "ticket" | "serviceRequest" | "product",
): ReportRecord[] {
  return childRecords(records, childKeys).map((child) => {
    const parentId = String(child.parentRecordId ?? "");
    const clientId = child.clientId ?? getClients().find(
      (client) => String(client.name).toLowerCase() === String(child.clientName ?? child.customerName ?? "").toLowerCase(),
    )?.id;
    const links: Record<typeof relation, ReportRecord> = {
      clientOrder: { clientOrderId: parentId, orderId: parentId },
      quote: { quoteId: parentId, quoteNumber: child.quoteNumber },
      salesOrder: { salesOrderId: parentId, orderId: parentId, clientId },
      invoice: { invoiceId: parentId, clientId },
      receipt: { receiptId: parentId },
      creditNote: { creditNoteId: parentId },
      purchaseOrder: { purchaseOrderId: parentId, poNumber: child.poNumber },
      bill: { billId: parentId },
      payment: { paymentId: parentId },
      vendorCredit: { vendorCreditId: parentId },
      ticket: { ticketId: parentId },
      serviceRequest: { serviceRequestId: parentId },
      product: { masterProductId: parentId, productId: parentId },
    };
    const linked = { ...child, ...links[relation], ...(clientId ? { clientId } : {}) };
    const quantity = Number(linked.qty ?? linked.quantity);
    const rate = Number(linked.rate ?? linked.unitPrice ?? linked.price);
    const discount = Number(linked.discount ?? 0);
    const taxPercent = Number(linked.taxPercent ?? linked.gstPct ?? 0);
    const hasLineAmountInputs =
      (linked.qty !== undefined || linked.quantity !== undefined) &&
      (linked.rate !== undefined || linked.unitPrice !== undefined || linked.price !== undefined) &&
      Number.isFinite(quantity) && Number.isFinite(rate);
    const taxableAmount = Number(linked.lineTaxableAmount ?? linked.lineSubtotal ?? linked.taxableAmount);
    const effectiveTaxable = Number.isFinite(taxableAmount)
      ? taxableAmount
      : hasLineAmountInputs
        ? Math.max(0, quantity * rate - (Number.isFinite(discount) ? discount : 0))
        : undefined;
    const lineTaxAmount = Number(linked.lineTaxAmount ?? linked.taxAmount);
    const effectiveTax = Number.isFinite(lineTaxAmount)
      ? lineTaxAmount
      : effectiveTaxable !== undefined && Number.isFinite(taxPercent)
        ? effectiveTaxable * taxPercent / 100
        : undefined;
    return {
      ...linked,
      ...(effectiveTaxable !== undefined ? { lineTaxableAmount: effectiveTaxable } : {}),
      ...(effectiveTax !== undefined ? { lineTaxAmount: effectiveTax } : {}),
      ...(effectiveTaxable !== undefined && effectiveTax !== undefined
        ? { lineTotal: Number(linked.lineTotal ?? effectiveTaxable + effectiveTax) }
        : {}),
    };
  });
}

function mapPaymentMadeRecords(): ReportRecord[] {
  return getPaymentsMade();
}

function mapCreditNotes(): ReportRecord[] {
  return readLocalArray("nido_credit_notes_v3");
}

function mapRenewals(): ReportRecord[] {
  return [
    ...readLocalArray("nidoRenewals").map((record) => ({ ...record, renewalSource: "Active" })),
    ...readLocalArray("nidoRenewalHistory").map((record) => ({ ...record, renewalSource: "History" })),
  ];
}

function mapExpenses(): ReportRecord[] {
  return readLocalArray("nido_expenses_v1");
}

function mapSlaRecords(module: string): ReportRecord[] {
  switch (module) {
    case "Vendor SLA Policies": return recordsFrom(getVendorSLA());
    case "Client SLA Tiers": return toRecords(getClientSLA());
    case "Procurement SLA Stages": return toRecords(getProcurementSLA());
    case "Service SLA Policies": return toRecords(getServiceSLA());
    case "Approval SLA Policies": return toRecords(getApprovalSLA());
    case "SLA Escalation Rules": return toRecords(getEscalationRules());
    case "SLA Business Calendar": return recordsFrom(getBusinessCalendar());
    case "SLA Audit History":
    case "SLA Outcomes and Breaches":
      return toRecords(getSLAAuditLog());
    default:
      return [];
  }
}

function mapTaxReconciliationRecords(): ReportRecord[] {
  return [
    ...mapInvoiceRecords().map((record) => ({ ...record, transactionType: "Sales invoice" })),
    ...getBills().map((record) => ({ ...record, transactionType: "Vendor bill" })),
    ...toRecords(getReceipts()).map((record) => ({ ...record, transactionType: "Payment receipt" })),
    ...getPaymentsMade().map((record) => ({ ...record, transactionType: "Vendor payment" })),
  ];
}

function mapClientDashboardRecords(): ReportRecord[] {
  const clients = mapClientMasterRecords();
  const orders = mapClientOrderRecords();
  const salesOrders = toRecords(getOrders());
  const services = mapClientServiceRecords();
  const tickets = toRecords(getSupportTickets());
  const invoices = mapInvoiceRecords();
  const purchaseOrders = mapPurchaseOrders();
  const vendors = getVendors();
  const allApprovals = getApprovalRecords();
  const renewals = mapRenewals();
  const activeClients = clients.filter((client) => !/inactive|archived/i.test(String(client.status ?? "")));
  const activeVendors = vendors.filter((vendor) => !/inactive|archived/i.test(String(vendor.status ?? "")));
  const now = new Date();
  const recentOrderCutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const currency = getConfig().localization.currency;
  return clients.map((client) => {
    const clientId = String(client.clientId ?? client.id);
    const clientName = String(client.clientName ?? client.name ?? clientId);
    const belongsToClient = (record: ReportRecord) =>
      String(record.clientId ?? record.customerId ?? record.clientName ?? record.customerName ?? "") === clientId ||
      String(record.clientName ?? record.customerName ?? "") === clientName;
    const clientOrders = [...orders, ...salesOrders].filter(belongsToClient);
    const distinctOrders = [...new Map(clientOrders.map((order, index) => [
      `${order.id ?? order.orderNumber ?? index}`,
      order,
    ])).values()];
    const clientTickets = tickets.filter(belongsToClient);
    const clientInvoices = invoices.filter(belongsToClient);
    const clientPurchaseOrders = purchaseOrders.filter((order) => {
      const sourceOrder = salesOrders.find((salesOrder) =>
        String(salesOrder.id) === String(order.orderId),
      );
      return sourceOrder ? belongsToClient(sourceOrder) : false;
    });
    const isOpen = (status: unknown) => !/closed|resolved|cancelled|complete|paid/i.test(String(status ?? ""));
    const revenueRecords = clientInvoices.length
      ? clientInvoices
      : orders.filter(belongsToClient);
    const salesRevenue = revenueRecords.reduce(
      (total, record) => total + Number(record.grandTotal ?? record.totalAmount ?? record.amountNum ?? record.amount ?? 0),
      0,
    );
    const procurementSpend = clientPurchaseOrders.reduce(
      (total, record) => total + Number(record.grandTotal ?? record.totalAmount ?? 0),
      0,
    );
    const dueSoon = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    return {
      ...client,
      clientId,
      clientName,
      activeClientCount: activeClients.length,
      activeVendorCount: activeVendors.length,
      newOrderCount: distinctOrders.filter((order) => {
        const rawDate = order.orderDate ?? order.date ?? order.createdAt;
        const dateTime = rawDate ? new Date(String(rawDate)).getTime() : Number.NaN;
        return Number.isFinite(dateTime) && dateTime >= recentOrderCutoff;
      }).length,
      pendingOrderCount: distinctOrders.filter((order) => isOpen(order.status)).length,
      deliveredOrderCount: distinctOrders.filter((order) => /deliver|complete/i.test(String(order.status ?? ""))).length,
      openTicketCount: clientTickets.filter((ticket) => isOpen(ticket.status)).length,
      overdueInvoiceCount: clientInvoices.filter((invoice) =>
        isOpen(invoice.status) && invoice.dueDate && new Date(String(invoice.dueDate)).getTime() < now.getTime(),
      ).length,
      salesRevenue,
      procurementSpend,
      grossMarginPercent: salesRevenue > 0 && clientPurchaseOrders.length > 0
        ? ((salesRevenue - procurementSpend) / salesRevenue) * 100
        : undefined,
      pendingApprovalCount: allApprovals.filter((approval) =>
        belongsToClient(approval) && /pending|review|submitted/i.test(String(approval.status ?? "")),
      ).length,
      upcomingRenewalCount: renewals.filter((renewal) => {
        if (!belongsToClient(renewal)) return false;
        const rawDate = renewal.renewalDate ?? renewal.nextRenewalDate ?? renewal.endDate;
        const renewalTime = rawDate ? new Date(String(rawDate)).getTime() : Number.NaN;
        return Number.isFinite(renewalTime) && renewalTime >= now.getTime() && renewalTime <= dueSoon;
      }).length,
      currency,
      orderCount: distinctOrders.length,
      serviceRequestCount: services.filter(belongsToClient).length,
      supportTicketCount: clientTickets.length,
    };
  });
}

function mapServiceAppointmentRecords(): ReportRecord[] {
  return mapServiceRequests().flatMap((request) => {
    const assignment = request.assignment && typeof request.assignment === "object"
      ? request.assignment as ReportRecord
      : {};
    const appointments = [
      ...(Array.isArray(request.appointments) ? request.appointments as ReportRecord[] : []),
      ...(Array.isArray(request.visitSchedule) ? request.visitSchedule as ReportRecord[] : []),
      ...(Array.isArray(request.visits) ? request.visits as ReportRecord[] : []),
      ...(Array.isArray(request.payload) ? request.payload as ReportRecord[] : []),
    ];
    if (!appointments.length && !Object.keys(assignment).length) return [];
    return appointments.length
      ? appointments.map((appointment) => ({ ...request, assignment, appointment }))
      : [{ ...request, assignment, appointment: {} }];
  });
}

function getReportRunRecords(module: string, entityType?: ReportEntityType): ReportRecord[] | undefined {
  switch (module) {
    case "Client Master and Onboarding":
      return mapClientMasterRecords();
    case "Client Addresses":
      return mapClientAddresses();
    case "Client Contracts":
      return mapClientContracts();
    case "Client Users and External Stakeholders":
      return mapPortalUserRecords();
    case "Client Roles and Permissions":
      return mapClientRolePermissions();
    case "Client Activity":
      return mapClientActivityRecords();
    case "Client Documents":
      return mapClientDocumentRecords();
    case "Client Order Items":
      return linkedChildRecords(mapClientOrderRecords(), ["productDetails", "items", "cartItems"], "clientOrder");
    case "Sales Quotes":
      return toRecords(getQuotes());
    case "Sales Quote Items":
      return linkedChildRecords(toRecords(getQuotes()), ["lineItems", "items", "products"], "quote");
    case "Sales Orders":
      return toRecords(getOrders());
    case "Sales Order Items":
      return linkedChildRecords(toRecords(getOrders()), ["lineItems", "items", "cartItems"], "salesOrder");
    case "Invoices and Proforma Invoices":
      return mapInvoiceRecords();
    case "Invoice Items":
      return linkedChildRecords(mapInvoiceRecords(), ["lineItems", "items"], "invoice");
    case "Invoice Payments and Activity":
      return mapInvoicePaymentAndActivityRecords();
    case "Recurring Invoices":
      return toRecords(getAllRecurring());
    case "Payment Receipts":
      return toRecords(getReceipts()).map((record) => ({ ...record, paymentType: "Client receipt" }));
    case "Receipt Allocations":
      return mapReceiptAllocationRecords();
    case "Credit Notes":
      return mapCreditNotes();
    case "Credit Note Items":
      return childRecords(mapCreditNotes(), ["lineItems", "items", "products"]);
    case "Renewals":
      return mapRenewals();
    case "Client Catalog":
      return mapClientCatalogRecords();
    case "Services Request Register":
      return mapServiceRequests();
    case "AMC Requests":
    case "Repair Requests":
    case "Rental Requests":
    case "Recycle and Disposal Requests":
    case "Regular Purchase Requests":
      return mapServiceRequests(module);
    case "AMC Visit Schedule":
      return childRecords(mapServiceRequests("AMC Requests"), ["visits", "visitSchedule", "appointments"]);
    case "Regular Purchase Items":
      return linkedChildRecords(mapServiceRequests("Regular Purchase Requests"), ["items", "lineItems", "products"], "serviceRequest");
    case "Service Appointments and Assignments":
      return mapServiceAppointmentRecords();
    case "Support Parent Tickets":
      return toRecords(getSupportTickets());
    case "Support Child Tickets":
      return childRecords(toRecords(getSupportTickets()), ["children", "childTickets", "subTickets"]);
    case "Ticket Conversations and Attachments":
      return childRecords(toRecords(getSupportTickets()), ["conversations", "messages", "attachments", "replies"]);
    case "Vendor Orders":
    case "Purchase Orders":
      return mapPurchaseOrders();
    case "Vendor Order Items":
    case "Purchase Order Items":
      return linkedChildRecords(mapPurchaseOrders(), ["lineItems", "items", "products", "subOrders"], "purchaseOrder");
    case "Vendor PO Notes":
      return childRecords(mapPurchaseOrders(), ["notes", "activity", "activities"]);
    case "Vendor PO Documents":
      return childRecords(mapPurchaseOrders(), ["documents", "attachments", "files"]);
    case "Bills":
      return getBills();
    case "Bill Items":
      return linkedChildRecords(getBills(), ["lineItems", "items", "products"], "bill");
    case "Payments Made":
      return getPaymentsMade();
    case "Payment Made Allocations":
      return linkedChildRecords(getPaymentsMade(), ["allocations", "applications", "billAllocations"], "payment");
    case "Vendor Credits":
      return getVendorCredits();
    case "Vendor Credit Items":
      return linkedChildRecords(getVendorCredits(), ["lineItems", "items", "products"], "vendorCredit");
    case "Vendor Master and Onboarding":
      return toRecords(getVendors()).map((record) => ({
        ...record,
        vendorId: record.vendorId ?? record.id,
        vendorName: record.vendorName ?? record.name,
        onboarding: (record.lastUpdatedFormData ?? record.onboardingFormData) as ReportRecord | undefined,
      }));
    case "Vendor Categories":
      return mapVendorCategories();
    case "Vendor Payments Overview":
      return [...getBills(), ...getPaymentsMade()];
    case "Vendor Catalog":
      return entityType === "client" ? mapClientCatalogRecords() : mapVendorProducts();
    case "Nido Users":
      return toRecords(getUsers());
    case "User Login History":
      return mapUserLoginHistory();
    case "Nido Roles":
      return toRecords(getRoles());
    case "Role Permissions":
      return mapRolePermissions();
    case "Departments and Hierarchy":
      return mapDepartments();
    case "User Notes":
      return mapUserNotesAndDocuments("notes");
    case "User Documents":
      return mapUserNotesAndDocuments("documents");
    case "Automatic Assignment Rules":
      {
        const settings = getAutoAssignmentSettings();
        return settings.rules.map((rule, index) => ({
          ...(rule as unknown as ReportRecord),
          settings: settings as unknown as ReportRecord,
          rulePriority: index + 1,
        }));
      }
    case "Master Catalog":
    case "Product Commercial Terms":
      return toRecords(getCatalogProducts()).map((product) => ({
        ...(product as unknown as ReportRecord),
        detail: product as unknown as ReportRecord,
      }));
    case "Product Specifications":
      return mapProductSpecificationRecords();
    case "Product Categories Brands and Tags":
      return mapProductTaxonomy();
    case "Product Variants":
      return mapProductVariantRecords();
    case "Price Engine and Vendor Comparison":
      return mapPriceEngineComparisons();
    case "Vendor Pricing Charges":
      return mapVendorPricingChargeRecords();
    case "Client Pricing and Margins":
      return mapClientPricingMargins();
    case "Pricing Slabs and Rules":
      return mapPricingSlabsAndRules();
    case "Inventory Balances":
      return mapInventoryBalances();
    case "Stock Movements":
      return toRecords(getStockHistory());
    case "Returns and Cancellations": {
      const candidates = [
        ...toRecords(getOrders()).map((record) => ({ ...record, transactionType: "Sales order" })),
        ...mapPurchaseOrders().map((record) => ({ ...record, transactionType: "Purchase order" })),
        ...mapServiceRequests().map((record) => ({ ...record, transactionType: "Service request" })),
      ];
      return candidates.filter((record) => /cancel|return|refund/i.test(
        [record.status, record.type, record.requestType, record.reason].map((value) => String(value ?? "")).join(" "),
      ));
    }
    case "Approval Workflows":
    case "Approval Workflow Conditions":
    case "Approval Workflow Levels":
    case "Approval Requests":
    case "Approval Decisions and History":
    case "Approvals":
      return approvalRecordsForModule(
        module,
        getApprovalRecords().filter((record) => record.recordType === "Workflow"),
        getApprovalRecords().filter((record) => record.recordType === "Request"),
      );
    case "Vendor SLA Policies":
    case "Client SLA Tiers":
    case "Procurement SLA Stages":
    case "Service SLA Policies":
    case "Approval SLA Policies":
    case "SLA Escalation Rules":
    case "SLA Business Calendar":
    case "SLA Audit History":
    case "SLA Outcomes and Breaches":
      return mapSlaRecords(module);
    case "Client and Vendor Spend":
      return mapClientVendorSpendRecords();
    case "Sales Revenue and Profit":
      return mapSalesRevenueRecords();
    case "AR and AP Ageing":
      return mapAgeingRecords();
    case "Vendor Performance":
      return mapVendorPerformance();
    case "Dashboard and Client Activity Summary":
      return mapClientDashboardRecords();
    case "Organization and General Settings":
      return recordsFrom(getConfig());
    case "Order Status Configuration":
      return mapOrderStatusConfiguration();
    case "Tax Audit":
      return toRecords(getTaxAuditLog());
    case "Tax Transaction Reconciliation":
      return mapTaxReconciliationRecords();
    case "Audit and Impersonation":
    case "Audit Trail":
      return getAuditRecords();
    case "Report Definitions":
      return mapReportDefinitionRecords();
    case "Scheduled Reports":
      return mapScheduledReportRecords();
    case "Report Download and Email History":
      return mapReportHistoryRecords();
    case "Expenses":
      return mapExpenses();
    case "Transactions Ledger":
      throw new Error("Transaction-ledger postings are not stored by this app, so this report cannot be generated from real ledger data.");
    default:
      return undefined;
  }
}

export function getReportCenterRecords(module: string, entityType?: ReportEntityType): ReportRecord[] {
  const liveRecords = getReportRunRecords(module, entityType);
  if (liveRecords) return liveRecords;
  switch (module) {
    case "Products / Catalog":
      return mapVendorProducts();
    case "Vendor Orders":
    case "Purchase Orders":
    case "Procurement Reports":
      return toRecords(getAllPOs());
    case "RFQs":
      throw new Error("RFQ records cannot be loaded because this installation has no RFQ request data source.");
    case "Client Orders":
      return mapClientOrderRecords();
    case "Orders":
      return toRecords(getOrders());
    case "Catalog":
    case "Inventory":
      if (module === "Inventory") return toRecords(getStockHistory());
      return entityType === "client" ? mapClientCatalogRecords() : toRecords(getCatalogProducts());
    case "Services":
      if (entityType === "client") return mapClientServiceRecords();
      return toRecords(getServiceRequests());
    case "Support":
      return toRecords(getSupportTickets());
    case "Invoices / Bills":
      if (entityType === "client") {
        return toRecords(getInvoices()).map((record) => ({ ...record, documentType: "Invoice" }));
      }
      if (entityType === "vendor") return getBills();
      return [...toRecords(getInvoices()).map((record) => ({ ...record, documentType: "Invoice" })), ...getBills()];
    case "Payments":
      if (entityType === "client") {
        return toRecords(getReceipts()).map((record) => ({ ...record, paymentType: "Client receipt" }));
      }
      if (entityType === "vendor") return getPaymentsMade();
      return [...toRecords(getReceipts()).map((record) => ({ ...record, paymentType: "Client receipt" })), ...getPaymentsMade()];
    case "Vendor Credits":
      return getVendorCredits();
    case "SLA":
      return toRecords(getSLAAuditLog());
    case "Users":
    case "Internal Stakeholders":
      return toRecords(getUsers());
    case "Departments":
      return mapDepartments();
    case "Approvals":
      return getApprovalRecords();
    case "Finance":
      return getAllFinanceRecords();
    case "Audit Trail":
      return getAuditRecords();
    case "Tax":
      return toRecords(getTaxAuditLog());
    case "Sales Reports":
      return [
        ...toRecords(getOrders()).map((record) => ({ ...record, documentType: "Sales order" })),
        ...toRecords(getInvoices()).map((record) => ({ ...record, documentType: "Invoice" })),
        ...toRecords(getQuotes()).map((record) => ({ ...record, documentType: "Quote" })),
      ];
    case "Vendor Performance":
      return [
        ...toRecords(getVendors()).map((record) => ({
          ...record,
          vendorId: record.vendorId ?? record.id,
          vendorName: record.vendorName ?? record.name,
        })),
        ...toRecords(getAllPOs()),
      ];
    case "Client Reports":
      return [
        ...toRecords(getClients()).map((record) => ({
          ...record,
          clientId: record.clientId ?? record.id,
          clientName: record.clientName ?? record.name,
          documentType: "Client",
        })),
        ...toRecords(getOrders()),
        ...toRecords(getServiceRequests()),
        ...mapClientOrderRecords().map((record) => ({
          ...record,
          documentType: "Client order",
          documentNumber: record.orderNumber ?? record.orderId ?? record.id,
          date: record.orderDate ?? record.date,
        })),
        ...mapClientServiceRecords().map((record) => ({
          ...record,
          documentType: "Service",
          documentNumber: record.id,
          date: record.startDate,
        })),
      ];
    case "External Stakeholders":
      return [
        ...toRecords(getClients()).map((record) => ({
          ...record,
          clientId: record.clientId ?? record.id,
          clientName: record.clientName ?? record.name,
          entityType: "Client",
        })),
        ...toRecords(getVendors()).map((record) => ({
          ...record,
          vendorId: record.vendorId ?? record.id,
          vendorName: record.vendorName ?? record.name,
          entityType: getVendorStakeholderType(record),
        })),
      ];
    case "Executive Dashboard":
      return getReportRecords("All Modules");
    case "Custom Reports":
      return toRecords(getCustomReports());
    default:
      throw new Error(`Report data source is not configured for "${module}".`);
  }
}

export async function loadReportCenterRecords(module: string, entityType?: ReportEntityType): Promise<ReportRecord[]> {
  const approvalModules = new Set([
    "Approval Workflows",
    "Approval Workflow Conditions",
    "Approval Workflow Levels",
    "Approval Requests",
    "Approval Decisions and History",
    "Approvals",
  ]);
  if (!approvalModules.has(module)) return getReportCenterRecords(module, entityType);
  try {
    const bootstrap = await loadApprovalBootstrap();
    const workflows = bootstrap.workflows.map((record) => ({ ...record, recordType: "Workflow" })) as unknown as ReportRecord[];
    const requests = bootstrap.requests.map((record) => ({ ...record, recordType: "Request" })) as unknown as ReportRecord[];
    return approvalRecordsForModule(module, workflows, requests);
  } catch {
    return getReportCenterRecords(module, entityType);
  }
}

export function getReportCenterEntities(): Record<ReportEntityType, { id: string; name: string }[]> {
  const departments = new Map<string, string>();
  for (const role of getRoles()) {
    const department = String(role.department ?? "").trim();
    const key = department.toLowerCase();
    if (!department || key === "all departments" || departments.has(key)) continue;
    departments.set(key, department);
  }

  return {
    client: getClients().map((client) => ({ id: String(client.id), name: String(client.name ?? client.id) })),
    vendor: getVendors().map((vendor) => ({ id: String(vendor.id), name: String(vendor.name ?? vendor.id) })),
    internal: [...departments.values()]
      .sort((a, b) => a.localeCompare(b))
      .map((department) => ({ id: department, name: department })),
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const VALUE_ALIASES: Record<string, string[]> = {
  "Vendor Name": ["vendorName", "supplierName"],
  "GST Number": ["gstNumber", "gstin", "taxId"],
  "PAN Number": ["panNumber", "pan"],
  "SKU Code": ["skuCode", "sku"],
  "Master Product Code": ["masterProductCode", "productCode"],
  "Subcategory": ["subcategory", "subCategory"],
  Name: ["name", "productName", "clientName", "vendorName"],
  "Product Name": ["productName", "itemName", "item", "name"],
  "Item Name": ["productName", "itemName", "item", "name"],
  "Client Email": ["clientEmail", "customerEmail", "email"],
  "Vendor Email": ["vendorEmail", "supplierEmail", "email"],
  "Client Phone": ["clientPhone", "customerPhone", "phone", "mobile"],
  "Vendor Phone": ["vendorPhone", "supplierPhone", "phone", "mobile"],
  SKU: ["sku", "masterProductCode", "itemCode"],
  "Product Code": ["productCode", "masterProductCode"],
  "Unit Price": ["unitPrice", "unitCost", "price", "rate"],
  "Unit Cost": ["unitCost", "costPrice", "rate", "price"],
  Price: ["price", "unitPrice", "sellingPrice"],
  Stock: ["stock", "currentStock", "physicalStock", "quantity", "qty", "onHand"],
  "Reserved Stock": ["reservedStock", "reserved"],
  "Incoming Stock": ["incomingStock", "incoming"],
  MOQ: ["moq", "minimumOrderQuantity"],
  "Lead Time": ["leadTime", "leadTimeDays"],
  Quantity: ["quantity", "qty", "units"],
  Qty: ["qty", "quantity", "units"],
  Rate: ["rate", "unitPrice", "price", "unitCost"],
  "Tax Percent": ["taxPercent", "gstPct", "taxRate"],
  "Line Taxable Amount": ["lineTaxableAmount", "lineSubtotal", "taxableAmount"],
  "Line Tax Amount": ["lineTaxAmount", "taxAmount"],
  "Line Total": ["lineTotal", "lineAmount", "totalAmount"],
  "Sales Order ID": ["salesOrderId", "orderId", "parentRecordId"],
  "Purchase Order ID": ["purchaseOrderId", "poId", "parentRecordId"],
  "Invoice ID": ["invoiceId"],
  "Receipt ID": ["receiptId", "paymentReceiptId", "id"],
  "Payment ID": ["paymentId", "id"],
  "Credit Note ID": ["creditNoteId", "id"],
  "Ticket ID": ["ticketId", "number", "id"],
  "Client Name": ["clientName", "customerName", "client", "customer"],
  "Order ID": ["orderNumber", "orderId", "id"],
  "Order Date": ["orderDate", "date", "createdAt"],
  "Order Status": ["status"],
  "PO Reference": ["poNumber", "purchaseOrderNumber"],
  "PO Number": ["poNumber", "purchaseOrderNumber"],
  "Invoice / Bill Number": ["invoiceNumber", "billNumber", "number"],
  "Document Number": ["invoiceNumber", "billNumber", "orderNumber", "poNumber", "number"],
  "Payment Number": ["paymentNumber", "receiptNumber", "number", "reference", "id"],
  "Payment Date": ["paymentDate", "receiptDate", "date", "createdAt"],
  "Allocation Date": ["allocationDate", "paymentDate", "date", "createdAt"],
  "Allocated Amount": ["allocatedAmount", "amountAllocated", "amount"],
  "Allocated By": ["allocatedBy", "createdBy", "recordedBy"],
  "Reversal Reference": ["reversalReference", "reversalRef"],
  "Category ID": ["categoryId", "id"],
  "Category Name": ["categoryName", "category"],
  "Vendor Count": ["vendorCount"],
  "Assigned User Count": ["assignedUserCount"],
  "Permission / Module": ["module", "moduleName", "permissionModule"],
  "Permission / View": ["view"],
  "Permission / Create": ["create"],
  "Permission / Edit": ["edit"],
  "Permission / Delete": ["delete"],
  "Permission / Approve": ["approve"],
  "Permission / Export": ["export"],
  "Permission / Import": ["import"],
  "Permission / Manage": ["manage"],
  "Permission / Configure": ["configure"],
  "Credit Number": ["creditNoteNumber", "creditNumber", "number"],
  "Associated Bill": ["associatedBillNumber", "billNumber"],
  "Request Date": ["requestDate", "createdAt", "date"],
  "Service Name": ["serviceName", "requestType", "name"],
  "Assigned To": ["assignedTo", "agent", "owner"],
  "Created On": ["createdAt", "createdOn", "createdDate", "date", "timestamp"],
  "Created date": ["createdAt", "createdOn", "createdDate", "date", "timestamp"],
  "Approved Date": ["approvalDate", "approvedDate", "approvedAt"],
  "Due Date": ["dueDate", "paymentDueDate"],
  "Delivery Date": ["deliveryDate", "expectedDeliveryDate"],
  "Department": ["department", "departmentName"],
  "User Count": ["userCount"],
  "Record Type": ["recordType", "type"],
  "Document Type": ["documentType", "recordType", "type"],
  "Entity Type": ["entityType"],
  "Payment Type": ["paymentType", "type"],
  "Payment Method": ["paymentMethod", "method"],
  Amount: ["grandTotal", "totalAmount", "amount", "total", "subtotal", "creditAmount"],
  Spend: ["grandTotal", "totalAmount", "amount", "total", "spend"],
  Rating: ["rating", "score"],
  "PO Count": ["poCount", "orderCount"],
  Timestamp: ["timestamp", "createdAt", "date"],
};

const PATH_SEGMENT_ALIASES: Record<string, string[]> = {
  onboarding: ["onboarding", "onboardingFormData", "lastUpdatedFormData"],
  permission: ["permission"],
  payment: ["payment", "payments"],
  activity: ["activity", "activities"],
  assignment: ["assignment", "assignmentDetails"],
  appointment: ["appointment", "appointments", "appointmentDetails"],
  loginhistory: ["loginHistory", "login"],
  data: ["data", "payload"],
  detail: ["detail", "details", "productDetails"],
  view: ["view", "display"],
  profile: ["profile", "details"],
  option: ["option", "options"],
  general: ["general", "generalSpecs"],
  generalspecs: ["generalSpecs", "generalSpecifications"],
  specifications: ["specifications", "specs"],
  threshold: ["threshold", "stockThreshold"],
  entities: ["entities", "entityList"],
  attachment: ["attachment", "attachments", "files"],
  prefix: ["prefix", "prefixes"],
};

function findNestedValue(value: unknown, aliases: string[], seen = new WeakSet<object>(), depth = 0): unknown {
  if (!value || typeof value !== "object" || depth > 6) return undefined;
  if (Array.isArray(value)) {
    const matches = value
      .map((item) => findNestedValue(item, aliases, seen, depth + 1))
      .filter((match) => match !== undefined && match !== null && match !== "");
    return matches.length ? matches : undefined;
  }
  if (seen.has(value)) return undefined;
  seen.add(value);
  const object = value as Record<string, unknown>;
  for (const alias of aliases) {
    const key = Object.keys(object).find((candidate) => normalize(candidate) === normalize(alias));
    const candidate = key ? object[key] : undefined;
    if (candidate !== null && candidate !== undefined && candidate !== "") return candidate;
  }
  for (const nested of Object.values(object)) {
    if (!nested || typeof nested !== "object") continue;
    const match = findNestedValue(nested, aliases, seen, depth + 1);
    if (match !== undefined && match !== null && match !== "") return match;
  }
  return undefined;
}

function findPathValue(value: unknown, path: string[]): unknown {
  if (!path.length) return value;
  if (Array.isArray(value)) {
    const matches = value
      .map((item) => findPathValue(item, path))
      .flatMap((match) => Array.isArray(match) ? match : match === undefined ? [] : [match]);
    return matches.length ? matches : undefined;
  }
  if (!value || typeof value !== "object") return undefined;

  const [segment, ...remaining] = path;
  const aliases = PATH_SEGMENT_ALIASES[normalize(segment)]
    ?? VALUE_ALIASES[segment]
    ?? [segment];
  const object = value as Record<string, unknown>;
  const key = Object.keys(object).find((candidate) =>
    aliases.some((alias) => normalize(candidate) === normalize(alias)),
  );
  return key ? findPathValue(object[key], remaining) : undefined;
}

function findValue(record: ReportRecord, column: string): unknown {
  const path = column.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (path.length > 1) {
    const nestedPath = findPathValue(record, path);
    if (nestedPath !== null && nestedPath !== undefined && nestedPath !== "") return nestedPath;

    // The workbook sometimes uses a grouping label that isn't a source object,
    // such as Detail / Name. In that case resolve the actual leaf against the
    // existing record rather than returning an empty cell.
    const leaf = path[path.length - 1];
    const leafValue = findNestedValue(record, VALUE_ALIASES[leaf] ?? [leaf]);
    if (leafValue !== undefined) return leafValue;
  }

  const aliases = VALUE_ALIASES[column] ?? [column];
  for (const alias of aliases) {
    const key = Object.keys(record).find((candidate) => normalize(candidate) === normalize(alias));
    if (key && record[key] !== null && record[key] !== undefined && record[key] !== "") return record[key];
  }
  const nested = findNestedValue(record, aliases);
  if (nested !== undefined) return nested;
  const fallback = getReportFieldValue(record, column);
  return fallback === "—" ? undefined : fallback;
}

const REPORT_RUN_METADATA_COLUMNS = new Set([
  "Report Date From",
  "Report Date To",
  "Report Date Basis",
  "Report Generated At",
  "Report Timezone",
].map(normalize));

function hasReportColumnValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.some(hasReportColumnValue);
  if (typeof value === "string") return value.trim() !== "" && value.trim() !== "—";
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Keep the workbook order, but only offer fields that resolve to data in at
 * least one current record (along with report-run metadata). This prevents
 * users from generating reports full of columns the underlying module cannot
 * populate.
 */
export function getReportCenterColumnsForRecords(
  module: string,
  records: ReportRecord[],
): ReportColumnGroup[] {
  return (REPORT_CENTER_COLUMNS[module] ?? [])
    .map((columnGroup) => ({
      ...columnGroup,
      columns: columnGroup.columns.filter((column) =>
        REPORT_RUN_METADATA_COLUMNS.has(normalize(column))
        || records.some((record) => hasReportColumnValue(findValue(record, column))),
      ),
    }))
    .filter((columnGroup) => columnGroup.columns.length > 0);
}

export function getReportCenterMappedColumns(
  module: string,
  selectedColumns: string[],
  records: ReportRecord[],
): string[] {
  const available = new Set(
    getReportCenterColumnsForRecords(module, records)
      .flatMap((columnGroup) => columnGroup.columns)
      .map(normalize),
  );
  return orderReportCenterColumns(module, selectedColumns)
    .filter((column) => available.has(normalize(column)));
}

const PRODUCT_LIST_COLUMN_IDENTITIES = new Set(["item", "items", "lineitems", "cartitems"]);

export function isReportCenterProductListColumn(column: string): boolean {
  return PRODUCT_LIST_COLUMN_IDENTITIES.has(normalize(column));
}

function productNamesOnly(value: unknown): string {
  let parsed = value;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return "—";
    if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.startsWith('"')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed;
      }
    } else {
      parsed = trimmed;
    }
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const names = items.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const entry = item as ReportRecord;
    const nestedProducts = [entry.product, entry.item, entry.catalogItem, entry.productSnapshot]
      .filter((candidate): candidate is ReportRecord =>
        Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate),
      );
    const name = [
      entry.productName,
      entry.itemName,
      entry.name,
      entry.title,
      ...nestedProducts.flatMap((product) => [product.productName, product.itemName, product.name, product.title]),
      typeof entry.product === "string" ? entry.product : undefined,
      typeof entry.item === "string" ? entry.item : undefined,
    ].find((candidate) => typeof candidate === "string" && candidate.trim());
    return typeof name === "string" ? [name.trim()] : [];
  });
  return names.length ? names.join(", ") : "—";
}

export function getReportCenterCellValue(record: ReportRecord, column: string): string {
  const value = findValue(record, column);
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isReportCenterProductListColumn(column)) return productNamesOnly(value);
  if (Array.isArray(value)) {
    const entries = value.flatMap((entry) => {
      if (entry === undefined || entry === null || entry === "") return [];
      if (typeof entry === "object") return [JSON.stringify(entry)];
      return [String(entry)];
    });
    return entries.length ? entries.join(", ") : "—";
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (/(amount|price|total|spend|cost)$/i.test(column)) {
    const amount = Number(value);
    if (Number.isFinite(amount)) return formatCurrency(amount);
  }
  if (/(date|timestamp|created on)$/i.test(column)) {
    const timestamp = value instanceof Date ? value.toISOString() : String(value);
    if (!Number.isNaN(new Date(timestamp).getTime())) return formatDate(timestamp);
  }
  return String(value);
}

export function filterReportCenterRecords(
  records: ReportRecord[],
  draft: {
    entityType: ReportEntityType;
    entityIds: string[];
    allEntities: boolean;
    dateBasis: string;
    dateFrom: string;
    dateTo: string;
  },
  entities: Record<ReportEntityType, { id: string; name: string }[]>,
): ReportRecord[] {
  let filtered = records;
  if (!draft.allEntities) {
    if (!draft.entityIds.length) return [];
    const names = new Set(
      (entities[draft.entityType] ?? [])
        .filter((entity) => draft.entityIds.includes(entity.id))
        .map((entity) => normalize(entity.name)),
    );
    const ids = new Set(draft.entityIds.map(normalize));
    filtered = filtered.filter((record) => {
      const candidates = draft.entityType === "vendor"
        ? [record.vendorId, record.vendorName, record.supplierId, record.supplierName]
        : draft.entityType === "client"
          ? [record.clientId, record.clientName, record.customerId, record.customerName, record.client]
          : [record.departmentId, record.department, record.departmentName];
      return candidates.some((candidate) => {
        if (candidate === null || candidate === undefined) return false;
        const value = normalize(String(candidate));
        return ids.has(value) || names.has(value);
      });
    });
  }

  if (!draft.dateFrom && !draft.dateTo) return filtered;
  const dateKeys: Record<string, string[]> = {
    "Created date": ["createdAt", "createdOn", "createdDate", "orderDate", "requestDate", "startDate", "date", "timestamp"],
    "Updated date": ["updatedAt", "modifiedAt", "lastUpdatedAt"],
    "Order date": ["orderDate", "invoiceDate", "billDate", "requestDate", "startDate", "date", "createdAt"],
    "Delivery date": ["deliveryDate", "expectedDeliveryDate", "dueDate", "endDate"],
  };
  const keys = dateKeys[draft.dateBasis] ?? dateKeys["Created date"];
  return filtered.filter((record) => {
    const key = Object.keys(record).find((candidate) => keys.some((alias) => normalize(alias) === normalize(candidate)));
    const raw = key ? record[key] : undefined;
    if (!raw) return false;
    const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(String(raw));
      if (Number.isNaN(parsed.getTime())) return false;
      const localValue = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      return (!draft.dateFrom || localValue >= draft.dateFrom) && (!draft.dateTo || localValue <= draft.dateTo);
    }
    return (!draft.dateFrom || value >= draft.dateFrom) && (!draft.dateTo || value <= draft.dateTo);
  });
}

export function getReportCenterPreview(
  records: ReportRecord[],
  columns: string[],
): { id: string; values: Record<string, string> }[] {
  const uniqueColumns = uniqueReportCenterColumns(columns);
  return records.slice(0, 100).map((record, index) => ({
    id: String(record.id ?? record.number ?? record.poNumber ?? record.orderNumber ?? index),
    values: Object.fromEntries(uniqueColumns.map((column) => [column, getReportCenterCellValue(record, column)])),
  }));
}

export function getReportCenterExportData(
  records: ReportRecord[],
  columns: string[],
): { key: string; label: string }[] {
  return uniqueReportCenterColumns(columns).map((column) => ({ key: column, label: column }));
}

export function getReportCenterRows(
  records: ReportRecord[],
  columns: string[],
): Record<string, string>[] {
  const uniqueColumns = uniqueReportCenterColumns(columns);
  return records.map((record) => Object.fromEntries(uniqueColumns.map((column) => [column, getReportCenterCellValue(record, column)])));
}

