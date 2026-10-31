import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReportsCenterUI, {
  type NewReportSchedule,
  type ReportCreateDraft,
  type ReportEntity,
  type ReportEntityType,
  type ReportHistoryRecord,
  type ReportsCenterTab,
  type ScheduledReportRecord,
} from "@/components/reports/report-center/ReportsCenterUI";
import {
  REPORT_CENTER_COLUMNS,
  REPORT_CENTER_MODULES,
  filterReportCenterRecords,
  getReportCenterEntities,
  getReportCenterExportData,
  getReportCenterPreview,
  getReportCenterRows,
  loadReportCenterRecords,
  getReportCenterDefaultColumns,
  getReportCenterColumnsForRecords,
  getReportCenterMappedColumns,
  getReportCenterCellValue,
  isReportCenterProductListColumn,
  orderReportCenterColumns,
  withReportRunMetadata,
} from "@/lib/reportCenterData";
import {
  deleteReportCenterSchedule,
  getReportCenterHistory,
  getReportCenterSchedules,
  saveReportCenterHistory,
  saveReportCenterSchedule,
  updateReportCenterSchedule,
  reportCenterUpdatedEventName,
  type StoredReportCenterHistory,
  type StoredReportCenterSchedule,
} from "@/lib/reportCenterStore";
import { createReportExportAttachment, downloadReportExport } from "@/lib/reportExport";
import { sendEmail } from "@/lib/emailApi";
import { loadConfig } from "@/lib/configService";
import { toast } from "@/hooks/use-toast";
import { reportCenterDisplayColumn } from "@/lib/reportHeaderUtils";

const INITIAL_DRAFT: ReportCreateDraft = {
  entityType: "vendor",
  entityIds: [],
  allEntities: false,
  module: REPORT_CENTER_MODULES.vendor[0],
  selectedColumns: getReportCenterDefaultColumns(REPORT_CENTER_MODULES.vendor[0]),
  dateBasis: "Created date",
  dateFrom: "",
  dateTo: "",
  format: "Excel",
  delivery: "download",
  recipients: "",
};

