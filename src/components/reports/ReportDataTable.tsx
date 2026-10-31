import { useState, useMemo, useEffect } from "react";
import { Search, Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useReportFilters, useSetReportExportData } from "@/contexts/ReportControlsContext";
import { applyReportFilters } from "@/lib/reportData";
import { downloadReportExport } from "@/lib/reportExport";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
}

interface ReportDataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  applyGlobalFilters?: boolean;
}

export default function ReportDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  searchPlaceholder = "Search...",
  pageSize = 10,
  emptyMessage = "No data available.",
  applyGlobalFilters = true,
}: ReportDataTableProps<T>) {
  const setExportData = useSetReportExportData();
  const reportFilters = useReportFilters();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [visibleCols, setVisibleCols] = useState<string[]>(columns.map((c) => c.key));

  const reportFilteredData = useMemo(
    () => applyGlobalFilters ? applyReportFilters(data, reportFilters) : data,
    [applyGlobalFilters, data, reportFilters],
  );

  const filtered = useMemo(() => {
    if (!search) return reportFilteredData;
    const q = search.toLowerCase();
    return reportFilteredData.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [reportFilteredData, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const visibleColumns = useMemo(() => columns.filter((c) => visibleCols.includes(c.key)), [columns, visibleCols]);

  useEffect(() => {
    setExportData({
      title: title || "Report",
      columns: visibleColumns.map(({ key, label }) => ({ key, label })),
      rows: sorted,
    });
  }, [setExportData, title, visibleColumns, sorted]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 gap-3">
        {title && <h3 className="text-sm font-semibold text-gray-900 shrink-0">{title}</h3>}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Column visibility */}
          <div className="relative group">
            <button className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
              Columns
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 hidden group-hover:block">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(c.key)}
                    onChange={(e) => {
                      if (e.target.checked) setVisibleCols((p) => [...p, c.key]);
                      else setVisibleCols((p) => p.filter((k) => k !== c.key));
                    }}
                    className="rounded border-gray-300 text-blue-600 w-3 h-3"
                  />
                  <span className="text-xs text-gray-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={() => downloadReportExport(
              "CSV",
              title || "Report",
              visibleColumns.map(({ key, label }) => ({ key, label })),
              sorted,
            )}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`py-2.5 px-4 text-xs font-semibold text-gray-500 whitespace-nowrap ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    >
                      {col.label} <SortIcon col={col} />
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2.5 px-4 text-xs text-gray-700 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="py-12 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50">
        <span className="text-xs text-gray-500">
          {sorted.length === 0 ? "0 records" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          {[
            { label: "«", action: () => setPage(1), disabled: page === 1 },
            { label: "‹", action: () => setPage((p) => Math.max(1, p - 1)), disabled: page === 1 },
            { label: "›", action: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page === totalPages },
            { label: "»", action: () => setPage(totalPages), disabled: page === totalPages },
          ].map(({ label, action, disabled }) => (
            <button
              key={label}
              onClick={action}
              disabled={disabled}
              className="w-7 h-7 flex items-center justify-center text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-gray-500 ml-1">Page {page}/{totalPages}</span>
        </div>
      </div>
    </div>
  );
}
