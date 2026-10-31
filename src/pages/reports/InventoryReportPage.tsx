import { useMemo } from "react";
import { usePageMeta } from "@/contexts/PageMetaContext";
import { useLiveReportRevision } from "@/hooks/useLiveReportRevision";
import { useReportFilters } from "@/contexts/ReportControlsContext";
import ReportShell from "@/components/reports/ReportShell";
import KpiCard from "@/components/reports/KpiCard";
import ChartCard from "@/components/reports/ChartCard";
import FilterBar from "@/components/reports/FilterBar";
import AiInsightsPanel from "@/components/reports/AiInsightsPanel";
import ExportBar from "@/components/reports/ExportBar";
import ReportDataTable from "@/components/reports/ReportDataTable";
import { getStockHistory, getAllThresholds } from "@/lib/stockHistoryStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Package, AlertTriangle, TrendingDown, TrendingUp, Archive, RefreshCw } from "lucide-react";
import { applyReportFilters } from "@/lib/reportData";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];

export default function InventoryReportPage() {
  usePageMeta({ title: "Inventory Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const stockHistory = useMemo(() => applyReportFilters(getStockHistory() as any[], filters), [liveRevision, filters]);
  const products = useMemo(() => applyReportFilters(getCatalogProducts() as any[], filters), [liveRevision, filters]);
  const thresholds = useMemo(() => getAllThresholds(), [liveRevision]);

  // Stock events by action
  const actionMap: Record<string, number> = {};
  stockHistory.forEach(e => { actionMap[e.action] = (actionMap[e.action] ?? 0) + 1; });
  const actionData = Object.entries(actionMap).map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value }));

  // Stock In vs Out
  const stockInEvents = stockHistory.filter(e => e.action === "Stock In");
  const stockOutEvents = stockHistory.filter(e => e.action === "Stock Out");
  const totalStockIn = stockInEvents.reduce((s, e) => s + Math.abs(e.qtyChanged ?? 0), 0);
  const totalStockOut = stockOutEvents.reduce((s, e) => s + Math.abs(e.qtyChanged ?? 0), 0);

  // Product stock status
  const productStockMap: Record<string, { current: number; threshold: number }> = {};
  stockHistory.forEach(e => {
    if (!productStockMap[e.masterProductCode]) {
      productStockMap[e.masterProductCode] = {
        current: e.qtyAfter ?? 0,
        threshold: thresholds[e.masterProductCode]?.low ?? 5,
      };
    }
  });
  const lowStockItems = Object.entries(productStockMap).filter(([, v]) => v.current <= v.threshold && v.current > 0);
  const outOfStockItems = Object.entries(productStockMap).filter(([, v]) => v.current <= 0);

  // Top movers by movement count
  const productMoves: Record<string, number> = {};
  stockHistory.forEach(e => { productMoves[e.productName] = (productMoves[e.productName] ?? 0) + 1; });
  const topMovers = Object.entries(productMoves).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, moves]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, moves }));

  // Daily activity (last 7 entries)
  const recentDays = stockHistory.slice(-7).map((e, i) => ({
    day: `Day ${i + 1}`,
    in: e.action === "Stock In" ? e.qtyChanged : 0,
    out: e.action === "Stock Out" ? Math.abs(e.qtyChanged ?? 0) : 0,
  }));

  const tableData = stockHistory.slice(0, 50).map(e => ({
    timestamp: new Date(e.timestamp).toLocaleDateString(),
    product: e.productName,
    vendor: e.vendorName ?? "—",
    action: e.action,
    before: e.qtyBefore,
    changed: e.qtyChanged > 0 ? `+${e.qtyChanged}` : String(e.qtyChanged),
    after: e.qtyAfter,
    reference: e.reference ?? "—",
    user: e.user ?? "—",
  }));

  return (
    <ReportShell title="Inventory Reports" subtitle="Stock movements, levels, low stock alerts and inventory value">
      <div className="space-y-5">
        <ExportBar reportTitle="Inventory Reports" />
        <FilterBar categories={[...new Set(stockHistory.map(e => e.action))]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Stock Events" value={stockHistory.length} change={12.0}
            icon={<Package className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[5,8,6,10,12,9,14]} />
          <KpiCard title="Total Stock In" value={totalStockIn} change={8.5}
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[20,30,25,40,45,38,50]} />
          <KpiCard title="Total Stock Out" value={totalStockOut} change={5.2}
            icon={<TrendingDown className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[15,20,18,25,30,28,35]} />
          <KpiCard title="Tracked Products" value={Object.keys(productStockMap).length} change={3.1}
            icon={<Archive className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" sparkline={[10,11,12,13,14,14,15]} />
          <KpiCard title="Low Stock Items" value={lowStockItems.length} change={-10.0}
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} iconBg="bg-amber-50" sparkline={[8,7,6,5,4,4,3]} />
          <KpiCard title="Out of Stock" value={outOfStockItems.length} change={-20.0}
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[5,4,3,2,2,1,1]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Stock Movement Activity" subtitle="In vs Out" className="col-span-2">
            {recentDays.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recentDays} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="in" fill="#10B981" name="Stock In" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out" fill="#EF4444" name="Stock Out" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No stock events yet</div>
            )}
          </ChartCard>
          <ChartCard title="Events by Action">
            {actionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={actionData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {actionData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No data</div>
            )}
          </ChartCard>
        </div>

        {topMovers.length > 0 && (
          <ChartCard title="Top Moving Products" subtitle="By event count" height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMovers} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="moves" fill="#2563EB" radius={[4, 4, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <AiInsightsPanel insights={[
          { type: "warning", text: `${lowStockItems.length} products are at or below reorder threshold. Raise purchase orders to avoid stockouts.` },
          { type: "negative", text: `${outOfStockItems.length} products are out of stock. Expedite POs for these items immediately.` },
          { type: "positive", text: `${totalStockIn} units received vs ${totalStockOut} units dispatched in the current period.` },
          { type: "info", text: topMovers.length > 0 ? `Highest moving product: ${topMovers[0].name} with ${topMovers[0].moves} stock events.` : "Record stock events to see movement analytics." },
        ]} />

        <ReportDataTable
          title="Stock History"
          data={tableData as any[]}
          columns={[
            { key: "timestamp", label: "Date", sortable: true },
            { key: "product", label: "Product", sortable: true },
            { key: "vendor", label: "Vendor" },
            { key: "action", label: "Action", sortable: true, render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.action === "Stock In" ? "bg-emerald-100 text-emerald-700" :
                r.action === "Stock Out" ? "bg-red-100 text-red-600" :
                "bg-blue-100 text-blue-700"
              }`}>{r.action}</span>
            )},
            { key: "before", label: "Before", align: "center" },
            { key: "changed", label: "Change", align: "center" },
            { key: "after", label: "After", align: "center" },
            { key: "reference", label: "Reference" },
            { key: "user", label: "User" },
          ]}
          searchPlaceholder="Search stock history..."
          emptyMessage="No stock events recorded yet. Stock movements will appear here."
        />
      </div>
    </ReportShell>
  );
}
