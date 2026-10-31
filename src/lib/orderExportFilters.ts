export interface OrderExportFilters {
  fromDate: string;
  toDate: string;
  statuses: string[];
  clients: string[];
}

export interface OrderExportFilterAccessors<T> {
  getDate: (record: T) => unknown;
  getStatus: (record: T) => unknown;
  getClient: (record: T) => unknown;
}

export const EMPTY_ORDER_EXPORT_FILTERS: OrderExportFilters = {
  fromDate: "",
  toDate: "",
  statuses: [],
  clients: [],
};

export function normalizeExportDate(value: unknown): string {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  // Stored PO display dates use DD/MM/YYYY.
  const dayFirstDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirstDate) {
    const day = Number(dayFirstDate[1]);
    const month = Number(dayFirstDate[2]);
    const year = Number(dayFirstDate[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function filterOrdersForExport<T>(
  records: T[],
  filters: OrderExportFilters,
  accessors: OrderExportFilterAccessors<T>,
): T[] {
  const statuses = new Set(filters.statuses);
  const clients = new Set(filters.clients);

  return records.filter((record) => {
    if (statuses.size && !statuses.has(String(accessors.getStatus(record) ?? ""))) return false;
    if (clients.size && !clients.has(String(accessors.getClient(record) ?? ""))) return false;

    if (filters.fromDate || filters.toDate) {
      const date = normalizeExportDate(accessors.getDate(record));
      if (!date) return false;
      if (filters.fromDate && date < filters.fromDate) return false;
      if (filters.toDate && date > filters.toDate) return false;
    }

    return true;
  });
}