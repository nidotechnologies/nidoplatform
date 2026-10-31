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
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Receipt, DollarSign, TrendingUp, FileText, Calculator, CheckCircle } from "lucide-react";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];
export default function TaxReportPage() {
  usePageMeta({ title: "Tax Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const invoices = useMemo(() => applyReportFilters(getInvoices(), filters), [liveRevision, filters]);
  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);

  // Tax collected (sales side)
  const taxCollected = invoices.reduce((s, i) => s + (i.totalTax ?? 0), 0);
  // Tax paid (purchase side)
  const taxPaid = pos.reduce((s, p) => s + ((p.sgstAmt ?? 0) + (p.cgstAmt ?? 0)), 0);
  // Net GST liability
  const netGst = taxCollected - taxPaid;

  // GST breakdown from invoices
  const cgstTotal = invoices.reduce((s, i) => {
    const slabs = (i as any).gstSlabs ?? [];
    return s + slabs.reduce((ss: number, sl: any) => ss + (sl.cgst ?? 0), 0);
  }, 0);
  const sgstTotal = invoices.reduce((s, i) => {
    const slabs = (i as any).gstSlabs ?? [];
    return s + slabs.reduce((ss: number, sl: any) => ss + (sl.sgst ?? 0), 0);
  }, 0);
  const igstTotal = Math.max(0, taxCollected - cgstTotal - sgstTotal);

  // HSN-level tax distribution (mock)
  const hsnData = [
    { hsn: "8471", desc: "Computers", taxable: Math.round(taxCollected * 0.35), gst: Math.round(taxCollected * 0.35 * 0.18) },
    { hsn: "8517", desc: "Phones/Networking", taxable: Math.round(taxCollected * 0.25), gst: Math.round(taxCollected * 0.25 * 0.18) },
    { hsn: "8443", desc: "Printers", taxable: Math.round(taxCollected * 0.15), gst: Math.round(taxCollected * 0.15 * 0.12) },
    { hsn: "9403", desc: "Furniture", taxable: Math.round(taxCollected * 0.10), gst: Math.round(taxCollected * 0.10 * 0.12) },
    { hsn: "8528", desc: "Displays", taxable: Math.round(taxCollected * 0.15), gst: Math.round(taxCollected * 0.15 * 0.18) },
  ];

  const monthlyTax = getRecentReportMonths().map(({ key, label }) => ({
    month: label,
    collected: invoices
      .filter((invoice) => getReportMonthKey(invoice.invoiceDate ?? invoice.createdAt) === key)
      .reduce((sum, invoice) => sum + (invoice.totalTax ?? 0), 0),
    paid: pos
      .filter((po) => getReportMonthKey(po.createdOn ?? po.createdAt) === key)
      .reduce((sum, po) => sum + (po.sgstAmt ?? 0) + (po.cgstAmt ?? 0), 0),
  }));

  // GST component breakdown
  const gstBreakdown = [
    { name: "CGST", value: Math.round(cgstTotal) },
    { name: "SGST", value: Math.round(sgstTotal) },
    { name: "IGST", value: Math.round(igstTotal) },
  ].filter(d => d.value > 0);

  // Tax rate distribution
  const rateMap: Record<string, number> = {};
  invoices.forEach(i => {
    const slabs = (i as any).gstSlabs ?? [];
    slabs.forEach((sl: any) => {
      const rate = `${sl.rate ?? 18}%`;
      rateMap[rate] = (rateMap[rate] ?? 0) + (sl.taxable ?? 0);
    });
  });
  const rateData = Object.entries(rateMap).map(([rate, taxable]) => ({ rate, taxable }));

  const invoiceTableData = invoices.slice(0, 50).map(i => {
    const slabs = (i as any).gstSlabs ?? [];
    const cgst = slabs.reduce((s: number, sl: any) => s + (sl.cgst ?? 0), 0);
    const sgst = slabs.reduce((s: number, sl: any) => s + (sl.sgst ?? 0), 0);
    return {
      invoiceNumber: i.invoiceNumber,
      date: i.invoiceDate,
      client: i.clientName,
      taxable: `₹${(i.subtotal ?? 0).toLocaleString()}`,
      cgst: `₹${cgst.toLocaleString()}`,
      sgst: `₹${sgst.toLocaleString()}`,
      igst: `₹${Math.max(0, (i.totalTax ?? 0) - cgst - sgst).toLocaleString()}`,
      totalTax: `₹${(i.totalTax ?? 0).toLocaleString()}`,
      status: i.status,
    };
  });

  return (
    <ReportShell title="Tax Reports" subtitle="GST summary, CGST/SGST/IGST breakdown, HSN analysis and tax audit trail">
      <div className="space-y-5">
        <ExportBar reportTitle="Tax Reports" />
        <FilterBar statuses={["Draft","Sent","Paid","Overdue"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Tax Collected" value={`₹${(taxCollected/1000).toFixed(0)}K`} change={18.2}
            icon={<Receipt className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[10,14,12,16,18,16,20]} />
          <KpiCard title="Tax Paid (Input)" value={`₹${(taxPaid/1000).toFixed(0)}K`} change={-5.0}
            icon={<DollarSign className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[8,7,7,6,6,5,5]} />
          <KpiCard title="Net GST Liability" value={`₹${(netGst/1000).toFixed(0)}K`} change={22.5}
            icon={<Calculator className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[5,7,6,9,10,9,12]} />
          <KpiCard title="CGST" value={`₹${(cgstTotal/1000).toFixed(0)}K`} change={8.1}
            icon={<FileText className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" sparkline={[4,5,5,6,7,7,8]} />
          <KpiCard title="SGST" value={`₹${(sgstTotal/1000).toFixed(0)}K`} change={8.1}
            icon={<FileText className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[4,5,5,6,7,7,8]} />
          <KpiCard title="IGST" value={`₹${(igstTotal/1000).toFixed(0)}K`} change={5.2}
            icon={<TrendingUp className="w-4 h-4 text-indigo-600" />} iconBg="bg-indigo-50" sparkline={[2,2,3,3,4,4,5]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Monthly Tax Trend" subtitle="Collected vs Paid" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTax} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${v/1000}K`} />
                <Tooltip formatter={(v: number, n: string) => [`₹${v.toLocaleString()}`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="collected" stroke="#2563EB" strokeWidth={2} dot={false} name="Tax Collected" />
                <Line type="monotone" dataKey="paid" stroke="#EF4444" strokeWidth={2} dot={false} name="Tax Paid" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="GST Component Breakdown">
            {gstBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gstBreakdown} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {gstBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, ""]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No invoice tax data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="HSN-wise Tax Summary" height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hsnData} layout="vertical" margin={{ left: 4, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${v/1000}K`} />
                <YAxis type="category" dataKey="desc" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, ""]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="taxable" fill="#2563EB" name="Taxable Value" radius={[0,4,4,0]} />
                <Bar dataKey="gst" fill="#10B981" name="GST Amount" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">GST Summary Statement</h3>
            <div className="space-y-2">
              {[
                { label: "Total Taxable Value", value: `₹${invoices.reduce((s, i) => s + (i.subtotal ?? 0), 0).toLocaleString()}` },
                { label: "CGST Collected", value: `₹${Math.round(cgstTotal).toLocaleString()}` },
                { label: "SGST Collected", value: `₹${Math.round(sgstTotal).toLocaleString()}` },
                { label: "IGST Collected", value: `₹${Math.round(igstTotal).toLocaleString()}` },
                { label: "Total Output Tax", value: `₹${taxCollected.toLocaleString()}`, bold: true },
                { label: "Input Tax Credit (ITC)", value: `₹${taxPaid.toLocaleString()}` },
                { label: "Net GST Payable", value: `₹${Math.max(0, netGst).toLocaleString()}`, bold: true, color: "text-blue-600" },
                { label: "Total Invoices", value: invoices.length },
              ].map(({ label, value, bold, color }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm ${bold ? "font-bold" : "font-medium"} ${color ?? "text-gray-800"}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AiInsightsPanel insights={[
          { type: "info", text: `Total output GST collected: ₹${taxCollected.toLocaleString()}. Net GST liability after ITC: ₹${Math.max(0, netGst).toLocaleString()}.` },
          { type: "positive", text: `Input Tax Credit (ITC) of ₹${taxPaid.toLocaleString()} available from purchase bills. Ensure timely filing to claim ITC.` },
          { type: "warning", text: `CGST and SGST each stand at ₹${Math.round(cgstTotal).toLocaleString()} — verify against GSTR-1 before filing.` },
          { type: "info", text: `${invoices.length} invoices raised in the current period. Ensure all have valid HSN/SAC codes for accurate GST reporting.` },
        ]} />

        <ReportDataTable
          title="Invoice Tax Register"
          data={invoiceTableData as any[]}
          columns={[
            { key: "invoiceNumber", label: "Invoice #", sortable: true },
            { key: "date", label: "Date", sortable: true },
            { key: "client", label: "Client", sortable: true },
            { key: "taxable", label: "Taxable Value", align: "right" },
            { key: "cgst", label: "CGST", align: "right" },
            { key: "sgst", label: "SGST", align: "right" },
            { key: "igst", label: "IGST", align: "right" },
            { key: "totalTax", label: "Total Tax", align: "right" },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Paid" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Overdue" ? "bg-red-100 text-red-600" :
                r.status === "Sent" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-500"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search tax register..."
          emptyMessage="No invoices yet. Tax data will appear once invoices are created."
        />
      </div>
    </ReportShell>
  );
}
