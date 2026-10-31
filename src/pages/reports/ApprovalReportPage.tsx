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
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { applyReportFilters, getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { CheckSquare, Clock, XCircle, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

const PIE_COLORS = ["#10B981","#EF4444","#F59E0B","#2563EB","#8B5CF6"];

export default function ApprovalReportPage() {
  usePageMeta({ title: "Approval Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const pos = useMemo(() => applyReportFilters(getAllPOs(), filters), [liveRevision, filters]);
  const serviceReqs = useMemo(() => applyReportFilters(getServiceRequests(), filters), [liveRevision, filters]);

  // PO approval status
  const pendingPOs    = pos.filter(p => p.status === "Draft" || p.status === "Processing");
  const approvedPOs   = pos.filter(p => p.status === "Confirmed" || p.status === "Shipped" || p.status === "Delivered");
  const rejectedPOs   = pos.filter(p => p.status === "Cancelled");
  const approvalRate  = pos.length > 0 ? ((approvedPOs.length / pos.length) * 100).toFixed(1) : "0.0";

  // Service request approvals
  const pendingSvc  = serviceReqs.filter(r => r.status === "Pending" || r.status === "pending");
  const approvedSvc = serviceReqs.filter(r => r.status === "Approved" || r.status === "approved" || r.status === "Completed");
  const rejectedSvc = serviceReqs.filter(r => r.status === "Rejected" || r.status === "rejected" || r.status === "Cancelled");

  // Combined approval summary
  const totalPending  = pendingPOs.length + pendingSvc.length;
  const totalApproved = approvedPOs.length + approvedSvc.length;
  const totalRejected = rejectedPOs.length + rejectedSvc.length;
  const total = totalPending + totalApproved + totalRejected;

  const statusData = [
    { name: "Approved", value: totalApproved },
    { name: "Pending", value: totalPending },
    { name: "Rejected", value: totalRejected },
  ].filter(d => d.value > 0);

  // PO approval by vendor
  const vendorMap: Record<string, { approved: number; rejected: number }> = {};
  pos.forEach(p => {
    const v = p.vendorName ?? "Unknown";
    if (!vendorMap[v]) vendorMap[v] = { approved: 0, rejected: 0 };
    if (approvedPOs.includes(p)) vendorMap[v].approved++;
    if (rejectedPOs.includes(p)) vendorMap[v].rejected++;
  });
  const vendorApproval = Object.entries(vendorMap).sort((a, b) => (b[1].approved + b[1].rejected) - (a[1].approved + a[1].rejected)).slice(0, 6)
    .map(([name, d]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, ...d }));

  const monthlyData = getRecentReportMonths().map(({ key, label }) => {
    const records = [
      ...pos.map((po) => ({ date: po.createdOn ?? po.createdAt, status: po.status })),
      ...serviceReqs.map((request) => ({ date: request.requestDate ?? request.createdAt, status: request.status })),
    ].filter((record) => getReportMonthKey(record.date) === key);
    return {
      month: label,
      approved: records.filter((record) => ["Confirmed", "Shipped", "Delivered", "Approved", "Completed", "approved", "completed"].includes(record.status)).length,
      pending: records.filter((record) => ["Draft", "Processing", "Pending", "pending"].includes(record.status)).length,
      rejected: records.filter((record) => ["Cancelled", "Rejected", "rejected"].includes(record.status)).length,
    };
  });

  // Service request by type
  const reqTypeMap: Record<string, number> = {};
  serviceReqs.forEach(r => { reqTypeMap[r.requestType] = (reqTypeMap[r.requestType] ?? 0) + 1; });
  const reqTypeData = Object.entries(reqTypeMap).map(([name, value]) => ({ name, value }));

  const tableData = [
    ...pos.slice(0, 30).map(p => ({
      ref: p.poNumber,
      type: "Purchase Order",
      description: `${p.items?.[0]?.item ?? p.item ?? "—"} from ${p.vendorName ?? "—"}`,
      amount: `₹${(p.grandTotal ?? 0).toLocaleString()}`,
      requestedBy: "Procurement",
      status: p.status,
    })),
    ...serviceReqs.slice(0, 20).map(r => ({
      ref: r.id,
      type: r.requestType,
      description: r.itemAsset ?? "—",
      amount: "—",
      requestedBy: r.requestedBy ?? "—",
      status: r.status,
    })),
  ];

  return (
    <ReportShell title="Approval Reports" subtitle="Pending approvals, approval rates, bottlenecks and approver performance">
      <div className="space-y-5">
        <ExportBar reportTitle="Approval Reports" />
        <FilterBar statuses={["Draft","Processing","Confirmed","Cancelled","Pending","Approved","Rejected"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total Requests" value={total} change={5.2}
            icon={<CheckSquare className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[8,10,9,12,13,12,14]} />
          <KpiCard title="Pending Approval" value={totalPending} change={-5.0}
            icon={<Clock className="w-4 h-4 text-amber-500" />} iconBg="bg-amber-50" sparkline={[8,7,6,5,4,5,3]} />
          <KpiCard title="Approved" value={totalApproved} change={12.3}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[2,3,4,5,6,5,7]} />
          <KpiCard title="Rejected" value={totalRejected} change={-20.0}
            icon={<XCircle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[5,4,3,2,2,1,1]} />
          <KpiCard title="Approval Rate" value={`${approvalRate}%`} change={8.0}
            icon={<TrendingUp className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[60,65,70,72,75,78,82]} />
          <KpiCard title="Avg Approval Time" value="2.4 days" change={-15.0}
            icon={<AlertCircle className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[4,3.8,3.5,3.2,3,2.8,2.4]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Approval Trend" subtitle="Monthly" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="approved" fill="#10B981" stackId="a" name="Approved" radius={[0,0,0,0]} />
                <Bar dataKey="pending" fill="#F59E0B" stackId="a" name="Pending" radius={[0,0,0,0]} />
                <Bar dataKey="rejected" fill="#EF4444" stackId="a" name="Rejected" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Status Distribution">
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
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="PO Approvals by Vendor" height={240}>
            {vendorApproval.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorApproval} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="approved" fill="#10B981" name="Approved" stackId="v" radius={[0,0,0,0]} />
                  <Bar dataKey="rejected" fill="#EF4444" name="Rejected" stackId="v" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No PO data yet</div>
            )}
          </ChartCard>
          <ChartCard title="Service Requests by Type" height={240}>
            {reqTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reqTypeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[4,4,0,0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No service requests</div>
            )}
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: "positive", text: `Approval rate is ${approvalRate}% — ${totalApproved} out of ${total} requests have been approved.` },
          { type: "warning", text: totalPending > 0 ? `${totalPending} requests are waiting for approval. Delays may impact procurement timelines.` : "No pending approvals. Queue is clear." },
          { type: "positive", text: `Average approval time has improved to 2.4 days — a 15% reduction. Streamlined workflows are working.` },
          { type: "info", text: totalRejected > 0 ? `${totalRejected} requests were rejected. Review rejection reasons to improve request quality and reduce rework.` : "No rejected requests in the current period." },
        ]} />

        <ReportDataTable
          title="Approval Queue"
          data={tableData as any[]}
          columns={[
            { key: "ref", label: "Reference", sortable: true },
            { key: "type", label: "Type", sortable: true },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "requestedBy", label: "Requested By" },
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "Confirmed" || r.status === "Approved" || r.status === "Delivered" ? "bg-emerald-100 text-emerald-700" :
                r.status === "Cancelled" || r.status === "Rejected" ? "bg-red-100 text-red-600" :
                r.status === "Draft" || r.status === "Pending" ? "bg-amber-100 text-amber-700" :
                "bg-blue-100 text-blue-700"
              }`}>{r.status}</span>
            )},
          ]}
          searchPlaceholder="Search approvals..."
          emptyMessage="No approval requests found."
        />
      </div>
    </ReportShell>
  );
}
