import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Mail,
  Pause,
  Package,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { reportCenterDisplayColumn } from "@/lib/reportHeaderUtils";
import "./reports-center.css";

export type ReportsCenterTab = "create" | "scheduled" | "history";
export type ReportEntityType = "client" | "vendor" | "internal";
export type ReportExportFormat = "Excel" | "PDF" | "CSV";
export type ReportDeliveryMode = "download" | "email";
export type ScheduleStatus = "active" | "paused";
export type ReportRunStatus = "completed" | "failed" | "running";

export interface ReportEntity {
  id: string;
  name: string;
}

export interface ReportColumnGroup {
  label: string;
  columns: string[];
}

export interface ReportPreviewRecord {
  id: string;
  values: Record<string, string | number | null | undefined>;
}

export interface ReportCreateDraft {
  entityType: ReportEntityType;
  entityIds: string[];
  allEntities: boolean;
  module: string;
  selectedColumns: string[];
  dateBasis: string;
  dateFrom: string;
  dateTo: string;
  format: ReportExportFormat;
  delivery: ReportDeliveryMode;
  recipients: string;
}

export interface ScheduledReportRecord {
  id: string;
  name: string;
  scope: string;
  module: string;
  frequency: string;
  recipients: string[];
  nextRun: string;
  status: ScheduleStatus;
  reportType: string;
  entityIds?: string[];
  allEntities?: boolean;
  draft?: ReportCreateDraft;
}

export interface RecentDeliveryRecord {
  id: string;
  reportName: string;
  deliveredAt: string;
  status: string;
}

export interface ReportHistoryRecord {
  id: string;
  name: string;
  scope: string;
  scopeDetail?: string;
  module?: string;
  generatedAt: string;
  period: string;
  source: string;
  delivery: string;
  status: ReportRunStatus;
  format: ReportExportFormat;
}

export interface NewReportSchedule {
  id?: string;
  name: string;
  reportType: string;
  module: string;
  frequency: string;
  recipients: string;
  dateRange: string;
  entityIds: string[];
  allEntities: boolean;
}

export interface ReportsCenterUIProps {
  initialTab?: ReportsCenterTab;
  activeTab?: ReportsCenterTab;
  onTabChange?: (tab: ReportsCenterTab) => void;

  entitiesByType?: Partial<Record<ReportEntityType, ReportEntity[]>>;
  modulesByType?: Partial<Record<ReportEntityType, string[]>>;
  columnsByModule?: Record<string, ReportColumnGroup[]>;
  createDraft?: ReportCreateDraft;
  onCreateDraftChange?: (draft: ReportCreateDraft) => void;
  previewRecords?: ReportPreviewRecord[];
  previewCount?: number;
  previewError?: string;
  previewCurrency?: string;
  previewScope?: string;
  onPreview?: (draft: ReportCreateDraft) => void;
  onDownloadReport?: (draft: ReportCreateDraft) => void;
  onSendReportEmail?: (draft: ReportCreateDraft) => void;

  scheduledReports?: ScheduledReportRecord[];
  recentDeliveries?: RecentDeliveryRecord[];
  deliveryTimezone?: string;
  savedDateRange?: string;
  onCreateSchedule?: (schedule: NewReportSchedule) => void;
  onRunSchedule?: (record: ScheduledReportRecord) => void;
  onEditSchedule?: (record: ScheduledReportRecord, schedule: NewReportSchedule) => void;
  onPauseSchedule?: (record: ScheduledReportRecord) => void;
  onResumeSchedule?: (record: ScheduledReportRecord) => void;
  onDeleteSchedule?: (record: ScheduledReportRecord) => void;
  onConnectDelivery?: () => void;
  onViewScheduleHistory?: () => void;

  historyRecords?: ReportHistoryRecord[];
  onRefreshHistory?: () => void;
  onDownloadHistoryRecord?: (record: ReportHistoryRecord) => void;
}

const EMPTY_DRAFT: ReportCreateDraft = {
  entityType: "vendor",
  entityIds: [],
  allEntities: false,
  module: "Products / Catalog",
  selectedColumns: ["Vendor Name", "Product Name", "SKU", "Category", "Unit Price", "Stock"],
  dateBasis: "Created date",
  dateFrom: "",
  dateTo: "",
  format: "Excel",
  delivery: "download",
  recipients: "",
};

const ENTITY_INFO: Record<ReportEntityType, { title: string; detail: string; Icon: LucideIcon }> = {
  client: { title: "Client", detail: "Client orders, catalogs and services", Icon: Users },
  vendor: { title: "Vendor", detail: "Vendor products, orders and purchases", Icon: Package },
  internal: { title: "Nido Internal", detail: "Departments, users and internal modules", Icon: Building2 },
};

const DEFAULT_MODULES: Record<ReportEntityType, string[]> = {
  client: ["Client Orders", "Catalog", "Services", "Invoices / Bills", "Payments", "Support"],
  vendor: ["Products / Catalog", "Vendor Orders", "Purchase Orders", "RFQs", "Invoices / Bills", "Payments", "Vendor Credits", "SLA"],
  internal: ["Users", "Departments", "Orders", "Approvals", "Finance", "Audit Trail"],
};

