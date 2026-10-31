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
import { getClients } from "@/lib/clientStore";
import { getInvoices } from "@/lib/invoiceStore";
import { getOrders } from "@/lib/salesOrderStore";
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { Users, DollarSign, TrendingUp, UserCheck, UserX, FileText } from "lucide-react";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];

export default function ClientReportPage() {
  usePageMeta({ title: "Client Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const clients = useMemo(() => applyReportFilters(getClients(), filters), [liveRevision, filters]);
  const invoices = useMemo(() => applyReportFilters(getInvoices(), filters), [liveRevision, filters]);
  const orders = useMemo(() => applyReportFilters(getOrders(), filters), [liveRevision, filters]);

  const activeClients = clients.filter(c => c.status !== "Inactive" && c.status !== "Archived");
  const inactiveClients = clients.filter(c => c.status === "Inactive");

  // Revenue per client
  const clientRev: Record<string, number> = {};
  invoices.forEach(inv => {
    clientRev[inv.clientName] = (clientRev[inv.clientName] ?? 0) + (inv.grandTotal ?? 0);
  });
  const topClients = Object.entries(clientRev).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, revenue]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, revenue }));

  // Orders per client
  const clientOrders: Record<string, number> = {};
  orders.forEach(o => { clientOrders[o.clientName] = (clientOrders[o.clientName] ?? 0) + 1; });

  const totalRevenue = Object.values(clientRev).reduce((s, v) => s + v, 0);
  const avgRevPerClient = clients.length > 0 ? totalRevenue / clients.length : 0;

  // Tier distribution
  const tierMap: Record<string, number> = {};
  clients.forEach(c => { const t = c.tier ?? "Standard"; tierMap[t] = (tierMap[t] ?? 0) + 1; });
  const tierData = Object.entries(tierMap).map(([name, value]) => ({ name, value }));

  // Status distribution
  const statusMap: Record<string, number> = {};
  clients.forEach(c => { const s = c.status ?? "Active"; statusMap[s] = (statusMap[s] ?? 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  const monthlyData = getRecentReportMonths().map(({ key, label }) => ({
    month: label,
    revenue: invoices
      .filter((invoice) => getReportMonthKey(invoice.invoiceDate ?? invoice.createdAt) === key)
      .reduce((sum, invoice) => sum + (invoice.grandTotal ?? 0), 0),
    clients: clients.filter((client) => getReportMonthKey(client.contractStartDate ?? client.onboardedDate ?? client.createdAt) === key).length,
  }));

  // Contract expiry check
  const today = new Date();
  const expiringContracts = clients.filter(c => {
    if (!c.contractEndDate) return false;
    const end = new Date(c.contractEndDate);
    const diff = (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const tableData = clients.slice(0, 50).map(c => ({
    name: c.name,
    category: c.category ?? "—",
    tier: c.tier ?? "Standard",
    email: c.email ?? "—",
    revenue: clientRev[c.name] ? `₹${clientRev[c.name].toLocaleString()}` : "₹0",
    orders: clientOrders[c.name] ?? 0,
    contractEnd: c.contractEndDate ?? "—",
    status: c.status ?? "Active",
  }));

  return (
    <ReportShell title="Client Reports" subtitle="Client revenue, activity, contracts and growth analytics">
      <div className="space-y-5">
        <ExportBar reportTitle="Client Reports" />
        <FilterBar
          clients={clients.map(c => c.name)}
          categories={[...new Set(clients.map(c => c.category).filter(Boolean) as string[])]}
          statuses={["Active","Inactive","Prospect"]}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total Clients" value={clients.length} change={3.8}
            icon={<Users className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[10,12,11,14,15,14,16]} />
          <KpiCard title="Active Clients" value={activeClients.length} change={5.2}
            icon={<UserCheck className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[8,10,9,12,13,12,14]} />
          <KpiCard title="Total Revenue" value={`₹${(totalRevenue/1000).toFixed(0)}K`} change={18.2}
            icon={<DollarSign className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[40,55,48,62,71,65,80]} />
          <KpiCard title="Avg Rev / Client" value={`₹${(avgRevPerClient/1000).toFixed(1)}K`} change={14.1}
            icon={<TrendingUp className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" sparkline={[20,22,21,25,27,24,28]} />
          <KpiCard title="Inactive Clients" value={inactiveClients.length} change={-8.0}
            icon={<UserX className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[5,4,4,3,2,2,1]} />
          <KpiCard title="Expiring Contracts" value={expiringContracts.length} change={0}
            icon={<FileText className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[1,2,1,2,1,2,1]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Revenue Trend" subtitle="Monthly" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#clientRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Client Status">
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
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No client data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Top Clients by Revenue" height={240}>
            {topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ left: 4, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No invoice data</div>
            )}
          </ChartCard>
          <ChartCard title="Client Tier Distribution" height={240}>
            {tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={tierData} cx="50%" cy="45%" outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {tierData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No tier data</div>
            )}
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: "positive", text: `${activeClients.length} active clients generating ₹${totalRevenue.toLocaleString()} in total revenue.` },
          { type: "warning", text: expiringContracts.length > 0 ? `${expiringContracts.length} client contracts expire within 30 days. Initiate renewals now to avoid disruption.` : "No contracts expiring soon. Good standing." },
          { type: "info", text: `Average revenue per client: ₹${avgRevPerClient.toLocaleString()}. Focus on upselling to existing clients to grow this metric.` },
          { type: "negative", text: `${inactiveClients.length} inactive clients. Consider re-engagement campaigns to win back lapsed accounts.` },
        ]} />

        <ReportDataTable
          title="Client Directory"
          data={tableData as any[]}
          columns={[
            { key: "name", label: "Client Name", sortable: true },
            { key: "category", label: "Category", sortable: true },
            { key: "tier", label: "Tier" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "orders", label: "Orders", align: "center" },
            { key: "contractEnd", label: "Contract End", sortable: true },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Inactive" ? "bg-gray-100 text-gray-500" :
                "bg-blue-100 text-blue-700"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search clients..."
          emptyMessage="No clients yet. Add clients in the Clients section."
        />
      </div>
    </ReportShell>
  );
}
