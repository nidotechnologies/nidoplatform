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
import { applyReportFilters } from "@/lib/reportData";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";
import { Clock, CheckCircle, AlertTriangle, TrendingUp, Shield, Zap } from "lucide-react";

const PIE_COLORS = ["#10B981","#EF4444","#F59E0B","#2563EB","#8B5CF6"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul"];

export default function SlaReportPage() {
  usePageMeta({ title: "SLA Reports" });
  const liveRevision = useLiveReportRevision();
  const filters = useReportFilters();
  const tickets = useMemo(() => applyReportFilters(getSupportTickets(), filters), [liveRevision, filters]);

  // Simulate SLA compliance based on ticket data
  const resolved = tickets.filter(t => t.status === "resolved");
  const open = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const highPri = tickets.filter(t => t.priority === "high");
  const medPri = tickets.filter(t => t.priority === "medium");

  // SLA compliance rate (mock: resolved on time = ~85% of resolved tickets)
  const slaCompliant = Math.round(resolved.length * 0.85);
  const slaBreach = resolved.length - slaCompliant;
  const complianceRate = tickets.length > 0 ? ((slaCompliant / Math.max(1, tickets.length)) * 100).toFixed(1) : "0.0";

  // Priority SLA target (hours)
  const prioritySla = [
    { priority: "High", target: 4, actual: 3.2, breached: Math.round(highPri.length * 0.12) },
    { priority: "Medium", target: 8, actual: 7.1, breached: Math.round(medPri.length * 0.08) },
    { priority: "Low", target: 24, actual: 18.5, breached: Math.round(tickets.filter(t => t.priority === "low").length * 0.05) },
  ];

  // Monthly compliance trend
  const monthlyCompliance = MONTHS.map(m => ({
    month: m,
    compliance: Math.round(75 + Math.random() * 20),
    breach: Math.round(5 + Math.random() * 15),
  }));

  // SLA compliance gauge data
  const gaugeData = [
    { name: "Compliant", value: parseFloat(complianceRate), fill: "#10B981" },
  ];

  // Department SLA (mock)
  const deptData = ["IT", "Procurement", "Finance", "HR", "Operations"].map(dept => ({
    dept,
    compliance: Math.round(70 + Math.random() * 25),
    tickets: Math.round(2 + Math.random() * 8),
  }));

  const tableData = tickets.slice(0, 50).map((t, i) => ({
    number: t.number,
    subject: t.subject,
    priority: t.priority,
    status: t.status,
    created: t.created,
    slaTarget: t.priority === "high" ? "4 hrs" : t.priority === "medium" ? "8 hrs" : "24 hrs",
    slaStatus: i % 7 === 0 ? "Breached" : t.status === "resolved" ? "Met" : "Pending",
  }));

  return (
    <ReportShell title="SLA Reports" subtitle="Compliance tracking, breach analysis, resolution times and priority performance">
      <div className="space-y-5">
        <ExportBar reportTitle="SLA Reports" />
        <FilterBar statuses={["open","in_progress","resolved"]} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard title="SLA Compliance" value={`${complianceRate}%`} change={11.0}
            icon={<Shield className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50" sparkline={[70,72,75,78,80,83,85]} />
          <KpiCard title="Compliant Tickets" value={slaCompliant} change={8.5}
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" sparkline={[10,12,15,18,20,22,25]} />
          <KpiCard title="SLA Breaches" value={slaBreach} change={-18.0}
            icon={<AlertTriangle className="w-4 h-4 text-red-500" />} iconBg="bg-red-50" sparkline={[8,7,6,5,4,4,3]} />
          <KpiCard title="Avg Resolution" value="6.2 hrs" change={-12.0}
            icon={<Clock className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50" sparkline={[9,8.5,8,7.5,7,6.5,6]} />
          <KpiCard title="Pending SLA" value={open.length} change={-5.0}
            icon={<Zap className="w-4 h-4 text-amber-500" />} iconBg="bg-amber-50" sparkline={[15,13,12,11,10,9,8]} />
          <KpiCard title="High Priority" value={highPri.length} change={-10.0}
            icon={<TrendingUp className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50" sparkline={[8,7,6,5,5,4,3]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ChartCard title="Monthly SLA Trend" subtitle="Compliance vs Breach %" className="col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCompliance} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number, n: string) => [`${v}%`, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="compliance" stroke="#10B981" strokeWidth={2} dot={false} name="Compliance %" />
                <Line type="monotone" dataKey="breach" stroke="#EF4444" strokeWidth={2} dot={false} name="Breach %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="SLA by Priority">
            <div className="h-full flex flex-col justify-center space-y-4 py-2">
              {prioritySla.map(p => (
                <div key={p.priority} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{p.priority}</span>
                    <span className="text-gray-500">Target: {p.target}h · Actual: {p.actual}h</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${p.actual <= p.target ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, (p.actual / p.target) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{p.breached} breached</p>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Department SLA Compliance" height={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Compliance"]} />
                <Bar dataKey="compliance" fill="#2563EB" radius={[4, 4, 0, 0]} name="Compliance %" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">SLA Performance Summary</h3>
            <div className="space-y-3">
              {prioritySla.map(p => (
                <div key={p.priority} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{p.priority} Priority</p>
                    <p className="text-[10px] text-gray-400">Target: {p.target}h · Actual avg: {p.actual}h</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${p.actual <= p.target ? "text-emerald-600" : "text-red-500"}`}>
                      {p.actual <= p.target ? "✓ Met" : "✗ Breached"}
                    </p>
                    <p className="text-[10px] text-gray-400">{p.breached} breaches</p>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Overall Compliance</span>
                  <span className="text-lg font-bold text-emerald-600">{complianceRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AiInsightsPanel insights={[
          { type: "positive", text: `SLA compliance improved by 11% to ${complianceRate}%. Team is meeting response time targets effectively.` },
          { type: "warning", text: slaBreach > 0 ? `${slaBreach} SLA breaches detected. Review ticket assignment and escalation workflows.` : "No SLA breaches. Excellent performance." },
          { type: "info", text: `High-priority tickets have an average resolution time of 3.2 hours against the 4-hour target — 20% buffer maintained.` },
          { type: "positive", text: `${open.length} tickets are currently within SLA window. Monitor these to maintain compliance.` },
        ]} />

        <ReportDataTable
          title="Ticket SLA Status"
          data={tableData as any[]}
          columns={[
            { key: "number", label: "Ticket #", sortable: true },
            { key: "subject", label: "Subject" },
            { key: "priority", label: "Priority", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.priority === "high" ? "bg-red-100 text-red-600" :
                r.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
              }`}>{r.priority}</span>
            )},
            { key: "slaTarget", label: "SLA Target" },
            { key: "created", label: "Created", sortable: true },
            { key: "slaStatus", label: "SLA Status", render: (r: any) => (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                r.slaStatus === "Met" ? "bg-emerald-100 text-emerald-700" :
                r.slaStatus === "Breached" ? "bg-red-100 text-red-600" :
                "bg-amber-100 text-amber-700"
              }`}>{r.slaStatus}</span>
            )},
          ]}
          searchPlaceholder="Search SLA records..."
          emptyMessage="No tickets found."
        />
      </div>
    </ReportShell>
  );
}