const DEFAULT_COLUMNS: Record<string, ReportColumnGroup[]> = {
  "Products / Catalog": [{ label: "PRODUCTS", columns: ["Vendor Name", "Product Name", "SKU", "Category", "Brand", "Unit Price", "Stock", "Reserved Stock", "Incoming Stock", "MOQ", "Lead Time", "Status", "Created date"] }],
  "Vendor Orders": [{ label: "VENDOR ORDERS", columns: ["Vendor Name", "Order ID", "Order Date", "Order Status", "Amount", "PO Reference"] }],
  "Purchase Orders": [{ label: "PURCHASE ORDERS", columns: ["Vendor Name", "PO Number", "Created On", "Status", "Amount"] }],
  "Client Orders": [{ label: "CLIENT ORDERS", columns: ["Client Name", "Order ID", "Order Date", "Order Status", "Amount"] }],
  "Catalog": [{ label: "CATALOG", columns: ["Item Name", "SKU", "Category", "Price", "Stock"] }],
  "Services": [{ label: "SERVICES", columns: ["Service Name", "Request Date", "Client Name", "Status"] }],
  "Users": [{ label: "USERS", columns: ["Name", "Email", "Department", "Role", "Status"] }],
  "Departments": [{ label: "DEPARTMENTS", columns: ["Department", "Manager", "User Count", "Status"] }],
};

const FORMATS: ReportExportFormat[] = ["Excel", "PDF", "CSV"];
const HISTORY_PAGE_SIZES = [10, 25, 50];

function useNotice() {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice] as const;
}

function IconButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button type="button" className="rc-icon-button" aria-label={label} title={label} onClick={onClick} style={danger ? { color: "#b94d4d" } : undefined}>
      {children}
    </button>
  );
}

function SummaryTile({ icon, label, value, tone = "" }: { icon: ReactNode; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rc-card rc-summary">
      <span className={`rc-summary-icon ${tone}`}>{icon}</span>
      <span><span className="rc-summary-label">{label}</span><span className="rc-summary-value" style={{ display: "block" }}>{value}</span></span>
    </div>
  );
}

function ReportsTabs({ active, onChange }: { active: ReportsCenterTab; onChange: (tab: ReportsCenterTab) => void }) {
  const tabs: { id: ReportsCenterTab; label: string; icon: React.ReactNode }[] = [
    { id: "create", label: "Create Report", icon: <FileText /> },
    { id: "scheduled", label: "Scheduled Reports", icon: <CalendarDays /> },
    { id: "history", label: "Report History", icon: <Clock3 /> },
  ];
  return <nav className="rc-tabs" aria-label="Report center views">{tabs.map((tab) => (
    <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} className={`rc-tab ${active === tab.id ? "active" : ""}`} onClick={() => onChange(tab.id)}>
      {tab.icon}{tab.label}
    </button>
  ))}</nav>;
}

