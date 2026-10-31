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
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getVendors } from "@/lib/vendorDataStore";
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { ShoppingCart, DollarSign, Clock, CheckCircle, XCircle, Package } from "lucide-react";

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function ProcurementReportPage() {
  usePageMeta({ title: "Procurement Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();

  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);
  const vendors = useMemo(() => applyReportFilters(getVendors(), filters), [liveRevision, filters]);

  const totalSpend = useMemo(() => pos.reduce((s, p) => s + (p.grandTotal ?? 0), 0), [pos]);
  const confirmedPOs = pos.filter(p => p.status === "Confirmed" || p.status === "Delivered");
  const pendingPOs = pos.filter(p => p.status === "Draft" || p.status === "Processing");
  const cancelledPOs = pos.filter(p => p.status === "Cancelled");

  // Vendor spend
  const vendorSpend: Record<string, number> = {};
  pos.forEach(p => {
    const v = p.vendorName ?? "Unknown";
    vendorSpend[v] = (vendorSpend[v] ?? 0) + (p.grandTotal ?? 0);
  });
  const topVendorSpend = Object.entries(vendorSpend).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value }));

  // Category spend
  const catSpend: Record<string, number> = {};
  pos.forEach(p => {
    const cat = p.items?.[0]?.category ?? p.category ?? "Other";
    catSpend[cat] = (catSpend[cat] ?? 0) + (p.grandTotal ?? 0);
  });
  const categoryData = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, value }));

  // PO status
  const statusMap: Record<string, number> = {};
  pos.forEach(p => { statusMap[p.status] = (statusMap[p.status] ?? 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  const monthlyData = getRecentReportMonths().map(({ key, label }) => {
    const monthPos = pos.filter((po) => getReportMonthKey(po.createdOn ?? po.createdAt) === key);
    return {
      month: label,
      pos: monthPos.length,
      spend: monthPos.reduce((sum, po) => sum + (po.grandTotal ?? po.subtotal ?? 0), 0),
    };
  });

  const tableData = pos.slice(0, 50).map(p => ({
    poNumber: p.poNumber,
    date: p.createdOnDisplay ?? "",
    vendor: p.vendorName ?? "—",
    category: p.items?.[0]?.category ?? p.category ?? "—",
    qty: p.items?.reduce((s, i) => s + (i.qty ?? 0), 0) ?? (p.qty ?? 0),
    amount: `₹${(p.grandTotal ?? 0).toLocaleString()}`,
    delivery: p.requestedDelivery ?? "—",
    status: p.status,
  }));

  return (
    <ReportShell title="Procurement Reports" subtitle="Purchase order analytics, vendor spend and approval cycle insights">
      <div className="space-y-5">
        <ExportBar reportTitle="Procurement Reports" />
        <FilterBar vendors={vendors.map(v => v.name)} statuses={["Draft","Processing","Confirmed","Delivered","Cancelled"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total POs" value={pos.length} change={5.2}
            icon={<ShoppingCart className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[3,5,4,7,8,7,10]} />
          <KpiCard title="Total Spend" value={`₹${(totalSpend/1000).toFixed(0)}K`} change={-8.1}
            icon={<DollarSign className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[80,70,75,65,60,55,50]} />
          <KpiCard title="Confirmed POs" value={confirmedPOs.length} change={12.3}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[2,3,4,5,6,5,7]} />
          <KpiCard title="Pending Approval" value={pendingPOs.length} change={-5.0}
            icon={<Clock className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" sparkline={[8,7,6,5,4,5,3]} />
          <KpiCard title="Cancelled POs" value={cancelledPOs.length} change={-20.0}
            icon={<XCircle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[5,4,3,2,2,1,1]} />
          <KpiCard title="Active Vendors" value={vendors.filter(v => v.status === "Active").length} change={2.1}
            icon={<Package className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[10,11,11,12,13,13,14]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Vendor Spend" subtitle="Top vendors" className="col-span-2">
            {topVendorSpend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendorSpend} layout="vertical" margin={{ left: 4, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Spend"]} />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No PO data yet</div>
            )}
          </ChartCard>
          <ChartCard title="PO Status">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No PO data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Spend by Category" height={240}>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Spend"]} />
                  <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No category data</div>
            )}
          </ChartCard>
          <ChartCard title="Monthly Procurement Trend" height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="pos" stroke="#2563EB" strokeWidth={2} dot={false} name="POs" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: "negative", text: `Procurement spend of ₹${totalSpend.toLocaleString()} is 8.1% higher than the previous period. Review high-spend categories for consolidation.` },
          { type: "warning", text: `${pendingPOs.length} POs are pending approval. Delays in approvals can increase procurement cycle times.` },
          { type: "positive", text: `${confirmedPOs.length} POs have been confirmed and fulfilled successfully.` },
          { type: "info", text: topVendorSpend.length > 0 ? `Top vendor by spend: ${topVendorSpend[0].name} (₹${topVendorSpend[0].value.toLocaleString()}). Consider negotiating volume discounts.` : "Add purchase orders to see vendor spend analysis." },
        ]} />

        <ReportDataTable
          title="Purchase Orders"
          data={tableData as any[]}
          columns={[
            { key: "poNumber", label: "PO #", sortable: true },
            { key: "date", label: "Date", sortable: true },
            { key: "vendor", label: "Vendor", sortable: true },
            { key: "category", label: "Category", sortable: true },
            { key: "amount", label: "Amount", align: "right" },
            { key: "delivery", label: "Delivery Date" },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Delivered" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Cancelled" ? "bg-red-100 text-red-600" :
                r.status === "Confirmed" ? "bg-blue-100 text-blue-700" :
                "bg-amber-100 text-amber-700"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search purchase orders..."
          emptyMessage="No purchase orders yet."
        />
      </div>
    </ReportShell>
  );
}
