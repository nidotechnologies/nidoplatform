const STORE_KEY = "nido_custom_reports_v1";
const BUILTIN_SCHEDULES_KEY = "nido_builtin_report_schedules_v1";

export type ReportFormat = "Excel" | "CSV" | "PDF";
export type ReportFrequency = "One Time" | "Daily" | "Weekly" | "Monthly" | "Quarterly";
export type ReportCategory = "Orders" | "Clients" | "Vendors" | "Support" | "Services" | "Users" | "Catalog" | "All Modules";

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  reportType: string;
  module: string;
  selectedColumns: string[];
  filters: ReportFilter[];
  frequency: ReportFrequency;
  startDate: string;
  time: string;
  timeZone: string;
  deliveryEmail: boolean;
  deliveryDownload: boolean;
  emailRecipients: string;
  format: ReportFormat;
  includeCharts: boolean;
  includeSummary: boolean;
  createdBy: string;
  createdAt: string;
  lastRunDate?: string;
  lastRunStatus?: "Success" | "Failed" | "Pending";
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export type BuiltinReportSchedule = Pick<
  CustomReport,
  "frequency" | "time" | "timeZone" | "deliveryEmail" | "emailRecipients"
>;

export interface BuiltinReportView {
  id: string;
  name: string;
  description: string;
  module: string;
  selectedColumns: string[];
  format: ReportFormat;
}

const BUILTIN_REPORT_VIEWS: BuiltinReportView[] = [
  { id: "r1", name: "Master Order Report", description: "Summary of all orders across clients and vendors", module: "Orders", selectedColumns: ["Order ID", "Order Date", "Client Name", "Order Status", "Amount", "Tax", "Total"], format: "Excel" },
  { id: "r2", name: "Client Activity Report", description: "Client users, catalog, orders and requests", module: "Clients", selectedColumns: ["ID", "Created On", "Client Name", "Client Email", "Client Status"], format: "PDF" },
  { id: "r3", name: "Vendor Performance Report", description: "Vendor users, catalog, orders and tickets", module: "Vendors", selectedColumns: ["ID", "Created On", "Vendor Name", "Vendor Email", "Vendor Status"], format: "Excel" },
  { id: "r4", name: "Support Tickets Report", description: "All support tickets and resolution status", module: "Support Tickets", selectedColumns: ["ID", "Created On", "Priority", "Status"], format: "PDF" },
  { id: "r5", name: "Services Requests Report", description: "All service requests and status", module: "Services", selectedColumns: ["ID", "Created On", "Status", "Priority"], format: "Excel" },
  { id: "r6", name: "User Summary Report", description: "All platform users and roles", module: "Users", selectedColumns: ["ID", "Created On", "Created By", "Status"], format: "Excel" },
];

export function getCustomReports(): CustomReport[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function getBuiltinReportView(id: string): BuiltinReportView | undefined {
  return BUILTIN_REPORT_VIEWS.find((report) => report.id === id);
}

export function getBuiltinReportViews(): BuiltinReportView[] {
  return [...BUILTIN_REPORT_VIEWS];
}

export function getBuiltinReportSchedule(id: string): BuiltinReportSchedule | undefined {
  try {
    const schedules = JSON.parse(localStorage.getItem(BUILTIN_SCHEDULES_KEY) ?? "{}") as Record<string, BuiltinReportSchedule>;
    return schedules[id];
  } catch {
    return undefined;
  }
}

export function saveBuiltinReportSchedule(id: string, schedule: BuiltinReportSchedule): void {
  let schedules: Record<string, BuiltinReportSchedule> = {};
  try {
    schedules = JSON.parse(localStorage.getItem(BUILTIN_SCHEDULES_KEY) ?? "{}");
  } catch {
    schedules = {};
  }
  schedules[id] = schedule;
  localStorage.setItem(BUILTIN_SCHEDULES_KEY, JSON.stringify(schedules));
  window.dispatchEvent(new Event("nidoCustomReportsUpdated"));
}

export function saveCustomReport(report: CustomReport): void {
  const all = getCustomReports();
  const idx = all.findIndex((r) => r.id === report.id);
  if (idx >= 0) all[idx] = report;
  else all.unshift(report);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("nidoCustomReportsUpdated"));
}

export function deleteCustomReport(id: string): void {
  const all = getCustomReports().filter((r) => r.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("nidoCustomReportsUpdated"));
}

export function generateReportId(): string {
  const all = getCustomReports();
  const num = all.length + 1;
  return `RPT-${String(num).padStart(5, "0")}`;
}

/** Map module → category label used in the reports list */
export function moduleToCategoryLabel(module: string): ReportCategory {
  const map: Record<string, ReportCategory> = {
    "All Modules": "All Modules",
    Clients: "Clients",
    Vendors: "Vendors",
    Catalog: "Catalog",
    Orders: "Orders",
    Services: "Services",
    "Support Tickets": "Support",
  };
  return map[module] ?? "All Modules";
}

/** Human-readable schedule label for the reports list */
export function scheduleLabel(freq: ReportFrequency, time: string): string {
  switch (freq) {
    case "One Time": return `One Time\n${time}`;
    case "Daily": return `Daily\n${time}`;
    case "Weekly": return `Weekly\nEvery Monday ${time}`;
    case "Monthly": return `Monthly\n1st of every month`;
    case "Quarterly": return `Quarterly\n1st of every quarter`;
    default: return freq;
  }
}
