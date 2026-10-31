import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ReportDatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "lastweek"
  | "month"
  | "lastmonth"
  | "quarter"
  | "fy"
  | "custom";

export interface ReportFilters {
  datePreset: ReportDatePreset;
  dateFrom: string;
  dateTo: string;
  branch: string;
  department: string;
  client: string;
  vendor: string;
  category: string;
  status: string;
  user: string;
}

export interface ReportExportColumn {
  key: string;
  label: string;
}

export interface ReportExportData {
  title: string;
  columns: ReportExportColumn[];
  rows: Record<string, unknown>[];
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
  branch: "",
  department: "",
  client: "",
  vendor: "",
  category: "",
  status: "",
  user: "",
};

interface ReportFiltersValue {
  filters: ReportFilters;
  setFilters: (filters: ReportFilters) => void;
}

interface ReportExportValue {
  exportData: ReportExportData | null;
}

interface ReportExportSetterValue {
  setExportData: (data: ReportExportData | null) => void;
}

const ReportFiltersContext = createContext<ReportFiltersValue | null>(null);
const ReportExportDataContext = createContext<ReportExportValue | null>(null);
const ReportExportSetterContext = createContext<ReportExportSetterValue | null>(null);

export function ReportControlsProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [exportData, setExportData] = useState<ReportExportData | null>(null);
  const filterValue = useMemo(() => ({ filters, setFilters }), [filters]);
  const exportDataValue = useMemo(() => ({ exportData }), [exportData]);
  const exportSetterValue = useMemo(() => ({ setExportData }), []);

  return (
    <ReportFiltersContext.Provider value={filterValue}>
      <ReportExportDataContext.Provider value={exportDataValue}>
        <ReportExportSetterContext.Provider value={exportSetterValue}>
          {children}
        </ReportExportSetterContext.Provider>
      </ReportExportDataContext.Provider>
    </ReportFiltersContext.Provider>
  );
}

export function useReportFilterControls() {
  const context = useContext(ReportFiltersContext);
  if (!context) {
    throw new Error("Report filters must be used inside ReportControlsProvider");
  }
  return context;
}

export function useReportFilters() {
  return useReportFilterControls().filters;
}

export function useReportExportData() {
  const context = useContext(ReportExportDataContext);
  if (!context) {
    throw new Error("Report export data must be used inside ReportControlsProvider");
  }
  return context.exportData;
}

export function useSetReportExportData() {
  const context = useContext(ReportExportSetterContext);
  if (!context) {
    throw new Error("Report export setter must be used inside ReportControlsProvider");
  }
  return context.setExportData;
}