const LIVE_DATA_EVENTS = [
  "nidoVendorsUpdated",
  "supportTicketsUpdated",
  "nidoQuotesUpdated",
  "taxEngineUpdated",
  "priceEngineSettingsUpdated",
  "slaEngineUpdated",
  "nidoClientsUpdated",
  "nidoClientDataUpdated",
  "serviceRequestsUpdated",
  "nidoInvoicesUpdated",
  "nidoSalesOrdersUpdated",
  "catalogUpdated",
  "vendorProductsUpdated",
  "clientCatalogUpdated",
  "nidoPaymentReceiptsUpdated",
  "recurringInvoicesUpdated",
  "stockHistoryUpdated",
  "stockThresholdsUpdated",
  "nidoPurchasePaymentsUpdated",
  "nidoPortalRolesUpdated",
  "nidoPortalUsersUpdated",
  "nidoUserNotesUpdated",
  "nidoUserDocumentsUpdated",
  "nidoAutoAssignmentUpdated",
  "nidoOrderStatusConfigUpdated",
  "nidoPermissionsUpdated",
  "nidoCustomModulesUpdated",
  "nidoUsersUpdated",
  "nidoConfigRolesUpdated",
  "nidoCustomReportsUpdated",
  "poCreated",
  "poCancelled",
  "poActivityUpdated",
  "orderSubItemsUpdated",
  "nidoMyOrdersUpdated",
  "orderFulfillmentStatusUpdated",
  "approvalStoreUpdated",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IST_OFFSET_MS = 330 * 60 * 1000;

function reportTypeName(type: ReportEntityType): string {
  return type === "client" ? "Client" : type === "vendor" ? "Vendor" : "Nido Internal";
}

function reportTypeKey(type: string): ReportEntityType {
  return type === "Client" ? "client" : type === "Nido Internal" ? "internal" : "vendor";
}

function getISTDateKey(date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function formatIST(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)} IST`;
}

function nextRunForFrequency(frequency: string): string {
  const now = new Date();
  const istWallClock = new Date(now.getTime() + IST_OFFSET_MS);
  const next = new Date(Date.UTC(
    istWallClock.getUTCFullYear(),
    istWallClock.getUTCMonth(),
    istWallClock.getUTCDate(),
    9,
  ));
  if (frequency === "Daily") {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === "Weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (frequency === "Monthly") {
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
  } else {
    const nextQuarterMonth = Math.floor(next.getUTCMonth() / 3) * 3 + 3;
    next.setUTCMonth(nextQuarterMonth, 1);
  }
  return formatIST(new Date(next.getTime() - IST_OFFSET_MS));
}

function parseISTDateTime(value: string): number {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) IST$/);
  if (!match) return Number.NaN;
  return new Date(`${match[1]}T${match[2]}:00+05:30`).getTime();
}

function uniqueHistoryColumns(columns: { key: string; label: string }[]): { key: string; label: string }[] {
  const seen = new Set<string>();
  return columns.filter((column) => {
    const identities = [column.key, column.label]
      .map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean);
    if (identities.some((identity) => seen.has(identity))) return false;
    identities.forEach((identity) => seen.add(identity));
    return true;
  });
}

function periodFor(draft: ReportCreateDraft): string {
  if (draft.dateFrom && draft.dateTo) return `${draft.dateFrom} to ${draft.dateTo}`;
  if (draft.dateFrom) return `From ${draft.dateFrom}`;
  if (draft.dateTo) return `Through ${draft.dateTo}`;
  return "All dates";
}

function selectedScope(
  type: ReportEntityType,
  entityIds: string[],
  allEntities: boolean,
  entities: Record<ReportEntityType, ReportEntity[]>,
): string {
  const noun = type === "client" ? "clients" : type === "vendor" ? "vendors" : "departments";
  if (allEntities) return `All ${noun}`;
  const names = (entities[type] ?? []).filter((entity) => entityIds.includes(entity.id)).map((entity) => entity.name);
  if (names.length <= 2) return names.join(", ") || `Selected ${noun}`;
  return `${names.length} selected ${noun}`;
}

function reportScopeHeaderLines(
  draft: ReportCreateDraft,
  entities: Record<ReportEntityType, ReportEntity[]>,
): string[] {
  const label = draft.entityType === "client" ? "Client" : draft.entityType === "vendor" ? "Vendor" : "Department";
  const noun = draft.entityType === "internal" ? "departments" : `${draft.entityType}s`;
  const selectedNames = draft.allEntities
    ? `All ${noun}`
    : draft.entityIds
      .map((id) => entities[draft.entityType].find((entity) => entity.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .join(", ") || `Selected ${noun}`;
  return [`${label}: ${selectedNames}`];
}

function reportHistoryName(
  draft: ReportCreateDraft,
  entities: Record<ReportEntityType, ReportEntity[]>,
): string {
  return `${draft.module} Report — ${selectedScope(draft.entityType, draft.entityIds, draft.allEntities, entities)}`;
}

function displayReportColumns(
  columns: { key: string; label: string }[],
  draft: ReportCreateDraft,
  entities: Record<ReportEntityType, ReportEntity[]>,
  scopeHeader?: string,
): { key: string; label: string }[] {
  const savedClientName = scopeHeader?.match(/^Client:\s*(.+)$/i)?.[1]?.trim();
  const isSavedClientName = savedClientName && !/^(all clients|selected clients)$/i.test(savedClientName);
  const selectedClientName = draft.entityType === "client" && !draft.allEntities && draft.entityIds.length === 1
    ? isSavedClientName || entities.client.find((entity) => entity.id === draft.entityIds[0])?.name
    : undefined;
  return columns.map((column) => ({
    ...column,
    label: reportCenterDisplayColumn(column.label, draft.entityType, selectedClientName),
  }));
}

function rangeForSchedule(draft: ReportCreateDraft, range: string): ReportCreateDraft {
  if (range === "Saved per schedule") return draft;
  const todayKey = getISTDateKey();
  const [year, month, day] = todayKey.split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  let from = todayKey;
  let to = todayKey;

  if (range === "Last 7 days" || range === "Last 30 days") {
    const days = range === "Last 7 days" ? 6 : 29;
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - days);
    from = start.toISOString().slice(0, 10);
  } else if (range === "This month") {
    from = `${year}-${String(month).padStart(2, "0")}-01`;
  } else if (range === "Previous month") {
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const previousYear = previous.getUTCFullYear();
    const previousMonth = previous.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
    from = previous.toISOString().slice(0, 10);
    to = `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  return { ...draft, dateFrom: from, dateTo: to };
}