function CreateReportView({
  draft,
  updateDraft,
  entitiesByType,
  modulesByType,
  columnsByModule,
  previewRecords,
  previewCount,
  previewError,
  previewCurrency,
  previewScope,
  onPreview,
  onDownloadReport,
  onSendReportEmail,
  notify,
}: {
  draft: ReportCreateDraft;
  updateDraft: (next: Partial<ReportCreateDraft>) => void;
  entitiesByType: Partial<Record<ReportEntityType, ReportEntity[]>>;
  modulesByType: Partial<Record<ReportEntityType, string[]>>;
  columnsByModule: Record<string, ReportColumnGroup[]>;
  previewRecords: ReportPreviewRecord[];
  previewCount?: number;
  previewError?: string;
  previewCurrency: string;
  previewScope?: string;
  onPreview?: (draft: ReportCreateDraft) => void;
  onDownloadReport?: (draft: ReportCreateDraft) => void;
  onSendReportEmail?: (draft: ReportCreateDraft) => void;
  notify: (message: string) => void;
}) {
  const [entitySearch, setEntitySearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewRequested, setPreviewRequested] = useState(false);
  const entities = entitiesByType[draft.entityType] ?? [];
  const selectedClientName = draft.entityType === "client" && !draft.allEntities && draft.entityIds.length === 1
    ? entities.find((entity) => entity.id === draft.entityIds[0])?.name
    : undefined;
  const displayColumn = (column: string) => reportCenterDisplayColumn(column, draft.entityType, selectedClientName);
  const modules = modulesByType[draft.entityType] ?? DEFAULT_MODULES[draft.entityType];
  const effectiveModule = modules.includes(draft.module) ? draft.module : modules[0] ?? "";
  const groups = columnsByModule[effectiveModule] ?? DEFAULT_COLUMNS[effectiveModule] ?? [];
  const canonicalColumns = groups.flatMap((group) => group.columns);
  const orderSelectedColumns = (columns: string[]) => {
    const selected = new Set(columns);
    const canonical = new Set(canonicalColumns);
    return [
      ...canonicalColumns.filter((column) => selected.has(column)),
      ...columns.filter((column) => !canonical.has(column)),
    ];
  };
  const selectedColumns = orderSelectedColumns(draft.selectedColumns);
  const filteredEntities = entities.filter((entity) => entity.name.toLowerCase().includes(entitySearch.toLowerCase()));
  const filteredColumns = groups.map((group) => ({
    ...group,
    columns: group.columns.filter((column) => column.toLowerCase().includes(columnSearch.toLowerCase())),
  })).filter((group) => group.columns.length > 0);
  const selectedEntities = draft.allEntities ? entities.length : draft.entityIds.length;
  const fieldCount = selectedColumns.length;
  const moneyColumns = selectedColumns.some((column) => /price|amount|total|cost/i.test(column));
  const toggleColumn = (column: string) => {
    const next = selectedColumns.includes(column)
      ? selectedColumns.filter((item) => item !== column)
      : [...selectedColumns, column];
    updateDraft({ selectedColumns: orderSelectedColumns(next) });
  };
  const toggleEntity = (id: string) => {
    const next = draft.entityIds.includes(id) ? draft.entityIds.filter((entityId) => entityId !== id) : [...draft.entityIds, id];
    updateDraft({ entityIds: next });
  };
  const submitDownload = () => {
    const downloadDraft = { ...draft, selectedColumns, delivery: "download" as const };
    updateDraft({ delivery: "download" });
    if (onDownloadReport) onDownloadReport(downloadDraft);
    else notify("Report download requested.");
  };
  const submitEmail = () => {
    if (!draft.recipients.trim()) { notify("Add at least one email recipient."); return; }
    const emailDraft = { ...draft, selectedColumns, delivery: "email" as const };
    updateDraft({ delivery: "email" });
    if (onSendReportEmail) onSendReportEmail(emailDraft);
    else notify("Report email requested.");
  };
  const showPreview = () => {
    setPreviewRequested(true);
    setPreviewVisible((visible) => !visible);
    onPreview?.({ ...draft, selectedColumns });
  };
  const toggleAllColumns = () => {
    const displayed = filteredColumns.flatMap((group) => group.columns);
    const everySelected = displayed.length > 0 && displayed.every((column) => selectedColumns.includes(column));
    const next = everySelected
      ? selectedColumns.filter((column) => !displayed.includes(column))
      : [...new Set([...selectedColumns, ...displayed])];
    updateDraft({ selectedColumns: orderSelectedColumns(next) });
  };
  return (
    <>
      <section className="rc-card rc-section">
        <div className="rc-section-title">1. Select report type</div>
        <div className="rc-report-types">
          {(Object.keys(ENTITY_INFO) as ReportEntityType[]).map((type) => {
            const info = ENTITY_INFO[type];
            const active = draft.entityType === type;
            return <button type="button" key={type} aria-pressed={active} className={`rc-type ${active ? "active" : ""}`} onClick={() => updateDraft({ entityType: type, entityIds: [], allEntities: false, module: (modulesByType[type] ?? DEFAULT_MODULES[type])[0] ?? "", selectedColumns: [] })}>
              <span className="rc-type-icon"><info.Icon /></span><span className="rc-type-copy"><strong>{info.title}</strong><small>{info.detail}</small></span><span className="rc-type-check">{active && <Check />}</span>
            </button>;
          })}
        </div>
      </section>
      <div className="rc-two-col" style={{ marginTop: 9 }}>
        <section className="rc-card rc-section">
          <div className="rc-section-title">2. Select {draft.entityType === "client" ? "clients" : draft.entityType === "vendor" ? "vendors" : "departments"}</div>
          <div className="rc-entity-radios">
            <label className="rc-radio-label"><input type="radio" name="rc-entities" checked={draft.allEntities} onChange={() => updateDraft({ allEntities: true, entityIds: [] })} /> All {draft.entityType === "internal" ? "departments" : `${draft.entityType}s`}</label>
            <label className="rc-radio-label"><input type="radio" name="rc-entities" checked={!draft.allEntities} onChange={() => updateDraft({ allEntities: false })} /> Selected {draft.entityType === "internal" ? "departments" : `${draft.entityType}s`}</label>
          </div>
          <div className="rc-search-wrap"><Search /><input className="rc-search" value={entitySearch} onChange={(event) => setEntitySearch(event.target.value)} placeholder={`Search and select ${draft.entityType === "internal" ? "departments" : `${draft.entityType}s`}...`} /></div>
          <div className="rc-entity-list">
            {filteredEntities.length ? filteredEntities.map((entity) => <label key={entity.id} className="rc-check-label">
              <input type="checkbox" checked={draft.allEntities || draft.entityIds.includes(entity.id)} disabled={draft.allEntities} onChange={() => toggleEntity(entity.id)} />{entity.name}
            </label>) : <div className="rc-entity-empty">{entities.length ? "No matching entities." : "No entities available."}</div>}
          </div>
        </section>
        <section className="rc-card rc-section">
          <div className="rc-section-title">3. Select module</div>
          <div style={{ position: "relative" }}>
            <select className="rc-form-control" aria-label="Select report module" value={effectiveModule} onChange={(event) => updateDraft({ module: event.target.value, selectedColumns: [] })}>
              {modules.map((module) => <option key={module} value={module}>{module}</option>)}
            </select><ChevronDown style={{ position: "absolute", right: 9, top: 8, width: 13, height: 13, pointerEvents: "none", color: "#68717f" }} />
          </div>
          <div className="rc-module-pills">{modules.map((module) => <button key={module} type="button" className={`rc-chip ${effectiveModule === module ? "active" : ""}`} onClick={() => updateDraft({ module, selectedColumns: [] })}>{module}</button>)}</div>
        </section>
      </div>
      <section className="rc-card rc-section">
        <div className="rc-section-title">4. Choose columns</div>
        <div className="rc-columns-head">
          <div className="rc-search-wrap"><Search /><input className="rc-search" aria-label="Search columns" value={columnSearch} onChange={(event) => setColumnSearch(event.target.value)} placeholder="Search columns..." /></div>
          <button type="button" className="rc-button" onClick={toggleAllColumns}>{filteredColumns.flatMap((group) => group.columns).every((column) => selectedColumns.includes(column)) ? "Deselect all" : "Select all"}</button>
          <button type="button" className="rc-button" onClick={() => updateDraft({ selectedColumns: [] })}>Clear</button>
        </div>
        <div className="rc-columns-grid">
          {filteredColumns.length ? filteredColumns.flatMap((group) => group.columns).map((column) => <label key={column} className="rc-column-label"><input type="checkbox" checked={selectedColumns.includes(column)} onChange={() => toggleColumn(column)} />{displayColumn(column)}</label>) : <span className="rc-help">No columns match your search.</span>}
        </div>
      </section>
      <div className="rc-bottom-grid">
        <section className="rc-card rc-section">
          <div className="rc-section-title">5. Date range</div>
          <div className="rc-date-grid">
            <label><span className="rc-field-label">Date basis</span><select className="rc-form-control" value={draft.dateBasis} onChange={(event) => updateDraft({ dateBasis: event.target.value })}><option>Created date</option><option>Updated date</option><option>Order date</option><option>Delivery date</option></select></label>
            <label><span className="rc-field-label">From</span><input className="rc-form-control" type="date" value={draft.dateFrom} onChange={(event) => updateDraft({ dateFrom: event.target.value })} /></label>
            <label><span className="rc-field-label">To</span><input className="rc-form-control" type="date" value={draft.dateTo} onChange={(event) => updateDraft({ dateTo: event.target.value })} /></label>
          </div>
        </section>
        <section className="rc-card rc-section">
          <div className="rc-section-title">6. Export format</div>
          <div className="rc-format-row">{FORMATS.map((format) => <label key={format} className={`rc-format-option ${draft.format === format ? "active" : ""}`}><input type="radio" name="rc-format" checked={draft.format === format} onChange={() => updateDraft({ format })} />{format === "Excel" ? <FileSpreadsheet /> : <FileText />}{format === "Excel" ? "Excel (.xlsx)" : format}</label>)}</div>
        </section>
      </div>
      <section className="rc-card rc-section" style={{ marginTop: 9 }}>
        <div className="rc-section-title">7. Delivery</div>
        <div className="rc-delivery">
          <label className="rc-delivery-choice"><input type="radio" name="rc-delivery" checked={draft.delivery === "download"} onChange={() => updateDraft({ delivery: "download" })} /><span><strong><Download />Download now</strong><small>Generate and download with your selected options.</small></span></label>
          <label className="rc-delivery-choice"><input type="radio" name="rc-delivery" checked={draft.delivery === "email"} onChange={() => updateDraft({ delivery: "email" })} /><span><strong><Mail />Send email</strong><small>Email the report to one or more recipients.</small></span></label>
        </div>
        {draft.delivery === "email" && <div style={{ marginTop: 7 }}><label className="rc-field-label" htmlFor="rc-email-recipients">Email recipients</label><input id="rc-email-recipients" className="rc-form-control" value={draft.recipients} onChange={(event) => updateDraft({ recipients: event.target.value })} placeholder="name@company.com, another@company.com" /></div>}
      </section>
      <p className="rc-error-note">{!selectedEntities ? `Select at least one ${draft.entityType === "internal" ? "department" : `${draft.entityType}s`}.` : ""}</p>
      {previewVisible && <section className="rc-card rc-section">
        <div className="rc-section-title">
          <span>
            Report preview <span style={{ color: "#9299a3", fontWeight: 400 }}>· Selected columns only</span>
            {previewScope && <span style={{ display: "block", color: "#68717f", fontSize: 9, fontWeight: 400, marginTop: 3 }}>{previewScope}</span>}
          </span>
          <span style={{ color: "#9299a3", fontSize: 9 }}>Showing {Math.min(previewRecords.length, 5)} of {previewCount ?? previewRecords.length} rows</span>
        </div>
        {previewRequested && !previewRecords.length && <span className="rc-help">Preview refreshed from the current selection.</span>}
          <div className="rc-preview-table"><table><thead><tr>{selectedColumns.map((column) => <th key={column}>{displayColumn(column)}{/price|amount|total/i.test(column) ? ` (${previewCurrency})` : ""}</th>)}</tr></thead>
          <tbody>{previewRecords.length && selectedColumns.length ? previewRecords.slice(0, 5).map((record) => <tr key={record.id}>{selectedColumns.map((column) => <td key={column}>{record.values[column] ?? "—"}</td>)}</tr>) : <tr><td className="rc-empty" colSpan={Math.max(selectedColumns.length, 1)}>{previewError || "No stored records match this selection. Try another entity or date range."}</td></tr>}</tbody>
        </table></div>
      </section>}
      <div className="rc-sticky-preview" style={{ bottom: 0, top: "auto", marginTop: 8, marginBottom: 0 }}>
         <div className="rc-preview-meta"><button type="button" className="rc-button" onClick={showPreview}><Eye />Preview</button><span>{previewCount ?? previewRecords.length} records · {fieldCount} columns{moneyColumns ? ` · ${previewCurrency}` : ""}</span></div>
        <div className="rc-action-group"><button type="button" className="rc-button primary" onClick={submitDownload}><Download />Download Report</button><button type="button" className="rc-button" onClick={submitEmail}><Mail />Send Email</button></div>
      </div>
    </>
  );
}

