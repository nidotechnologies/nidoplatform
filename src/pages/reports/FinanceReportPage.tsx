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
import { getInvoices } from "@/lib/invoiceStore";
import { getAllPOs } from "@/lib/purchaseOrderStore";
import { getReceipts } from "@/lib/paymentReceiptStore";
import { getOrders } from "@/lib/salesOrderStore";
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart, Line,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Receipt, AlertCircle, CreditCard } from "lucide-react";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];
export default function FinanceReportPage() {
  usePageMeta({ title: "Finance Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const invoices = useMemo(() => applyReportFilters(getInvoices(), filters), [liveRevision, filters]);
  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);
  const receipts = useMemo(() => applyReportFilters(getReceipts(), filters), [liveRevision, filters]);
  const orders = useMemo(() => applyReportFilters(getOrders(), filters), [liveRevision, filters]);

  const totalRevenue = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.grandTotal ?? 0), 0);
  const totalExpenses = pos.reduce((s, p) => s + (p.grandTotal ?? 0), 0);
  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const totalReceivables = invoices.filter(i => i.status !== "Paid" && i.status !== "Cancelled")
    .reduce((s, i) => s + (i.grandTotal ?? 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === "Overdue");
  const totalOverdue = overdueInvoices.reduce((s, i) => s + (i.grandTotal ?? 0), 0);

  const totalPaymentsReceived = receipts.reduce((s, r) => s + (r.amountReceived ?? 0), 0);

  // Invoice status
  const invStatusMap: Record<string, number> = {};
  invoices.forEach(i => { invStatusMap[i.status] = (invStatusMap[i.status] ?? 0) + 1; });
  const invStatusData = Object.entries(invStatusMap).map(([name, value]) => ({ name, value }));

  const monthlyPL = getRecentReportMonths().map(({ key, label }) => {
    const revenue = invoices
      .filter((invoice) => invoice.status === "Paid" && getReportMonthKey(invoice.invoiceDate ?? invoice.createdAt) === key)
      .reduce((sum, invoice) => sum + (invoice.grandTotal ?? 0), 0);
    const expenses = pos
      .filter((po) => getReportMonthKey(po.createdOn ?? po.createdAt) === key)
      .reduce((sum, po) => sum + (po.grandTotal ?? po.subtotal ?? 0), 0);
    return { month: label, revenue, expenses, profit: revenue - expenses };
  });

  // Payment method distribution
  const payModeMap: Record<string, number> = {};
  receipts.forEach(r => { payModeMap[r.paymentMode ?? "Other"] = (payModeMap[r.paymentMode ?? "Other"] ?? 0) + (r.amountReceived ?? 0); });
  const payModeData = Object.entries(payModeMap).map(([name, value]) => ({ name, value }));

  const invoiceTableData = invoices.slice(0, 50).map(i => ({
    invoiceNumber: i.invoiceNumber,
    date: i.invoiceDate,
    due: i.dueDate,
    client: i.clientName,
    subtotal: `₹${(i.subtotal ?? 0).toLocaleString()}`,
    tax: `₹${(i.totalTax ?? 0).toLocaleString()}`,
    total: `₹${(i.grandTotal ?? 0).toLocaleString()}`,
    status: i.status,
  }));

  return (
    <ReportShell title="Finance Reports" subtitle="P&L, cash flow, receivables, payables and tax summary">
      <div className="space-y-5">
        <ExportBar reportTitle="Finance Reports" />
        <FilterBar statuses={["Draft","Sent","Paid","Pending","Overdue","Cancelled"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total Revenue" value={`₹${(totalRevenue/1000).toFixed(0)}K`} change={18.2}
            icon={<DollarSign className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[40,55,48,62,71,65,80]} />
          <KpiCard title="Total Expenses" value={`₹${(totalExpenses/1000).toFixed(0)}K`} change={-8.1}
            icon={<TrendingDown className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[80,70,75,65,60,55,50]} />
          <KpiCard title="Gross Profit" value={`₹${(grossProfit/1000).toFixed(0)}K`} change={22.5}
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[30,40,38,52,60,58,72]} />
          <KpiCard title="Profit Margin" value={`${profitMargin}%`} change={3.1}
            icon={<TrendingUp className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[28,30,29,32,34,33,35]} />
          <KpiCard title="Receivables" value={`₹${(totalReceivables/1000).toFixed(0)}K`} change={-5.0}
            icon={<Receipt className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" sparkline={[50,45,42,40,38,35,32]} />
          <KpiCard title="Overdue Amount" value={`₹${(totalOverdue/1000).toFixed(0)}K`} change={-12.0}
            icon={<AlertCircle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[30,25,20,18,15,12,10]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Revenue vs Expenses vs Profit" subtitle="Monthly P&L" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyPL} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}K`} />
                <Tooltip formatter={(v: number, n: string) => [`₹${v.toLocaleString()}`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} dot={false} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Invoice Status">
            {invStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={invStatusData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {invStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No invoice data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Payment Method Distribution" height={230}>
            {payModeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payModeData} cx="50%" cy="45%" outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {payModeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Received"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No payment receipt data</div>
            )}
          </ChartCard>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Summary</h3>
            <div className="space-y-3">
              {[
                { label: "Gross Revenue", value: `₹${totalRevenue.toLocaleString()}`, color: "text-blue-600" },
                { label: "Total Expenses", value: `₹${totalExpenses.toLocaleString()}`, color: "text-red-500" },
                { label: "Gross Profit", value: `₹${grossProfit.toLocaleString()}`, color: grossProfit >= 0 ? "text-emerald-600" : "text-red-600" },
                { label: "Profit Margin", value: `${profitMargin}%`, color: "text-purple-600" },
                { label: "Payments Received", value: `₹${totalPaymentsReceived.toLocaleString()}`, color: "text-amber-600" },
                { label: "Outstanding Receivables", value: `₹${totalReceivables.toLocaleString()}`, color: "text-gray-700" },
                { label: "Overdue", value: `₹${totalOverdue.toLocaleString()}`, color: "text-red-500" },
                { label: "Total Invoices", value: invoices.length, color: "text-gray-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AiInsightsPanel insights={[
          { type: "positive", text: `Gross profit is ₹${grossProfit.toLocaleString()} with a ${profitMargin}% margin. Margins are improving.` },
          { type: "warning", text: overdueInvoices.length > 0 ? `${overdueInvoices.length} invoices totalling ₹${totalOverdue.toLocaleString()} are overdue. Send immediate payment reminders.` : "No overdue invoices — excellent collections performance." },
          { type: "negative", text: `Expenses (₹${totalExpenses.toLocaleString()}) are consuming ${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(0) : 0}% of revenue. Look for procurement savings.` },
          { type: "info", text: `Total receivables outstanding: ₹${totalReceivables.toLocaleString()}. Implement stricter payment terms for large balances.` },
        ]} />

        <ReportDataTable
          title="Invoice Register"
          data={invoiceTableData as any[]}
          columns={[
            { key: "invoiceNumber", label: "Invoice #", sortable: true },
            { key: "date", label: "Date", sortable: true },
            { key: "due", label: "Due Date", sortable: true },
            { key: "client", label: "Client", sortable: true },
            { key: "subtotal", label: "Subtotal", align: "right" },
            { key: "tax", label: "Tax", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Paid" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Overdue" ? "bg-red-100 text-red-600" :
                r.status === "Sent" ? "bg-blue-100 text-blue-700" :
                r.status === "Draft" ? "bg-gray-100 text-gray-500" :
                "bg-amber-100 text-amber-700"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search invoices..."
          emptyMessage="No invoices yet. Create invoices in Transactions → Sales."
        />
      </div>
    </ReportShell>
  );
}
