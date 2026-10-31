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
import { getSupportTickets } from "@/lib/supportTicketStore";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { applyReportFilters } from "@/lib/reportData";
import { getRecentReportMonths, getReportMonthKey } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { HeadphonesIcon, CheckCircle, Clock, AlertTriangle, XCircle, TrendingDown } from "lucide-react";

const PIE_COLORS = ["#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6"];

export default function SupportReportPage() {
  usePageMeta({ title: "Support Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const tickets = useMemo(() => applyReportFilters(getSupportTickets(), filters), [liveRevision, filters]);
  const serviceReqs = useMemo(() => applyReportFilters(getServiceRequests(), filters), [liveRevision, filters]);

  const openTickets    = tickets.filter(t => t.status === "open");
  const inProgressTickets = tickets.filter(t => t.status === "in_progress");
  const resolvedTickets = tickets.filter(t => t.status === "resolved");
  const highPriority   = tickets.filter(t => t.priority === "high");
  const resolutionRate = tickets.length > 0
    ? ((resolvedTickets.length / tickets.length) * 100).toFixed(1) : "0.0";

  // Status distribution
  const statusMap: Record<string, number> = {};
  tickets.forEach(t => { statusMap[t.status] = (statusMap[t.status] ?? 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({
    name: name === "in_progress" ? "In Progress" : name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Priority distribution
  const priMap: Record<string, number> = {};
  tickets.forEach(t => { priMap[t.priority] = (priMap[t.priority] ?? 0) + 1; });
  const priorityData = Object.entries(priMap).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Service request type distribution
  const reqTypeMap: Record<string, number> = {};
  serviceReqs.forEach(r => { reqTypeMap[r.requestType] = (reqTypeMap[r.requestType] ?? 0) + 1; });
  const reqTypeData = Object.entries(reqTypeMap).map(([name, value]) => ({ name, value }));

  const weeklyTrend = getRecentReportMonths().map(({ key, label }) => {
    const monthTickets = tickets.filter((ticket) => getReportMonthKey(ticket.created) === key);
    return {
      week: label,
      opened: monthTickets.length,
      resolved: monthTickets.filter((ticket) => ticket.status === "resolved").length,
    };
  });

  // Service request status
  const svcStatusMap: Record<string, number> = {};
  serviceReqs.forEach(r => { svcStatusMap[r.status] = (svcStatusMap[r.status] ?? 0) + 1; });
  const svcStatusData = Object.entries(svcStatusMap).map(([name, value]) => ({ name, value }));

  const tableData = tickets.slice(0, 50).map(t => ({
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    created: t.created,
  }));

  return (
    <ReportShell title="Support Reports" subtitle="Ticket volume, resolution rates, SLA performance and team efficiency">
      <div className="space-y-5">
        <ExportBar reportTitle="Support Reports" />
        <FilterBar statuses={["open","in_progress","resolved"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="Total Tickets" value={tickets.length} change={-5.2}
            icon={<HeadphonesIcon className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[20,18,22,15,12,10,8]} />
          <KpiCard title="Open Tickets" value={openTickets.length} change={-15.3}
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} iconBg="bg-amber-50" sparkline={[12,10,11,8,7,6,5]} />
          <KpiCard title="In Progress" value={inProgressTickets.length} change={3.1}
            icon={<Clock className="w-4 h-4 text-blue-500" />} iconBg="bg-blue-50" sparkline={[5,6,7,8,7,6,7]} />
          <KpiCard title="Resolved" value={resolvedTickets.length} change={22.5}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[5,8,10,15,18,20,25]} />
          <KpiCard title="Resolution Rate" value={`${resolutionRate}%`} change={8.2}
            icon={<TrendingDown className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[40,50,55,60,68,72,78]} />
          <KpiCard title="High Priority" value={highPriority.length} change={-10.0}
            icon={<XCircle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[8,7,6,5,5,4,3]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Ticket Trend" subtitle="Opened vs Resolved" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="opened" stroke="#EF4444" strokeWidth={2} dot={false} name="Opened" />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="By Status">
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
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No ticket data</div>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="By Priority" height={230}>
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No data</div>
            )}
          </ChartCard>
          <ChartCard title="Service Requests by Type" height={230}>
            {reqTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reqTypeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No service requests</div>
            )}
          </ChartCard>
          <ChartCard title="Service Request Status" height={230}>
            {svcStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={svcStatusData} cx="50%" cy="45%" outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {svcStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No data</div>
            )}
          </ChartCard>
        </div>

        <AiInsightsPanel insights={[
          { type: resolvedTickets.length > openTickets.length ? "positive" : "warning",
            text: `Resolution rate is ${resolutionRate}%. ${resolvedTickets.length} tickets resolved vs ${openTickets.length} still open.` },
          { type: "warning", text: highPriority.length > 0 ? `${highPriority.length} high-priority tickets require immediate attention.` : "No high-priority open tickets. Well managed." },
          { type: "info", text: `${serviceReqs.length} service requests on record across ${Object.keys(reqTypeMap).length} request types.` },
          { type: "positive", text: `${inProgressTickets.length} tickets are currently being actively worked on by the support team.` },
        ]} />

        <ReportDataTable
          title="Support Tickets"
          data={tableData as any[]}
          columns={[
            { key: "number", label: "Ticket #", sortable: true },
            { key: "subject", label: "Subject", sortable: true },
            { key: "priority", label: "Priority", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.priority === "high" ? "bg-red-100 text-red-600" :
                r.priority === "medium" ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-500"
              }`}>{r.priority}</span>
            )},
            { key: "status", label: "Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                r.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                "bg-amber-100 text-amber-700"
              }`}>{r.status === "in_progress" ? "In Progress" : r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
            )},
            { key: "created", label: "Created", sortable: true },
          ]}
          searchPlaceholder="Search tickets..."
          emptyMessage="No support tickets yet."
        />
      </div>
    </ReportShell>
  );
}
