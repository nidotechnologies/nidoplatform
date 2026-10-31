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
import { getVendors } from "@/lib/vendorDataStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { applyReportFilters } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
  ScatterChart, Scatter, Cell, PieChart, Pie,
} from "recharts";
import { Building2, Star, TrendingUp, Package, AlertTriangle, CheckCircle } from "lucide-react";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];

export default function VendorPerformancePage() {
  usePageMeta({ title: "Vendor Performance" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const vendors = useMemo(() => applyReportFilters(getVendors(), filters), [liveRevision, filters]);
  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);

  const activeVendors = vendors.filter(v => v.status === "Active");
  const avgRating = vendors.length > 0
    ? (vendors.reduce((s, v) => s + (v.rating ?? 0), 0) / vendors.length).toFixed(1)
    : "—";

  // Vendor spend map
  const vendorSpend: Record<string, number> = {};
  pos.forEach(p => {
    const v = p.vendorName ?? "Unknown";
    vendorSpend[v] = (vendorSpend[v] ?? 0) + (p.grandTotal ?? 0);
  });

  // Top vendors by spend
  const topVendors = Object.entries(vendorSpend).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, spend]) => ({
      name: name.length > 16 ? name.slice(0, 16) + "…" : name,
      spend,
    }));

  // Status distribution
  const statusMap: Record<string, number> = {};
  vendors.forEach(v => { statusMap[v.status] = (statusMap[v.status] ?? 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // Rating distribution
  const ratingBuckets = [0, 0, 0, 0, 0];
  vendors.forEach(v => {
    const r = Math.min(5, Math.floor(v.rating ?? 0));
    if (r >= 1) ratingBuckets[r - 1]++;
  });
  const ratingData = ["1★", "2★", "3★", "4★", "5★"].map((label, i) => ({ label, count: ratingBuckets[i] }));

  // Category distribution
  const catMap: Record<string, number> = {};
  vendors.forEach(v => { catMap[v.category] = (catMap[v.category] ?? 0) + 1; });
  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, value }));

  // Performance radar for top vendor
  const topVendorObj = vendors.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const radarData = topVendorObj ? [
    { subject: "Quality", value: topVendorObj.performanceQuality ?? topVendorObj.score ?? 80 },
    { subject: "Delivery", value: topVendorObj.performanceDelivery ?? 75 },
    { subject: "Response", value: topVendorObj.performanceResponsiveness ?? 82 },
    { subject: "Compliance", value: topVendorObj.performanceCompliance ?? 90 },
    { subject: "Price", value: Math.min(100, (topVendorObj.score ?? 70)) },
  ] : [];

  const tableData = vendors.slice(0, 50).map(v => ({
    name: v.name,
    category: v.category,
    email: v.email,
    region: v.region ?? "—",
    totalSpend: vendorSpend[v.name] ? `₹${vendorSpend[v.name].toLocaleString()}` : "₹0",
    rating: v.rating ?? "—",
    score: v.score ?? "—",
    status: v.status,
    onboarded: v.onboardedDate ?? "—",
  }));

  return (
    <ReportShell title="Vendor Performance" subtitle="Vendor ratings, spend analysis, delivery and compliance metrics">
      <div className="space-y-5">
        <ExportBar reportTitle="Vendor Performance" />
        <FilterBar
          vendors={vendors.map(v => v.name)}
          categories={[...new Set(vendors.map(v => v.category))]}
          statuses={["Active","Inactive","On Hold","Pending"]}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total Vendors" value={vendors.length} change={2.5}
            icon={<Building2 className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[8,9,9,10,11,11,12]} />
          <KpiCard title="Active Vendors" value={activeVendors.length} change={3.1}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[6,7,8,8,9,9,10]} />
          <KpiCard title="Avg Vendor Rating" value={avgRating} suffix="/5" change={1.2}
            icon={<Star className="w-4 h-4 text-amber-500" />} iconBg="bg-amber-50" sparkline={[3.5,3.6,3.7,3.8,3.8,3.9,4.0]} />
          <KpiCard title="Total POs Issued" value={pos.length} change={5.2}
            icon={<Package className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[3,5,4,7,8,7,10]} />
          <KpiCard title="On Hold Vendors" value={vendors.filter(v => v.status === "On Hold").length} change={-10}
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[4,3,3,2,2,1,1]} />
          <KpiCard title="Compliance Issues" value={vendors.reduce((s, v) => s + (v.complianceIssues ?? 0), 0)} change={-15}
            icon={<TrendingUp className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[10,9,8,7,6,5,4]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Top Vendors by Spend" subtitle="Purchase volume" className="col-span-2">
            {topVendors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendors} layout="vertical" margin={{ left: 4, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Spend"]} />
                  <Bar dataKey="spend" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No PO data yet</div>
            )}
          </ChartCard>
          <ChartCard title="Vendor Status">
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
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No vendor data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Rating Distribution" height={230}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Vendors" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Category Distribution" height={230}>
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} name="Vendors" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No category data</div>
            )}
          </ChartCard>
          <ChartCard title="Top Vendor Performance Radar" height={230}>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={80}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No vendor data</div>
            )}
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: "info", text: `${vendors.length} vendors registered. ${activeVendors.length} are currently active (${((activeVendors.length / Math.max(1, vendors.length)) * 100).toFixed(0)}% active rate).` },
          { type: "positive", text: `Average vendor rating is ${avgRating}/5. Maintain high standards through regular performance reviews.` },
          { type: "warning", text: `${vendors.filter(v => v.complianceIssues > 0).length} vendors have compliance issues. Review and resolve to avoid procurement risk.` },
          { type: "info", text: topVendors.length > 0 ? `${topVendors[0].name} is the highest-spend vendor at ₹${topVendors[0].spend.toLocaleString()}. Diversify vendor base to reduce single-vendor risk.` : "Add purchase orders to see vendor spend rankings." },
        ]} />

        <ReportDataTable
          title="Vendor Directory"
          data={tableData as any[]}
          columns={[
            { key: "name", label: "Vendor Name", sortable: true },
            { key: "category", label: "Category", sortable: true },
            { key: "region", label: "Region" },
            { key: "totalSpend", label: "Total Spend", align: "right" },
            { key: "rating", label: "Rating", align: "center" },
            { key: "score", label: "Score", align: "center" },
            { key: "onboarded", label: "Onboarded" },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                r.status === "On Hold" ? "bg-amber-100 text-amber-700" :
                r.status === "Pending" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-500"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search vendors..."
          emptyMessage="No vendors yet. Add vendors in the Vendors section."
        />
      </div>
    </ReportShell>
  );
}
