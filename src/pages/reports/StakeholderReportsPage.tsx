import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Boxes,
  BriefcaseBusiness,
  CircleUserRound,
  FileCheck2,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useLiveReportRevision } from "@/hooks/useLiveReportRevision";
import { useReportFilters } from "@/contexts/ReportControlsContext";
import ReportShell from "@/components/reports/ReportShell";
import KpiCard from "@/components/reports/KpiCard";
import ChartCard from "@/components/reports/ChartCard";
import FilterBar from "@/components/reports/FilterBar";
import ExportBar from "@/components/reports/ExportBar";
import ReportDataTable, { type Column } from "@/components/reports/ReportDataTable";
import { applyReportFilters, type ReportRecord } from "@/lib/reportData";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getClients } from "@/lib/clientStore";
import { getVendors, type StoredVendor } from "@/lib/vendorDataStore";
import { getAllVendorProducts, getProductTotalAvailableStock } from "@/lib/vendorStore";
import { getOrders } from "@/lib/salesOrderStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getRoles, getUsers } from "@/lib/nidoUsersStore";
import {
  getHsnCodes,
  getSacCodes,
  getTaxAuditLog,
  getTaxCategories,
} from "@/lib/taxEngine";

export type StakeholderReportKind =
  | "catalog-products"
  | "internal-stakeholders"
  | "external-stakeholders"
  | "risk-compliance";

type DomainReportRow = ReportRecord & {
  id: string;
  category: string;
  status: string;
  createdAt?: string;
};

const REPORT_CONFIG: Record<StakeholderReportKind, { title: string; subtitle: string }> = {
  "catalog-products": {
    title: "Catalog & Product Reports",
    subtitle: "Live product catalog, SKU and MPC references, pricing, supplier offers, and available stock.",
  },
  "internal-stakeholders": {
    title: "Internal Stakeholder Reports",
    subtitle: "Live employee, team, role, and assigned-workload reporting.",
  },
  "external-stakeholders": {
    title: "External Stakeholder Reports",
    subtitle: "Live client and vendor records, with partner and third-party records where those relationships are registered.",
  },
  "risk-compliance": {
    title: "Risk & Compliance Reports",
    subtitle: "Current vendor compliance indicators, client registration details, and tax/regulatory configuration.",
  },
};

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCatalogRows(): DomainReportRow[] {
  const catalog = getCatalogProducts();
  const vendorProducts = Object.values(getAllVendorProducts()).flat();

  return catalog.map((product) => {
    const offers = vendorProducts.filter(
      (offer) => offer.masterProductCode === product.masterProductCode,
    );
    const prices = offers.map((offer) => numberValue(offer.price)).filter((price) => price > 0);

    return {
      id: String(product.id),
      product: product.productName,
      sku: product.skuCode || "—",
      mpc: product.masterProductCode || "—",
      category: product.category || "Uncategorized",
      brand: product.brand || "—",
      catalogPrice: numberValue(product.price),
      lowestSupplierPrice: prices.length ? Math.min(...prices) : null,
      availableStock: product.masterProductCode
        ? getProductTotalAvailableStock(product.masterProductCode)
        : 0,
      supplierCount: new Set(offers.filter((offer) => offer.status === "Active").map((offer) => offer.vendorId)).size,
      status: product.publishStatus || "Unknown",
      createdAt: offers.find((offer) => offer.addedAt)?.addedAt || "",
    };
  });
}

function matchesEmployee(record: Record<string, unknown>, employee: {
  id: string;
  employeeId: string;
  name: string;
  email: string;
}): boolean {
  const tokens = [employee.id, employee.employeeId, employee.name, employee.email]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const ownerFields = [
    "assignedTo", "assignedToId", "assignedUserId", "assignedUser",
    "createdBy", "createdById", "createdByName", "createdByEmail",
    "requestedBy", "requestedById", "requestedByName", "agent", "owner",
    "salesPerson", "salesperson",
  ];
  return ownerFields.some((key) => {
    const value = record[key];
    return typeof value === "string" && tokens.includes(value.trim().toLowerCase());
  });
}

