import { useState } from "react";
import { Filter, RotateCcw, ChevronDown } from "lucide-react";
import { DEFAULT_REPORT_FILTERS, useReportFilterControls, type ReportDatePreset, type ReportFilters } from "@/contexts/ReportControlsContext";

const DATE_PRESETS: { label: string; value: ReportDatePreset }[] = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "week" },
  { label: "Last Week", value: "lastweek" },
  { label: "This Month", value: "month" },
  { label: "Last Month", value: "lastmonth" },
  { label: "Quarter", value: "quarter" },
  { label: "Financial Year", value: "fy" },
  { label: "Custom", value: "custom" },
];

interface FilterBarProps {
  onFilterChange?: (f: ReportFilters) => void;
  clients?: string[];
  vendors?: string[];
  categories?: string[];
  statuses?: string[];
  statusLabel?: string;
}

export default function FilterBar({
  onFilterChange,
  clients = [],
  vendors = [],
  categories = [],
  statuses = [],
  statusLabel = "Status",
}: FilterBarProps) {
  const { filters, setFilters } = useReportFilterControls();
  const [expanded, setExpanded] = useState(false);
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) =>
    key !== "datePreset" && value !== ""
  ).length + (filters.datePreset === "all" ? 0 : 1);

  const update = (key: keyof ReportFilters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange?.(next);
  };

  const reset = () => {
    setFilters(DEFAULT_REPORT_FILTERS);
    onFilterChange?.(DEFAULT_REPORT_FILTERS);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => update("datePreset", p.value)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filters.datePreset === p.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeFiltersCount > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            More <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {filters.datePreset === "custom" && (
        <div className="flex items-center gap-3 px-4 pb-3 border-t border-gray-50 pt-3">
          <span className="text-xs text-gray-500 shrink-0">Date range:</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Expanded filters */}
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 px-4 pb-4 border-t border-gray-50 pt-3">
          {[
            { label: "Client", key: "client" as const, opts: clients },
            { label: "Vendor", key: "vendor" as const, opts: vendors },
            { label: "Category", key: "category" as const, opts: categories },
            { label: statusLabel, key: "status" as const, opts: statuses },
            { label: "User / Assigned", key: "user" as const, opts: [] },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
              <div className="relative">
                <select
                  value={filters[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 pr-6"
                >
                  <option value="">All</option>
                  {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