function scheduleRows(records: StoredReportCenterSchedule[]): ScheduledReportRecord[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    scope: record.draft ? selectedScope(record.draft.entityType, record.entityIds, record.allEntities, getReportCenterEntities()) : record.reportType,
    module: record.module,
    frequency: record.frequency,
    recipients: record.recipients,
    nextRun: record.nextRun,
    status: record.status,
    reportType: record.reportType,
    entityIds: record.entityIds,
    allEntities: record.allEntities,
    draft: record.draft,
  }));
}

function reportDraftForSchedule(
  schedule: NewReportSchedule,
  currentDraft: ReportCreateDraft,
): ReportCreateDraft {
  const type = reportTypeKey(schedule.reportType);
  const sameSelection = currentDraft.entityType === type && currentDraft.module === schedule.module;
  const defaultColumns = getReportCenterDefaultColumns(schedule.module);
  return {
    ...currentDraft,
    entityType: type,
    entityIds: schedule.entityIds,
    allEntities: schedule.allEntities,
    module: schedule.module,
     selectedColumns: orderReportCenterColumns(
       schedule.module,
       sameSelection && currentDraft.selectedColumns.length ? currentDraft.selectedColumns : defaultColumns,
     ),
    dateFrom: schedule.dateRange === "Saved per schedule" && sameSelection ? currentDraft.dateFrom : "",
    dateTo: schedule.dateRange === "Saved per schedule" && sameSelection ? currentDraft.dateTo : "",
    format: sameSelection ? currentDraft.format : "Excel",
    delivery: "email",
    recipients: schedule.recipients,
  };
}