function countCompleted(records: Record<string, unknown>[], employee: {
  id: string;
  employeeId: string;
  name: string;
  email: string;
}): number {
  return records.filter((record) => {
    if (!matchesEmployee(record, employee)) return false;
    const status = String(record.status ?? "").toLowerCase();
    return ["completed", "resolved", "closed", "done"].includes(status);
  }).length;
}

function buildInternalRows(): DomainReportRow[] {
  const users = getUsers();
  const roles = getRoles();
  const roleNames = new Set(roles.map((role) => role.name.toLowerCase()));
  const orders = getOrders() as unknown as Record<string, unknown>[];
  const tickets = getSupportTickets() as unknown as Record<string, unknown>[];
  const serviceRequests = getServiceRequests() as unknown as Record<string, unknown>[];

  return users.map((employee) => {
    const assignedOrders = orders.filter((record) => matchesEmployee(record, employee)).length;
    const assignedTickets = tickets.filter((record) => matchesEmployee(record, employee)).length;
    const assignedRequests = serviceRequests.filter((record) => matchesEmployee(record, employee)).length;
    const completedWork =
      countCompleted(orders, employee)
      + countCompleted(tickets, employee)
      + countCompleted(serviceRequests, employee);
    const assignedWork = assignedOrders + assignedTickets + assignedRequests;
    const department = employee.department || "Unassigned";

    return {
      id: employee.id,
      employeeId: employee.employeeId,
      employee: employee.name,
      user: employee.name,
      userName: employee.name,
      email: employee.email,
      department,
      team: department,
      role: employee.role || "Unassigned",
      roleStatus: roleNames.has((employee.role || "").toLowerCase()) ? "Assigned" : "Role not configured",
      status: employee.status || "Unknown",
      orders: assignedOrders,
      tickets: assignedTickets,
      serviceRequests: assignedRequests,
      totalActivities: assignedWork,
      completedWork,
      completionRate: assignedWork ? Math.round((completedWork / assignedWork) * 100) : 0,
      lastLogin: employee.lastLogin || "—",
      category: department,
      createdAt: employee.dateOfJoining || employee.createdAt || "",
    };
  });
}

function stakeholderType(vendor: StoredVendor): "Vendor" | "Partner" | "Third Party" {
  const metadata = vendor as StoredVendor & Record<string, unknown>;
  const declared = String(
    metadata.stakeholderType ?? metadata.relationshipType ?? metadata.partnerType ?? "",
  ).toLowerCase();
  if (declared.includes("partner") || String(vendor.category ?? "").toLowerCase().includes("partner")) return "Partner";
  if (declared.includes("third")) return "Third Party";
  return "Vendor";
}

function buildExternalRows(): DomainReportRow[] {
  const clientRows = getClients().map((client) => ({
    id: `client-${client.id}`,
    stakeholderType: "Client",
    entity: client.name,
    category: client.category || "Client",
    contact: client.contactPerson || client.primaryContact || client.rep || "—",
    email: client.email || "—",
    phone: client.phone || client.mobile || "—",
    location: client.billingCity || client.city || "—",
    status: client.status || "Active",
    registration: client.gstin || client.GSTIN || "—",
    clientName: client.name,
    createdAt: client.onboardedDate || client.contractStartDate || client.createdAt || "",
  }));
  const vendorRows = getVendors().map((vendor) => {
    const kind = stakeholderType(vendor);
    return {
      id: `vendor-${vendor.id}`,
      stakeholderType: kind,
      entity: vendor.name,
      category: vendor.category || kind,
      contact: vendor.primaryContact || "—",
      email: vendor.email || "—",
      phone: vendor.phone || "—",
      location: vendor.region || vendor.city || "—",
      status: vendor.status || "Unknown",
      registration: vendor.taxId || vendor.registrationNo || "—",
      vendorName: vendor.name,
      createdAt: vendor.onboardedDate || vendor.createdAt || "",
    };
  });
  return [...clientRows, ...vendorRows];
}

