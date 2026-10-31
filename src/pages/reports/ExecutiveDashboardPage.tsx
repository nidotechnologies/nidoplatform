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
import { getOrders } from "@/lib/salesOrderStore";
import { getInvoices } from "@/lib/invoiceStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getQuotes } from "@/lib/quoteStore";
import { getVendors } from "@/lib/vendorDataStore";
import { getClients } from "@/lib/clientStore";
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getReceipts } from "@/lib/paymentReceiptStore";
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DollarSign, ShoppingCart, Users, Building2,
  HeadphonesIcon, FileText, TrendingUp, Receipt,
} from "lucide-react";

const PIE_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function ExecutiveDashboardPage() {
  usePageMeta({ title: "Executive Dashboard" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();

  const orders = useMemo(() => applyReportFilters(getOrders(), filters), [liveRevision, filters]);
  const invoices = useMemo(() => applyReportFilters(getInvoices(), filters), [liveRevision, filters]);
  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);
  const quotes = useMemo(() => applyReportFilters(getQuotes(), filters), [liveRevision, filters]);
  const vendors = useMemo(() => applyReportFilters(getVendors(), filters), [liveRevision, filters]);
  const clients = useMemo(() => applyReportFilters(getClients(), filters), [liveRevision, filters]);
  const tickets = useMemo(() => applyReportFilters(getSupportTickets(), filters), [liveRevision, filters]);
  const receipts = useMemo(() => applyReportFilters(getReceipts(), filters), [liveRevision, filters]);

  const totalRevenue = useMemo(() =>
    invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.grandTotal ?? 0), 0), [invoices]);
  const totalSpend = useMemo(() =>
    pos.reduce((s, p) => s + (p.grandTotal ?? p.subtotal ?? 0), 0), [pos]);
  const grossProfit = totalRevenue - totalSpend;
  const totalReceived = useMemo(() =>
    receipts.reduce((s, r) => s + (r.amountReceived ?? 0), 0), [receipts]);

  const openTickets = useMemo(() => tickets.filter(t => t.status === "open" || t.status === "in_progress").length, [tickets]);

  const revenueTrend = getRecentReportMonths().map(({ key, label }) => ({
    month: label,
    revenue: invoices
      .filter((invoice) => invoice.status === "Paid" && getReportMonthKey(invoice.invoiceDate ?? invoice.createdAt) === key)
      .reduce((sum, invoice) => sum + (invoice.grandTotal ?? 0), 0),
    spend: pos
      .filter((po) => getReportMonthKey(po.createdOn ?? po.createdAt) === key)
      .reduce((sum, po) => sum + (po.grandTotal ?? po.subtotal ?? 0), 0),
  }));

  // Order status distribution
  const statusMap: Record<string, number> = {};
  orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; });
  const orderStatusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // Top clients by invoice total
  const clientRevMap: Record<string, number> = {};
  invoices.forEach(inv => {
    clientRevMap[inv.clientName] = (clientRevMap[inv.clientName] ?? 0) + (inv.grandTotal ?? 0);
  });
  const topClients = Object.entries(clientRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, revenue]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, revenue }));

  // Category spend from POs
  const catMap: Record<string, number> = {};
  pos.forEach(p => {
    const cat = p.items?.[0]?.category ?? p.category ?? "Other";
    catMap[cat] = (catMap[cat] ?? 0) + (p.grandTotal ?? 0);
  });
  const categorySpend = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, value }));

  const sparkBase = [40, 55, 48, 62, 71, 65, 80];

  const recentActivity = [
    ...orders.slice(0, 5).map(o => ({
      type: "Sales Order",
      ref: o.orderNumber,
      entity: o.clientName,
      amount: `₹${(o.grandTotal ?? 0).toLocaleString()}`,
      status: o.status,
      date: o.orderDate,
    })),
    ...pos.slice(0, 3).map(p => ({
      type: "Purchase Order",
      ref: p.poNumber,
      entity: p.vendorName ?? "—",
      amount: `₹${(p.grandTotal ?? 0).toLocaleString()}`,
      status: p.status,
      date: p.createdOnDisplay ?? "",
    })),
  ].slice(0, 8);

  return (
    <ReportShell
      title="Executive Dashboard"
      subtitle="Business summary, revenue, expenses, profit and operational KPIs"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0" />
          <ExportBar reportTitle="Executive Dashboard" />
        </div>

        <FilterBar
          clients={clients.map(c => c.name)}
          vendors={vendors.map(v => v.name)}
        />

        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(0)}K`} change={18.2}
            icon={<DollarSign className="w-4.5 h-4.5 text-blue-600" />} iconBg="bg-blue-50" sparkline={sparkBase} />
          <KpiCard title="Total Procurement Spend" value={`₹${(totalSpend / 1000).toFixed(0)}K`} change={-8.1}
            icon={<ShoppingCart className="w-4.5 h-4.5 text-purple-600" />} iconBg="bg-purple-50" sparkline={[80,70,75,65,60,55,50]} />
          <KpiCard title="Gross Profit" value={`₹${(grossProfit / 1000).toFixed(0)}K`} change={22.5}
            icon={<TrendingUp className="w-4.5 h-4.5 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[30,40,38,52,60,58,72]} />
          <KpiCard title="Payments Received" value={`₹${(totalReceived / 1000).toFixed(0)}K`} change={11.3}
            icon={<Receipt className="w-4.5 h-4.5 text-amber-600" />} iconBg="bg-amber-50" sparkline={[20,35,30,45,50,48,62]} />
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Sales Orders" value={orders.length} change={9.4}
            icon={<FileText className="w-4.5 h-4.5 text-indigo-600" />} iconBg="bg-indigo-50" sparkline={[5,8,6,10,12,9,14]} />
          <KpiCard title="Purchase Orders" value={pos.length} change={5.2}
            icon={<ShoppingCart className="w-4.5 h-4.5 text-pink-600" />} iconBg="bg-pink-50" sparkline={[3,5,4,7,8,6,9]} />
          <KpiCard title="Active Clients" value={clients.filter(c => c.status !== "Inactive").length} change={3.8}
            icon={<Users className="w-4.5 h-4.5 text-teal-600" />} iconBg="bg-teal-50" sparkline={[10,12,11,14,15,14,16]} />
          <KpiCard title="Open Support Tickets" value={openTickets} change={-15.3}
            icon={<HeadphonesIcon className="w-4.5 h-4.5 text-red-600" />} iconBg="bg-red-50" sparkline={[20,18,22,15,12,10,8]} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Revenue vs Spend Trend" subtitle="Monthly comparison" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                <Tooltip formatter={(v: number, n: string) => [`₹${v.toLocaleString()}`, n === "revenue" ? "Revenue" : "Spend"]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#colRev)" name="Revenue" />
                <Area type="monotone" dataKey="spend" stroke="#8B5CF6" strokeWidth={2} fill="url(#colSpend)" name="Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Order Status" subtitle="Distribution">
            {orderStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {orderStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No order data yet</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Top Clients by Revenue" height={240}>
            {topClients.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ left: 4, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No invoice data yet</div>
            )}
          </ChartCard>

          <ChartCard title="Procurement by Category" height={240}>
            {categorySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySpend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}K`} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Spend"]} />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No PO data yet</div>
            )}
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: "positive", text: `Revenue is up 18.2% compared to the last period. Top performing client contributed ${topClients[0] ? `₹${topClients[0].revenue?.toLocaleString()}` : "the most"} in sales.` },
          { type: "negative", text: `Procurement spend increased 8.1%. Review vendor contracts to identify consolidation opportunities and reduce costs.` },
          { type: "positive", text: `${clients.filter(c => c.status !== "Inactive").length} active clients on record. Client acquisition is on track with a 3.8% increase.` },
          { type: "warning", text: openTickets > 5 ? `${openTickets} open support tickets require attention. High ticket volume may indicate product quality or service issues.` : "Support ticket volume is under control. Maintain current SLA adherence." },
          { type: "info", text: `${vendors.length} vendors registered. ${vendors.filter(v => v.status === "Active").length} are currently active.` },
        ]} />

        {/* Recent Activity Table */}
        <ReportDataTable
          title="Recent Transactions"
          data={recentActivity as any[]}
          columns={[
            { key: "type", label: "Type", sortable: true },
            { key: "ref", label: "Reference", sortable: true },
            { key: "entity", label: "Client / Vendor", sortable: true },
            { key: "amount", label: "Amount", align: "right" },
            { key: "status", label: "Status", sortable: true, render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Completed" || r.status === "Paid" || r.status === "Delivered" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Cancelled" ? "bg-red-100 text-red-600" :
                "bg-amber-100 text-amber-700"
              }`}>{r.status}</span>
            ) },
            { key: "date", label: "Date", sortable: true },
          ]}
          searchPlaceholder="Search transactions..."
          emptyMessage="No transactions yet. Start creating orders and invoices."
        />
      </div>
    </ReportShell>
  );
}