function toastError(title: string, error: unknown): void {
  const description = error instanceof Error ? error.message : String(error);
  toast({ title, description });
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ReportsCenterTab>("create");
  const [draft, setDraft] = useState<ReportCreateDraft>(INITIAL_DRAFT);
  const [entitiesByType, setEntitiesByType] = useState(() => getReportCenterEntities());
  const [sourceRecords, setSourceRecords] = useState<Record<string, unknown>[]>([]);
  const [sourceError, setSourceError] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [storedSchedules, setStoredSchedules] = useState(() => getReportCenterSchedules());
  const [storedHistory, setStoredHistory] = useState(() => getReportCenterHistory());
  const busyRef = useRef(false);
  const scheduleCheckRef = useRef(false);

  const refreshSavedState = () => {
    setEntitiesByType(getReportCenterEntities());
    setStoredSchedules(getReportCenterSchedules());
    setStoredHistory(getReportCenterHistory());
  };

  useEffect(() => {
    const refresh = () => {
      refreshSavedState();
      setReloadToken((token) => token + 1);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const events = [...LIVE_DATA_EVENTS, reportCenterUpdatedEventName()];
    events.forEach((eventName) => window.addEventListener(eventName, refresh));
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      events.forEach((eventName) => window.removeEventListener(eventName, refresh));
    };
  }, []);

  useEffect(() => {
    if (draft.entityType !== "internal" || draft.allEntities) return;
    const availableDepartmentIds = new Set(entitiesByType.internal.map((department) => department.id));
    setDraft((current) => {
      if (current.entityType !== "internal" || current.allEntities) return current;
      const validEntityIds = current.entityIds.filter((id) => availableDepartmentIds.has(id));
      return validEntityIds.length === current.entityIds.length
        ? current
        : { ...current, entityIds: validEntityIds };
    });
  }, [draft.allEntities, draft.entityIds, draft.entityType, entitiesByType.internal]);

  useEffect(() => {
    let active = true;
    setSourceLoading(true);
    setSourceError("");
    setSourceRecords([]);
    loadReportCenterRecords(draft.module, draft.entityType)
      .then((records) => {
        if (active) setSourceRecords(records);
      })
      .catch((error: unknown) => {
        if (active) {
          setSourceRecords([]);
          setSourceError(error instanceof Error ? error.message : "Could not load live records for this module.");
        }
      })
      .finally(() => {
        if (active) setSourceLoading(false);
      });
    return () => { active = false; };
  }, [draft.module, draft.entityType, reloadToken]);

  const filteredRecords = useMemo(
    () => filterReportCenterRecords(sourceRecords, draft, entitiesByType),
    [sourceRecords, draft, entitiesByType],
  );
  const columnsForCurrentRecords = useMemo(
    () => getReportCenterColumnsForRecords(draft.module, sourceRecords),
    [draft.module, sourceRecords],
  );
  const availableColumnsByModule = useMemo(() => ({
    ...REPORT_CENTER_COLUMNS,
    [draft.module]: columnsForCurrentRecords,
  }), [draft.module, columnsForCurrentRecords]);
  const mappedSelectedColumns = useMemo(
    () => getReportCenterMappedColumns(draft.module, draft.selectedColumns, sourceRecords),
    [draft.module, draft.selectedColumns, sourceRecords],
  );
  const previewRecords = useMemo(
    () => getReportCenterPreview(
      withReportRunMetadata(filteredRecords, draft),
      mappedSelectedColumns,
    ),
    [filteredRecords, mappedSelectedColumns, draft],
  );
  const scheduleItems = useMemo(() => scheduleRows(storedSchedules), [storedSchedules]);
  const recentDeliveries = useMemo(
    () => storedHistory.filter((record) => record.delivery === "Email").slice(0, 5).map((record) => ({
      id: record.id,
      reportName: record.name,
      deliveredAt: record.generatedAt,
      status: record.status === "completed" ? "Completed" : "Failed",
    })),
    [storedHistory],
  );
  const currency = loadConfig().localization.currency || "INR";

  const createHistory = useCallback((
    reportDraft: ReportCreateDraft,
    source: string,
    delivery: "Download" | "Email",
    status: "completed" | "failed",
    columns: { key: string; label: string }[],
    rows: Record<string, string>[],
    error?: string,
  ) => {
    const now = new Date();
    const typeName = reportTypeName(reportDraft.entityType);
    const entities = getReportCenterEntities();
    const scopeDetail = selectedScope(reportDraft.entityType, reportDraft.entityIds, reportDraft.allEntities, entities);
    const scopeHeader = reportScopeHeaderLines(reportDraft, entities)[0];
    const record: Omit<StoredReportCenterHistory, "id"> = {
      name: reportHistoryName(reportDraft, entities),
      scope: typeName,
      scopeDetail,
      scopeHeader,
      reportType: typeName,
      module: reportDraft.module,
      generatedAt: formatIST(now),
      generatedAtIso: now.toISOString(),
      period: periodFor(reportDraft),
      source,
      delivery,
      status,
      format: reportDraft.format,
      rowCount: rows.length,
      columns,
      rows,
      draft: { ...reportDraft, recipients: "" },
      error,
    };
    try {
      saveReportCenterHistory(record);
      setStoredHistory(getReportCenterHistory());
    } catch (saveError) {
      console.warn("Report ran but its history entry could not be saved.", saveError);
      toastError("Report history could not be saved", saveError);
    }
  }, [setStoredHistory]);

  const executeReport = useCallback(async (
    reportDraft: ReportCreateDraft,
    source: string,
    delivery: "Download" | "Email",
  ): Promise<boolean> => {
    if (busyRef.current) {
      toast({ title: "A report is already being generated." });
      return false;
    }
    busyRef.current = true;
    let columns: { key: string; label: string }[] = [];
    let rows: Record<string, string>[] = [];
    let status: "completed" | "failed" = "failed";
    let errorMessage = "";
    try {
      if (!reportDraft.allEntities && !reportDraft.entityIds.length) {
        throw new Error("Select at least one entity or choose All before running this report.");
      }
      if (!reportDraft.selectedColumns.length) {
        throw new Error("Choose at least one report column.");
      }
      const entities = getReportCenterEntities();
      const records = await loadReportCenterRecords(reportDraft.module, reportDraft.entityType);
      const selectedRecords = filterReportCenterRecords(records, reportDraft, entities);
      const orderedColumns = getReportCenterMappedColumns(
        reportDraft.module,
        reportDraft.selectedColumns,
        records,
      );
      if (!orderedColumns.length) {
        throw new Error("None of the selected columns have values in the current source records. Choose columns that the module stores.");
      }
      const reportRecords = withReportRunMetadata(selectedRecords, reportDraft);
      columns = getReportCenterExportData(reportRecords, orderedColumns);
      rows = getReportCenterRows(reportRecords, orderedColumns);
      const title = reportHistoryName(reportDraft, entities);
      const headerContext = reportScopeHeaderLines(reportDraft, entities);
      const exportColumns = displayReportColumns(columns, reportDraft, entities);

      if (delivery === "Download") {
        downloadReportExport(reportDraft.format, title, exportColumns, rows, { headerContext });
      } else {
        const recipients = [...new Set(reportDraft.recipients.split(/[;,]/).map((address) => address.trim()).filter(Boolean))];
        if (!recipients.length) throw new Error("Add at least one email recipient.");
        const invalidAddress = recipients.find((address) => !EMAIL_PATTERN.test(address));
        if (invalidAddress) throw new Error(`Invalid email address: ${invalidAddress}`);
        const attachment = createReportExportAttachment(reportDraft.format, title, exportColumns, rows, { headerContext });
        const runKey = `reports-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const results = await Promise.allSettled(recipients.map((to) => sendEmail({
          templateKey: "general_notification",
          to,
          variables: {
            user_name: "there",
            message: `The ${title} is attached. It includes ${rows.length} records for ${periodFor(reportDraft)}.`,
          },
          attachments: [attachment],
          triggerModule: "reports",
          sentBy: "reports",
          dedupeKey: `${runKey}-${to.toLowerCase()}`,
        })));
        const failures = results.flatMap((result, index) => result.status === "rejected"
          ? [`${recipients[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
          : []);
        if (failures.length) {
          const sentCount = recipients.length - failures.length;
          throw new Error(`${sentCount} of ${recipients.length} emails sent. ${failures.join("; ")}`);
        }
      }
      status = "completed";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: delivery === "Email" ? "Report email failed" : "Report download failed", description: errorMessage });
    } finally {
      createHistory(reportDraft, source, delivery, status, columns, rows, errorMessage || undefined);
      busyRef.current = false;
    }
    if (status === "completed") {
      toast({
        title: delivery === "Email" ? "Report emailed" : "Report downloaded",
        description: delivery === "Email" ? "The selected report was sent to the requested recipients." : `${rows.length.toLocaleString()} rows exported.`,
      });
      return true;
    }
    return false;
  }, [createHistory]);

  const executeReportRef = useRef(executeReport);
  useEffect(() => {
    executeReportRef.current = executeReport;
  }, [executeReport]);

  useEffect(() => {
    let active = true;
    const checkDueSchedules = async () => {
      if (!active || scheduleCheckRef.current || busyRef.current) return;
      scheduleCheckRef.current = true;
      try {
        const dueSchedules = getReportCenterSchedules().filter((schedule) =>
          schedule.status === "active" &&
          parseISTDateTime(schedule.nextRun) <= Date.now(),
        );
        for (const schedule of dueSchedules) {
          if (!active || busyRef.current) break;
          const runDraft = rangeForSchedule(
            { ...schedule.draft, delivery: "email", recipients: schedule.recipients.join(", ") },
            schedule.dateRange,
          );
          const sent = await executeReportRef.current(runDraft, "Scheduled", "Email");
          if (!active) break;
          if (sent) {
            updateReportCenterSchedule(schedule.id, { nextRun: nextRunForFrequency(schedule.frequency) });
          } else {
            updateReportCenterSchedule(schedule.id, { status: "paused", nextRun: "" });
            toast({
              title: "Schedule paused after a failed delivery",
              description: `${schedule.name} is paused. Fix the delivery issue, then resume it.`,
            });
          }
          setStoredSchedules(getReportCenterSchedules());
        }
      } finally {
        scheduleCheckRef.current = false;
      }
    };
    const interval = window.setInterval(() => { void checkDueSchedules(); }, 15_000);
    void checkDueSchedules();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const onCreateSchedule = (schedule: NewReportSchedule) => {
    const scheduleDraft = reportDraftForSchedule(schedule, {
      ...draft,
      selectedColumns: draft.module === schedule.module ? mappedSelectedColumns : draft.selectedColumns,
    });
    const saved = saveReportCenterSchedule({
      name: schedule.name.trim(),
      reportType: schedule.reportType,
      module: schedule.module,
      frequency: schedule.frequency,
      recipients: [...new Set(schedule.recipients.split(/[;,]/).map((address) => address.trim()).filter(Boolean))],
      nextRun: nextRunForFrequency(schedule.frequency),
      status: "active",
      dateRange: schedule.dateRange,
      entityIds: schedule.entityIds,
      allEntities: schedule.allEntities,
      draft: scheduleDraft,
    });
    setStoredSchedules(getReportCenterSchedules());
    toast({ title: "Schedule saved", description: `${saved.name} is ready for Run now.` });
  };

  const onEditSchedule = (record: ScheduledReportRecord, schedule: NewReportSchedule) => {
    const previous = getReportCenterSchedules().find((item) => item.id === record.id);
    const previousDraft = previous?.draft ?? draft;
    const scheduleDraft = reportDraftForSchedule(schedule, {
      ...previousDraft,
      selectedColumns: schedule.module === draft.module
        ? mappedSelectedColumns
        : previousDraft.selectedColumns,
    });
    saveReportCenterSchedule({
      id: record.id,
      createdAt: previous?.createdAt,
      name: schedule.name.trim(),
      reportType: schedule.reportType,
      module: schedule.module,
      frequency: schedule.frequency,
      recipients: [...new Set(schedule.recipients.split(/[;,]/).map((address) => address.trim()).filter(Boolean))],
      nextRun: record.status === "active" ? nextRunForFrequency(schedule.frequency) : "",
      status: record.status,
      dateRange: schedule.dateRange,
      entityIds: schedule.entityIds,
      allEntities: schedule.allEntities,
      draft: scheduleDraft,
    });
    setStoredSchedules(getReportCenterSchedules());
  };

  const onRunSchedule = async (record: ScheduledReportRecord) => {
    const schedule = getReportCenterSchedules().find((item) => item.id === record.id);
    if (!schedule) {
      toast({ title: "Schedule not found", description: "Refresh the schedule list and try again." });
      return;
    }
    const runDraft = rangeForSchedule(
      { ...schedule.draft, delivery: "email", recipients: schedule.recipients.join(", ") },
      schedule.dateRange,
    );
    const success = await executeReport(runDraft, "Scheduled", "Email");
    if (success) {
      updateReportCenterSchedule(schedule.id, { nextRun: nextRunForFrequency(schedule.frequency) });
      setStoredSchedules(getReportCenterSchedules());
    }
  };

  const onDownloadHistoryRecord = async (record: ReportHistoryRecord) => {
    const saved = getReportCenterHistory().find((item) => item.id === record.id);
    if (!saved) {
      toast({ title: "Report snapshot not found", description: "Refresh history and try again." });
      return;
    }
    try {
      const savedColumns = uniqueHistoryColumns(saved.columns);
      const mappedHistoryFields = new Set(
        getReportCenterMappedColumns(
          saved.module,
          savedColumns.map((column) => column.label || column.key),
          saved.rows as unknown as Parameters<typeof getReportCenterMappedColumns>[2],
        ).map((column) => column.trim().toLowerCase()),
      );
      const columns = savedColumns.filter((column) =>
        mappedHistoryFields.has((column.label || column.key).trim().toLowerCase())
        || mappedHistoryFields.has(column.key.trim().toLowerCase()),
      );
      let rows = saved.rows.map((row) => Object.fromEntries(
        columns.map((column) => [
          column.key,
          isReportCenterProductListColumn(column.label || column.key)
            ? getReportCenterCellValue({ [column.key]: row[column.key] }, column.label || column.key)
            : row[column.key],
        ]),
      ));
      if (!rows.length && saved.rowCount > 0 && saved.draft) {
        const currentModuleRecords = await loadReportCenterRecords(saved.draft.module, saved.draft.entityType);
        const current = filterReportCenterRecords(
          currentModuleRecords,
          saved.draft,
          entitiesByType,
        );
        const reportColumns = saved.columns.map((column) => column.key);
        const mappedColumns = getReportCenterMappedColumns(
          saved.draft.module,
          reportColumns.length ? reportColumns : saved.draft.selectedColumns,
          currentModuleRecords,
        );
        rows = getReportCenterRows(
          withReportRunMetadata(current, saved.draft),
          mappedColumns,
        );
      }
      const currentEntities = getReportCenterEntities();
      const historyTitle = saved.scopeHeader
        ? saved.name
        : saved.draft
          ? reportHistoryName(saved.draft, currentEntities)
        : saved.name;
      const headerContext = saved.scopeHeader
        ? [saved.scopeHeader]
        : saved.draft
          ? reportScopeHeaderLines(saved.draft, currentEntities)
        : saved.scopeDetail ? [`Report scope: ${saved.scopeDetail}`] : [];
      const exportColumns = saved.draft
        ? displayReportColumns(columns, saved.draft, currentEntities, saved.scopeHeader)
        : columns;
      downloadReportExport(saved.format, historyTitle, exportColumns, rows, { headerContext });
      toast({ title: "Report downloaded", description: `${rows.length.toLocaleString()} rows exported from the saved report snapshot.` });
    } catch (error) {
      toastError("Could not download report", error);
    }
  };

  const historyViewRecords = storedHistory.map((record) => ({
    id: record.id,
    name: record.name,
    scope: record.scope,
    scopeDetail: record.scopeDetail,
    module: record.module,
    generatedAt: record.generatedAt,
    period: record.period,
    source: record.source,
    delivery: record.delivery,
    status: record.status,
    format: record.format,
  }));

  return (
    <ReportsCenterUI
      activeTab={tab}
      onTabChange={setTab}
      entitiesByType={entitiesByType}
      modulesByType={REPORT_CENTER_MODULES}
      columnsByModule={availableColumnsByModule}
      createDraft={{ ...draft, selectedColumns: mappedSelectedColumns }}
      onCreateDraftChange={setDraft}
      previewRecords={previewRecords}
      previewCount={filteredRecords.length}
      previewError={sourceError || (sourceLoading ? "Loading live report data…" : "")}
      previewCurrency={currency}
      previewScope={reportScopeHeaderLines(draft, entitiesByType)[0]}
      onPreview={() => setReloadToken((token) => token + 1)}
      onDownloadReport={(reportDraft) => { void executeReport(reportDraft, "Manual", "Download"); }}
      onSendReportEmail={(reportDraft) => { void executeReport(reportDraft, "Manual", "Email"); }}
      scheduledReports={scheduleItems}
      recentDeliveries={recentDeliveries}
      deliveryTimezone="Asia/Kolkata (IST)"
      savedDateRange="Saved per schedule"
      onCreateSchedule={onCreateSchedule}
      onRunSchedule={onRunSchedule}
      onEditSchedule={onEditSchedule}
      onPauseSchedule={(record) => {
        updateReportCenterSchedule(record.id, { status: "paused", nextRun: "" });
        setStoredSchedules(getReportCenterSchedules());
      }}
      onResumeSchedule={(record) => {
        const current = getReportCenterSchedules().find((item) => item.id === record.id);
        if (current) updateReportCenterSchedule(record.id, { status: "active", nextRun: nextRunForFrequency(current.frequency) });
        setStoredSchedules(getReportCenterSchedules());
      }}
      onDeleteSchedule={(record) => {
        deleteReportCenterSchedule(record.id);
        setStoredSchedules(getReportCenterSchedules());
      }}
      onConnectDelivery={() => navigate("/configuration/email-settings")}
      onViewScheduleHistory={() => setTab("history")}
      historyRecords={historyViewRecords}
      onRefreshHistory={() => {
        setStoredHistory(getReportCenterHistory());
        setStoredSchedules(getReportCenterSchedules());
      }}
      onDownloadHistoryRecord={onDownloadHistoryRecord}
    />
  );
}