function buildRiskRows(): DomainReportRow[] {
  const vendorRows = getVendors().map((vendor) => {
    const missingRegistration = !vendor.taxId && !vendor.registrationNo;
    const issueCount = numberValue(vendor.complianceIssues);
    return {
      id: `vendor-risk-${vendor.id}`,
      recordType: "Vendor Compliance",
      entity: vendor.name,
      vendorName: vendor.name,
      category: "Vendor Compliance",
      status: issueCount > 0 ? "Review Required" : vendor.status,
      complianceScore: numberValue(vendor.performanceCompliance ?? vendor.score),
      openIssues: issueCount,
      registration: vendor.taxId || vendor.registrationNo || "—",
      registrationStatus: missingRegistration ? "Not recorded" : "Recorded",
      riskIndicator: issueCount > 0 ? `${issueCount} reported compliance issue(s)` : "No reported compliance issues",
      createdAt: vendor.onboardedDate || vendor.createdAt || "",
    };
  });

  const clientRows = getClients().map((client) => {
    const taxId = client.gstin || client.GSTIN || "";
    const contractEnd = client.contractEndDate || "";
    const expired = contractEnd && new Date(contractEnd).getTime() < Date.now();
    return {
      id: `client-risk-${client.id}`,
      recordType: "Client Registration",
      entity: client.name,
      clientName: client.name,
      category: "Client Registration",
      status: expired ? "Contract Expired" : client.status || "Active",
      complianceScore: null,
      openIssues: 0,
      registration: taxId || "—",
      registrationStatus: taxId ? "GSTIN recorded" : "GSTIN not recorded",
      riskIndicator: expired ? "Contract end date has passed" : taxId ? "No flagged registration issue" : "Review tax registration details",
      contractEnd,
      createdAt: contractEnd || client.contractStartDate || client.createdAt || "",
    };
  });

  const taxRows = getTaxCategories().map((tax) => ({
    id: `tax-category-${tax.id}`,
    recordType: "Tax Category",
    entity: tax.name,
    category: "Tax Category",
    status: tax.status,
    complianceScore: null,
    openIssues: 0,
    registration: `${tax.igstPct}% IGST`,
    registrationStatus: tax.isExempt ? "Exempt" : tax.isZeroRated ? "Zero-rated" : "Configured",
    riskIndicator: tax.isReverseCharge ? "Reverse charge applies" : "Tax rule configured",
    createdAt: "",
  }));

  const hsnRows = getHsnCodes().map((code) => ({
    id: `hsn-${code.id}`,
    recordType: "HSN Regulatory Code",
    entity: code.description,
    category: "HSN",
    status: code.status,
    complianceScore: null,
    openIssues: 0,
    registration: code.code,
    registrationStatus: `${code.gstRate}% GST`,
    riskIndicator: code.productCategory || "—",
    createdAt: "",
  }));

  const sacRows = getSacCodes().map((code) => ({
    id: `sac-${code.id}`,
    recordType: "SAC Regulatory Code",
    entity: code.description,
    category: "SAC",
    status: code.status,
    complianceScore: null,
    openIssues: 0,
    registration: code.code,
    registrationStatus: `${code.gstRate}% GST`,
    riskIndicator: code.serviceCategory || "—",
    createdAt: "",
  }));

  const auditRows = getTaxAuditLog().map((entry) => ({
    id: `tax-audit-${entry.id}`,
    recordType: "Tax Configuration Change",
    entity: entry.module,
    category: "Regulatory Audit",
    status: "Recorded",
    complianceScore: null,
    openIssues: 0,
    registration: entry.user,
    registrationStatus: "Change logged",
    riskIndicator: entry.reason || "Tax configuration updated",
    createdAt: entry.timestamp,
  }));

  return [...vendorRows, ...clientRows, ...taxRows, ...hsnRows, ...sacRows, ...auditRows];
}

function getRows(kind: StakeholderReportKind): DomainReportRow[] {
  switch (kind) {
    case "catalog-products":
      return buildCatalogRows();
    case "internal-stakeholders":
      return buildInternalRows();
    case "external-stakeholders":
      return buildExternalRows();
    case "risk-compliance":
      return buildRiskRows();
  }
}