function NewScheduleDialog({ onClose, onSave, modulesByType, entitiesByType, initial }: {
  onClose: () => void;
  onSave: (schedule: NewReportSchedule) => void;
  modulesByType: Partial<Record<ReportEntityType, string[]>>;
  entitiesByType: Partial<Record<ReportEntityType, ReportEntity[]>>;
  initial?: NewReportSchedule;
}) {
  const initialModules = modulesByType.vendor ?? DEFAULT_MODULES.vendor;
  const [draft, setDraft] = useState<NewReportSchedule>(initial ?? { name: "", reportType: "Vendor", module: initialModules[0] ?? "", frequency: "Weekly", recipients: "", dateRange: "Saved per schedule", entityIds: [], allEntities: false });
  const [entityIds, setEntityIds] = useState<string[]>(initial?.entityIds ?? []);
  const [allEntities, setAllEntities] = useState(initial?.allEntities ?? false);
  const [formError, setFormError] = useState("");
  const set = (key: "name" | "reportType" | "module" | "frequency" | "recipients" | "dateRange", value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const reportTypeKey: ReportEntityType = draft.reportType === "Client" ? "client" : draft.reportType === "Nido Internal" ? "internal" : "vendor";
  const modules = modulesByType[reportTypeKey] ?? DEFAULT_MODULES[reportTypeKey];
  const entities = entitiesByType[reportTypeKey] ?? [];
  const entityLabel = reportTypeKey === "client" ? "clients" : reportTypeKey === "vendor" ? "vendors" : "departments";
  const save = () => {
    const recipients = [...new Set(draft.recipients.split(/[;,]/).map((address) => address.trim()).filter(Boolean))];
    if (!draft.name.trim()) { setFormError("Enter a schedule name."); return; }
    if (!recipients.length) { setFormError("Add at least one email recipient."); return; }
    if (recipients.some((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) {
      setFormError("Enter valid email addresses, separated by commas.");
      return;
    }
    if (!allEntities && entityIds.length === 0) { setFormError("Select at least one entity or choose All."); return; }
    setFormError("");
    onSave({ ...draft, entityIds, allEntities });
  };
  return <div className="rc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="rc-card rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-new-schedule-title">
      <div className="rc-modal-head"><div><h2 id="rc-new-schedule-title">New Schedule</h2><p>Choose what to send, how often, and who should receive it.</p></div><IconButton label="Close dialog" onClick={onClose}><X /></IconButton></div>
      <div className="rc-modal-grid">
        <label><span className="rc-field-label">Schedule name</span><input className="rc-form-control" value={draft.name} onChange={(event) => set("name", event.target.value)} placeholder="e.g. Weekly vendor stock" /></label>
        <label><span className="rc-field-label">Report type</span><select className="rc-form-control" value={draft.reportType} onChange={(event) => { const type = event.target.value; const key: ReportEntityType = type === "Client" ? "client" : type === "Nido Internal" ? "internal" : "vendor"; setDraft((current) => ({ ...current, reportType: type, module: (modulesByType[key] ?? DEFAULT_MODULES[key])[0] ?? "" })); setEntityIds([]); setAllEntities(false); }}><option>Client</option><option>Vendor</option><option>Nido Internal</option></select></label>
        <label><span className="rc-field-label">Module</span><select className="rc-form-control" value={draft.module} onChange={(event) => set("module", event.target.value)}>{modules.map((module) => <option key={module}>{module}</option>)}</select></label>
        <label><span className="rc-field-label">Frequency</span><select className="rc-form-control" value={draft.frequency} onChange={(event) => set("frequency", event.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></select></label>
        <label><span className="rc-field-label">Recipients</span><input className="rc-form-control" value={draft.recipients} onChange={(event) => set("recipients", event.target.value)} placeholder="Email addresses, comma separated" /></label>
        <label><span className="rc-field-label">Date range</span><select className="rc-form-control" value={draft.dateRange} onChange={(event) => set("dateRange", event.target.value)}><option>Saved per schedule</option><option>Last 7 days</option><option>Last 30 days</option><option>This month</option><option>Previous month</option></select></label>
        <div className="rc-schedule-entities">
          <span className="rc-field-label">Entity scope</span>
          <div className="rc-entity-radios">
            <label className="rc-radio-label"><input type="radio" name="rc-schedule-entities" checked={allEntities} onChange={() => { setAllEntities(true); setEntityIds([]); }} /> All {entityLabel}</label>
            <label className="rc-radio-label"><input type="radio" name="rc-schedule-entities" checked={!allEntities} onChange={() => setAllEntities(false)} /> Selected {entityLabel}</label>
          </div>
          <div className="rc-schedule-entity-list">{entities.length ? entities.map((entity) => <label key={entity.id} className="rc-check-label">
            <input type="checkbox" checked={allEntities || entityIds.includes(entity.id)} disabled={allEntities} onChange={() => setEntityIds((current) => current.includes(entity.id) ? current.filter((id) => id !== entity.id) : [...current, entity.id])} />{entity.name}
          </label>) : <span className="rc-help">No {entityLabel} are available.</span>}</div>
        </div>
      </div>
      {formError && <div className="rc-form-error" role="alert">{formError}</div>}
      <div className="rc-modal-footer"><button type="button" className="rc-button" onClick={onClose}>Cancel</button><button type="button" className="rc-button primary" onClick={save} disabled={!draft.name.trim() || !draft.recipients.trim() || (!allEntities && entityIds.length === 0)}><Plus />{initial ? "Save changes" : "Create schedule"}</button></div>
    </section>
  </div>;
}

function ScheduledReportsView({
  records,
  deliveries,
  modulesByType,
  entitiesByType,
  deliveryTimezone,
  savedDateRange,
  onCreateSchedule,
  onRunSchedule,
  onEditSchedule,
  onPauseSchedule,
  onResumeSchedule,
  onDeleteSchedule,
  onConnectDelivery,
  onViewScheduleHistory,
  notify,
}: {
  records: ScheduledReportRecord[];
  deliveries: RecentDeliveryRecord[];
  modulesByType: Partial<Record<ReportEntityType, string[]>>;
  entitiesByType: Partial<Record<ReportEntityType, ReportEntity[]>>;
  deliveryTimezone: string;
  savedDateRange: string;
  onCreateSchedule?: (schedule: NewReportSchedule) => void;
  onRunSchedule?: (record: ScheduledReportRecord) => void;
  onEditSchedule?: (record: ScheduledReportRecord) => void;
  onPauseSchedule?: (record: ScheduledReportRecord) => void;
  onResumeSchedule?: (record: ScheduledReportRecord) => void;
  onDeleteSchedule?: (record: ScheduledReportRecord) => void;
  onConnectDelivery?: (password: string) => void;
  onViewScheduleHistory?: () => void;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [frequencyFilter, setFrequencyFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledReportRecord | null>(null);
  const pageSize = 10;
  const rows = records;
  const filtered = rows.filter((record) => {
    const searchMatch = `${record.name} ${record.scope} ${record.module} ${record.recipients.join(" ")}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (typeFilter === "All" || record.reportType === typeFilter) && (statusFilter === "All" || record.status === statusFilter.toLowerCase()) && (frequencyFilter === "All" || record.frequency === frequencyFilter);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = rows.filter((record) => record.status === "active").length;
  const pausedCount = rows.filter((record) => record.status === "paused").length;
  const next = rows.filter((record) => record.status === "active" && record.nextRun).map((record) => record.nextRun).sort()[0];
  const viewHistory = () => { onViewScheduleHistory?.(); notify("Showing recent report deliveries."); };
  const saveSchedule = (schedule: NewReportSchedule) => {
    if (editing) {
      onEditSchedule?.(editing, schedule);
    } else {
      onCreateSchedule?.(schedule);
    }
    setDialogOpen(false);
    setEditing(null);
    notify(editing ? "Schedule updated." : "Schedule created.");
  };
  return <>
    <section className="rc-card rc-section">
      <div className="rc-section-title"><span><span style={{ display: "block", fontSize: 13 }}>Scheduled Reports</span><span style={{ display: "block", fontSize: 9, fontWeight: 400, color: "#8b929d", marginTop: 3 }}>Create and manage recurring report delivery settings.</span></span><button type="button" className="rc-button primary" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus />New Schedule</button></div>
      <div className="rc-summary-grid">
        <SummaryTile icon={<Play />} label="Active schedules" value={activeCount} />
        <SummaryTile icon={<Pause />} label="Paused schedules" value={pausedCount} tone="amber" />
        <SummaryTile icon={<CalendarDays />} label="Next delivery" value={next ?? "—"} />
      </div>
      <div className="rc-card rc-toolbar">
        <div className="rc-toolbar-line">
          <div className="rc-search-wrap rc-toolbar-search"><Search /><input className="rc-search" aria-label="Search schedules" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search schedules..." /></div>
          <label className="rc-filter">Report type <select className="rc-form-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All</option><option>Client</option><option>Vendor</option><option>Nido Internal</option></select></label>
          <label className="rc-filter">Status <select className="rc-form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
          <label className="rc-filter">Frequency <select className="rc-form-control" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)}><option>All</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></select></label>
        </div>
      </div>
      <div className="rc-card rc-table"><table><thead><tr>{["Report name & scope", "Module", "Frequency", "Recipients", "Next run (IST)", "Status", "Actions"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{paged.length ? paged.map((record) => <tr key={record.id}>
          <td><div className="rc-row-title">{record.name}</div><div className="rc-row-sub">{record.scope}</div></td><td>{record.module}</td><td>{record.frequency}</td><td>{record.recipients.join(", ") || "—"}</td><td>{record.nextRun || "—"}</td><td><span className={`rc-status ${record.status === "paused" ? "paused" : ""}`}>{record.status === "active" ? "Active" : "Paused"}</span></td>
          <td><div className="rc-row-actions">
            <IconButton label="Run now" onClick={() => { if (onRunSchedule) void onRunSchedule(record); else notify("Run action is unavailable."); }}><Play /></IconButton>
            <IconButton label="Edit schedule" onClick={() => { setEditing(record); setDialogOpen(true); }}><Settings2 /></IconButton>
            {record.status === "active" ? <IconButton label="Pause schedule" onClick={() => { onPauseSchedule?.(record); notify("Schedule paused."); }}><Pause /></IconButton> : <IconButton label="Resume schedule" onClick={() => { onResumeSchedule?.(record); notify("Schedule resumed."); }}><Play /></IconButton>}
            <IconButton label="Delete schedule" danger onClick={() => { if (window.confirm(`Delete the schedule “${record.name}”?`)) { onDeleteSchedule?.(record); notify("Schedule deleted."); } }}><Trash2 /></IconButton>
          </div></td>
        </tr>) : <tr><td className="rc-table-empty" colSpan={7}>{records.length ? "No schedules match these filters." : "Connect delivery below to view and manage saved schedules."}</td></tr>}</tbody>
      </table></div>
      <div className="rc-pager"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div className="rc-pager-actions">
        <button type="button" className="rc-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>{page} / {pages}</span><button type="button" className="rc-button" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</button>
      </div></div>
    </section>
    <div className="rc-lower-grid">
      <section className="rc-card rc-section">
        <div className="rc-section-title">Delivery settings</div>
        <div className="rc-inline-fields"><label><span className="rc-field-label">Timezone</span><input className="rc-form-control" value={deliveryTimezone} readOnly aria-label="Timezone" /></label><label><span className="rc-field-label">Date range</span><input className="rc-form-control" value={savedDateRange} readOnly aria-label="Saved date range" /></label></div>
        <hr className="rc-divider" />
        <div className="rc-connect-title"><span>▾ Connect report delivery</span><ChevronDown style={{ width: 12, height: 12 }} /></div>
        <div className="rc-connect-form">
          <input className="rc-form-control" value="Configure delivery in platform Email Settings" readOnly aria-label="Email delivery settings" />
          <button type="button" className="rc-button primary" onClick={() => onConnectDelivery?.()}>Connect</button>
        </div>
        <p className="rc-note">Email reports use the platform’s configured email service. Downloads work without email setup.</p>
        <p className="rc-note">Automatic runs are checked while this Reports page is open. Keep it open and online for scheduled delivery.</p>
      </section>
      <section className="rc-card rc-section">
        <div className="rc-section-title"><span>Recent deliveries</span><button type="button" className="rc-button" onClick={viewHistory}>View report history <ChevronRight /></button></div>
        <div className="rc-table"><table><thead><tr><th>Report name</th><th>Delivered on (IST)</th><th>Status</th></tr></thead>
          <tbody>{deliveries.length ? deliveries.slice(0, 5).map((delivery) => <tr key={delivery.id}><td>{delivery.reportName}</td><td>{delivery.deliveredAt}</td><td>{delivery.status}</td></tr>) : <tr><td colSpan={3} className="rc-table-empty">No report emails have run yet.</td></tr>}</tbody>
        </table></div>
      </section>
    </div>
    {dialogOpen && <NewScheduleDialog
      key={editing?.id ?? "new-schedule"}
      onClose={() => { setDialogOpen(false); setEditing(null); }}
      onSave={saveSchedule}
      modulesByType={modulesByType}
      entitiesByType={entitiesByType}
      initial={editing ? {
        id: editing.id,
        name: editing.name,
        reportType: editing.reportType,
        module: editing.module,
        frequency: editing.frequency,
        recipients: editing.recipients.join(", "),
        dateRange: "Saved per schedule",
        entityIds: editing.entityIds ?? [],
        allEntities: editing.allEntities ?? false,
      } : undefined}
    />}
  </>;
}

function HistoryView({ records, onRefreshHistory, onDownloadRecord, notify }: {
  records: ReportHistoryRecord[];
  onRefreshHistory?: () => void;
  onDownloadRecord?: (record: ReportHistoryRecord) => void;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [formatFilter, setFormatFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const completedCount = records.filter((record) => record.status === "completed").length;
  const failedCount = records.filter((record) => record.status === "failed").length;
  const filtered = records.filter((record) => {
    const query = `${record.name} ${record.scope}`.toLowerCase();
    const inFrom = !from || record.generatedAt.slice(0, 10) >= from;
    const inTo = !to || record.generatedAt.slice(0, 10) <= to;
    return query.includes(search.toLowerCase()) && (typeFilter === "All" || record.scope === typeFilter) && (sourceFilter === "All" || record.source === sourceFilter) && (statusFilter === "All" || record.status === statusFilter) && (formatFilter === "All" || record.format === formatFilter) && inFrom && inTo;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const clearFilters = () => { setSearch(""); setTypeFilter("All"); setSourceFilter("All"); setStatusFilter("All"); setFormatFilter("All"); setFrom(""); setTo(""); setPage(1); };
  const options = (key: "scope" | "source") => [...new Set(records.map((record) => record[key]).filter(Boolean))];
  return <section className="rc-card rc-section">
    <div className="rc-section-title"><span><span style={{ display: "block", fontSize: 13 }}>Report History</span><span style={{ display: "block", fontSize: 9, fontWeight: 400, color: "#8b929d", marginTop: 3 }}>Review manual reports and scheduled runs in one place.</span></span><button type="button" className="rc-button" onClick={() => { onRefreshHistory?.(); notify("Report history refreshed."); }}><RefreshCw />Refresh</button></div>
    <div className="rc-summary-grid">
      <SummaryTile icon={<FileText />} label="Total reports" value={records.length} />
      <SummaryTile icon={<CheckCircle2 />} label="Completed" value={completedCount} tone="green" />
      <SummaryTile icon={<CircleAlert />} label="Failed" value={failedCount} tone="red" />
    </div>
    <div className="rc-card rc-toolbar">
      <div className="rc-toolbar-line">
        <div className="rc-search-wrap rc-toolbar-search"><Search /><input className="rc-search" aria-label="Search report name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search report name..." /></div>
        <label className="rc-filter">Report type <select className="rc-form-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All</option>{options("scope").map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="rc-filter">Source <select className="rc-form-control" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All</option>{options("source").map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="rc-filter">Status <select className="rc-form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="running">Running</option></select></label>
        <label className="rc-filter">Format <select className="rc-form-control" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}><option>All</option>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select></label>
      </div>
      <div className="rc-toolbar-line"><span className="rc-filter">Generated date range</span><input className="rc-form-control" aria-label="Generated from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} style={{ width: 106 }} /><span className="rc-filter">to</span><input className="rc-form-control" aria-label="Generated to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} style={{ width: 106 }} /><button type="button" className="rc-button" onClick={clearFilters}>Clear filters</button></div>
    </div>
    <div className="rc-card rc-table"><table><thead><tr>{["Report & scope", "Generated on (IST)", "Report period", "Source", "Delivery", "Status", "Actions"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
      <tbody>{paged.length ? paged.map((record) => <tr key={record.id}>
         <td><div className="rc-row-title">{record.name}</div><div className="rc-row-sub">{record.scopeDetail || record.scope}</div></td><td>{record.generatedAt}</td><td>{record.period || "—"}</td><td>{record.source}</td><td>{record.delivery}</td><td><span className={`rc-status ${record.status === "failed" ? "failed" : record.status === "running" ? "paused" : ""}`}>{record.status[0].toUpperCase() + record.status.slice(1)}</span></td><td><div className="rc-row-actions"><IconButton label="Download report" onClick={() => { onDownloadRecord?.(record); notify(onDownloadRecord ? `Download requested: ${record.name}.` : "Report download requested."); }}><Download /></IconButton></div></td>
      </tr>) : <tr><td colSpan={7} className="rc-table-empty">{records.length ? "No report history matches. Adjust the filters and try again." : "No report history matches. Generate a report to see it here."}</td></tr>}</tbody>
    </table></div>
    <div className="rc-pager"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><div className="rc-pager-actions">
      <button type="button" className="rc-button" aria-label="First page" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft /></button>
      <button type="button" className="rc-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></button>
      <span>{page} / {pages}</span>
      <button type="button" className="rc-button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}><ChevronRight /></button>
      <button type="button" className="rc-button" aria-label="Last page" disabled={page >= pages} onClick={() => setPage(pages)}><ChevronsRight /></button>
      <select className="rc-form-control" aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} style={{ width: 83, minHeight: 26, padding: "4px 5px" }}>{HISTORY_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}</select>
    </div></div>
  </section>;
}

export default function ReportsCenterUI(props: ReportsCenterUIProps) {
  const [localActiveTab, setLocalActiveTab] = useState<ReportsCenterTab>(props.initialTab ?? "create");
  const activeTab = props.activeTab ?? localActiveTab;
  const [localDraft, setLocalDraft] = useState<ReportCreateDraft>(props.createDraft ?? EMPTY_DRAFT);
  const [notice, notify] = useNotice();
  const draft = props.createDraft ?? localDraft;
  const updateDraft = (change: Partial<ReportCreateDraft>) => {
    const next = { ...draft, ...change };
    setLocalDraft(next);
    props.onCreateDraftChange?.(next);
  };
  const setTab = (tab: ReportsCenterTab) => { setLocalActiveTab(tab); props.onTabChange?.(tab); };
  const intro = activeTab === "create"
    ? { subtitle: "Choose your data, columns and delivery options." }
    : activeTab === "scheduled"
      ? { subtitle: "Create and manage automatic report delivery." }
      : { subtitle: "Track generated reports, downloads and email deliveries." };
  return <main className="rc-root">
    <div className="rc-workspace">
      <header className="rc-heading"><h1>Reports</h1><p>{intro.subtitle}</p></header>
      <ReportsTabs active={activeTab} onChange={setTab} />
      {activeTab === "create" && <CreateReportView
        draft={draft}
        updateDraft={updateDraft}
        entitiesByType={props.entitiesByType ?? {}}
        modulesByType={props.modulesByType ?? {}}
        columnsByModule={props.columnsByModule ?? {}}
        previewRecords={props.previewRecords ?? []}
        previewCount={props.previewCount}
        previewError={props.previewError}
        previewCurrency={props.previewCurrency ?? "INR"}
        previewScope={props.previewScope}
        onPreview={props.onPreview}
        onDownloadReport={props.onDownloadReport}
        onSendReportEmail={props.onSendReportEmail}
        notify={notify}
      />}
      {activeTab === "scheduled" && <ScheduledReportsView
        records={props.scheduledReports ?? []}
        deliveries={props.recentDeliveries ?? []}
        modulesByType={props.modulesByType ?? {}}
        entitiesByType={props.entitiesByType ?? {}}
        deliveryTimezone={props.deliveryTimezone ?? "Asia/Kolkata (IST)"}
        savedDateRange={props.savedDateRange ?? "Saved per schedule"}
        onCreateSchedule={props.onCreateSchedule}
        onRunSchedule={props.onRunSchedule}
        onEditSchedule={props.onEditSchedule}
        onPauseSchedule={props.onPauseSchedule}
        onResumeSchedule={props.onResumeSchedule}
        onDeleteSchedule={props.onDeleteSchedule}
        onConnectDelivery={props.onConnectDelivery}
        onViewScheduleHistory={props.onViewScheduleHistory}
        notify={notify}
      />}
      {activeTab === "history" && <HistoryView
        records={props.historyRecords ?? []}
        onRefreshHistory={props.onRefreshHistory}
        onDownloadRecord={props.onDownloadHistoryRecord}
        notify={notify}
      />}
    </div>
    {notice && <div role="status" className="rc-toast">{notice}</div>}
  </main>;
}
