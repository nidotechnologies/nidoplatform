import type {
  ReportCreateDraft,
  ReportExportFormat,
  ReportRunStatus,
  ScheduleStatus,
  ReportCreateDraft,
} from "@/components/reports/report-center/ReportsCenterUI";

const SCHEDULES_KEY = "nido_reports_center_schedules_v1";
const HISTORY_KEY = "nido_reports_center_history_v1";
const LEGACY_REPORT_DATA_PURGED_KEY = "nido_reports_legacy_data_purged_v1";
const REPORT_CENTER_UPDATED_EVENT = "nidoReportCenterUpdated";
const MAX_HISTORY_ITEMS = 50;
const MAX_HISTORY_STORAGE_CHARS = 3_000_000;

export interface StoredReportCenterSchedule {
  id: string;
  name: string;
  reportType: string;
  module: string;
  frequency: string;
  recipients: string[];
  nextRun: string;
  status: ScheduleStatus;
  dateRange: string;
  entityIds: string[];
  allEntities: boolean;
  draft: ReportCreateDraft;
  createdAt: string;
  updatedAt: string;
}

export interface StoredReportCenterHistory {
  id: string;
  name: string;
  scope: string;
  scopeDetail?: string;
  scopeHeader?: string;
  reportType: string;
  module: string;
  generatedAt: string;
  generatedAtIso: string;
  period: string;
  source: string;
  delivery: string;
  status: ReportRunStatus;
  format: ReportExportFormat;
  rowCount: number;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  draft?: ReportCreateDraft;
  error?: string;
}

function safeRead<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function notifyUpdated(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REPORT_CENTER_UPDATED_EVENT));
}

function purgeLegacyReportDataOnce(): void {
  if (typeof window === "undefined") return;
  const storage = window.localStorage;
  if (storage.getItem(LEGACY_REPORT_DATA_PURGED_KEY) === "1") return;
  storage.removeItem(HISTORY_KEY);
  storage.removeItem(SCHEDULES_KEY);
  storage.setItem(LEGACY_REPORT_DATA_PURGED_KEY, "1");
  notifyUpdated();
}

function writeList<T>(key: string, records: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(records));
  notifyUpdated();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getReportCenterSchedules(): StoredReportCenterSchedule[] {
  purgeLegacyReportDataOnce();
  return safeRead<StoredReportCenterSchedule>(SCHEDULES_KEY)
    .filter((record) => Boolean(record?.id && record.name && record.module));
}

export function saveReportCenterSchedule(
  schedule: Omit<StoredReportCenterSchedule, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string },
): StoredReportCenterSchedule {
  const current = getReportCenterSchedules();
  const now = new Date().toISOString();
  const existing = schedule.id ? current.find((record) => record.id === schedule.id) : undefined;
  const saved: StoredReportCenterSchedule = {
    ...schedule,
    id: schedule.id ?? createId(),
    createdAt: schedule.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeList(SCHEDULES_KEY, [saved, ...current.filter((record) => record.id !== saved.id)]);
  return saved;
}

export function updateReportCenterSchedule(
  id: string,
  updates: Partial<Pick<StoredReportCenterSchedule, "status" | "nextRun" | "name" | "reportType" | "module" | "frequency" | "recipients" | "dateRange" | "entityIds" | "allEntities" | "draft">>,
): StoredReportCenterSchedule | undefined {
  const current = getReportCenterSchedules();
  const existing = current.find((record) => record.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  writeList(SCHEDULES_KEY, current.map((record) => record.id === id ? updated : record));
  return updated;
}

export function deleteReportCenterSchedule(id: string): void {
  writeList(SCHEDULES_KEY, getReportCenterSchedules().filter((record) => record.id !== id));
}

export function getReportCenterHistory(): StoredReportCenterHistory[] {
  purgeLegacyReportDataOnce();
  return safeRead<StoredReportCenterHistory>(HISTORY_KEY)
    .filter((record) => Boolean(record?.id && record.name && record.generatedAtIso))
    .sort((left, right) => right.generatedAtIso.localeCompare(left.generatedAtIso));
}

export function saveReportCenterHistory(record: Omit<StoredReportCenterHistory, "id"> & { id?: string }): StoredReportCenterHistory {
  const saved: StoredReportCenterHistory = { ...record, id: record.id ?? createId() };
  let records = [saved, ...getReportCenterHistory().filter((item) => item.id !== saved.id)].slice(0, MAX_HISTORY_ITEMS);
  while (records.length) {
    const serialized = JSON.stringify(records);
    if (serialized.length <= MAX_HISTORY_STORAGE_CHARS) {
      writeList(HISTORY_KEY, records);
      return saved;
    }
    records = records.slice(0, records.length - 1);
  }
  throw new Error("Report history could not be saved because browser storage is full.");
}

export function reportCenterUpdatedEventName(): string {
  return REPORT_CENTER_UPDATED_EVENT;
}