function getColumns(kind: StakeholderReportKind): Column<DomainReportRow>[] {
  switch (kind) {
    case "catalog-products":
      return [
        { key: "product", label: "Product", sortable: true },
        { key: "sku", label: "SKU", sortable: true },
        { key: "mpc", label: "MPC", sortable: true },
        { key: "category", label: "Category", sortable: true },
        { key: "brand", label: "Brand" },
        { key: "catalogPrice", label: "Catalog Price", align: "right", sortable: true },
        { key: "lowestSupplierPrice", label: "Lowest Supplier Price", align: "right", sortable: true },
        { key: "availableStock", label: "Available Stock", align: "right", sortable: true },
        { key: "supplierCount", label: "Suppliers", align: "right", sortable: true },
        { key: "status", label: "Publish Status", sortable: true },
      ];
    case "internal-stakeholders":
      return [
        { key: "employeeId", label: "Employee ID", sortable: true },
        { key: "employee", label: "Employee", sortable: true },
        { key: "department", label: "Team / Department", sortable: true },
        { key: "role", label: "Role", sortable: true },
        { key: "roleStatus", label: "Role Mapping" },
        { key: "status", label: "Status", sortable: true },
        { key: "orders", label: "Orders", align: "right", sortable: true },
        { key: "tickets", label: "Tickets", align: "right", sortable: true },
        { key: "serviceRequests", label: "Service Requests", align: "right", sortable: true },
        { key: "totalActivities", label: "Assigned Work", align: "right", sortable: true },
        { key: "completedWork", label: "Completed Work", align: "right", sortable: true },
        { key: "completionRate", label: "Completion Rate (%)", align: "right", sortable: true },
        { key: "lastLogin", label: "Last Login" },
      ];
    case "external-stakeholders":
      return [
        { key: "stakeholderType", label: "Type", sortable: true },
        { key: "entity", label: "Organization", sortable: true },
        { key: "category", label: "Category", sortable: true },
        { key: "contact", label: "Contact" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "location", label: "Region / City" },
        { key: "registration", label: "Registration" },
        { key: "status", label: "Status", sortable: true },
      ];
    case "risk-compliance":
      return [
        { key: "recordType", label: "Record Type", sortable: true },
        { key: "entity", label: "Entity / Rule", sortable: true },
        { key: "category", label: "Area", sortable: true },
        { key: "status", label: "Status", sortable: true },
        { key: "complianceScore", label: "Compliance Score", align: "right", sortable: true },
        { key: "openIssues", label: "Reported Issues", align: "right", sortable: true },
        { key: "registration", label: "Registration / Code" },
        { key: "registrationStatus", label: "Registration Status" },
        { key: "riskIndicator", label: "Risk / Compliance Detail" },
      ];
  }
}

function getKpis(kind: StakeholderReportKind, rows: DomainReportRow[]) {
  if (kind === "catalog-products") {
    return [
      { title: "Catalog Products", value: rows.length, icon: <Package className="h-4 w-4 text-orange-600" />, bg: "bg-orange-50" },
      { title: "Categories", value: new Set(rows.map((row) => row.category)).size, icon: <Boxes className="h-4 w-4 text-blue-600" />, bg: "bg-blue-50" },
      { title: "Out of Stock", value: rows.filter((row) => numberValue(row.availableStock) <= 0).length, icon: <AlertTriangle className="h-4 w-4 text-red-600" />, bg: "bg-red-50" },
      { title: "Without Supplier Offer", value: rows.filter((row) => numberValue(row.supplierCount) === 0).length, icon: <Building2 className="h-4 w-4 text-purple-600" />, bg: "bg-purple-50" },
    ];
  }
  if (kind === "internal-stakeholders") {
    return [
      { title: "Employees", value: rows.length, icon: <Users className="h-4 w-4 text-blue-600" />, bg: "bg-blue-50" },
      { title: "Active Employees", value: rows.filter((row) => row.status === "Active").length, icon: <BadgeCheck className="h-4 w-4 text-emerald-600" />, bg: "bg-emerald-50" },
      { title: "Teams / Departments", value: new Set(rows.map((row) => row.department)).size, icon: <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />, bg: "bg-indigo-50" },
      { title: "Configured Roles", value: getRoles().length, icon: <CircleUserRound className="h-4 w-4 text-violet-600" />, bg: "bg-violet-50" },
    ];
  }
  if (kind === "external-stakeholders") {
    return [
      { title: "Clients", value: rows.filter((row) => row.stakeholderType === "Client").length, icon: <Users className="h-4 w-4 text-teal-600" />, bg: "bg-teal-50" },
      { title: "Vendors", value: rows.filter((row) => row.stakeholderType === "Vendor").length, icon: <Building2 className="h-4 w-4 text-purple-600" />, bg: "bg-purple-50" },
      { title: "Partners", value: rows.filter((row) => row.stakeholderType === "Partner").length, icon: <BriefcaseBusiness className="h-4 w-4 text-blue-600" />, bg: "bg-blue-50" },
      { title: "Third Parties", value: rows.filter((row) => row.stakeholderType === "Third Party").length, icon: <Activity className="h-4 w-4 text-amber-600" />, bg: "bg-amber-50" },
    ];
  }
  return [
    { title: "Records Monitored", value: rows.length, icon: <ShieldCheck className="h-4 w-4 text-blue-600" />, bg: "bg-blue-50" },
    { title: "Vendors with Reported Issues", value: rows.filter((row) => row.recordType === "Vendor Compliance" && numberValue(row.openIssues) > 0).length, icon: <AlertTriangle className="h-4 w-4 text-red-600" />, bg: "bg-red-50" },
    { title: "Registration Reviews", value: rows.filter((row) => row.registrationStatus === "Not recorded" || row.registrationStatus === "GSTIN not recorded").length, icon: <FileCheck2 className="h-4 w-4 text-amber-600" />, bg: "bg-amber-50" },
    { title: "Inactive Regulatory Rules", value: rows.filter((row) => ["Tax Category", "HSN", "SAC"].includes(String(row.category)) && row.status === "Inactive").length, icon: <BadgeCheck className="h-4 w-4 text-emerald-600" />, bg: "bg-emerald-50" },
  ];
}

export default function StakeholderReportsPage({
  reportKind,
}: {
  reportKind?: StakeholderReportKind;
}) {
  const params = useParams();
  const routeKind = params.kind as StakeholderReportKind | undefined;
  const kind = reportKind ?? routeKind ?? "catalog-products";
  const config = REPORT_CONFIG[kind] ?? REPORT_CONFIG["catalog-products"];
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  usePageMeta({ title: config.title });

  const sourceRows = useMemo(() => getRows(kind), [kind, liveRevision]);
  const rows = useMemo(
    () => applyReportFilters(sourceRows, filters) as DomainReportRow[],
    [sourceRows, filters],
  );
  const columns = useMemo(() => getColumns(kind), [kind]);
  const categories = useMemo(
    () => [...new Set(sourceRows.map((row) => row.category).filter(Boolean))].sort(),
    [sourceRows],
  );
  const statuses = useMemo(
    () => [...new Set(sourceRows.map((row) => row.status).filter(Boolean))].sort(),
    [sourceRows],
  );
  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
    return [...counts].map(([status, count]) => ({ status, count }));
  }, [rows]);
  const kpis = useMemo(() => getKpis(kind, rows), [kind, rows, liveRevision]);

  return (
    <ReportShell title={config.title} subtitle={config.subtitle}>
      <div className="space-y-5">
        <ExportBar reportTitle={config.title} />
        <FilterBar
          clients={kind === "external-stakeholders" ? sourceRows.filter((row) => row.stakeholderType === "Client").map((row) => String(row.clientName)) : []}
          vendors={kind === "external-stakeholders" || kind === "risk-compliance" ? sourceRows.filter((row) => row.vendorName).map((row) => String(row.vendorName)) : []}
          categories={categories}
          statuses={statuses}
        />

        {kind === "external-stakeholders" && (
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
            Client and vendor records are read live. Partner and third-party counts include records explicitly classified that way in the vendor register; there is no separate partner register configured.
          </p>
        )}
        {kind === "internal-stakeholders" && (
          <p className="rounded-lg border border-gray-100 bg-white px-4 py-3 text-xs leading-relaxed text-gray-600">
            Assigned-work counts are calculated from current orders, support tickets, and service requests linked to each employee. They are workload indicators, not performance ratings.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} iconBg={kpi.bg} />
          ))}
        </div>

        <ChartCard title="Records by Status" subtitle="Filtered live report data">
          {statusBreakdown.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">No records match the selected filters.</div>
          )}
        </ChartCard>

        <ReportDataTable
          title={kind === "catalog-products" ? "Product Catalog & Inventory" : config.title}
          data={rows}
          columns={columns}
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          emptyMessage="No live records match the selected filters."
          pageSize={12}
        />
      </div>
    </ReportShell>
  );
}
