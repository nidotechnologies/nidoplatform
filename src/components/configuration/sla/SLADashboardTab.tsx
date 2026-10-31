import { useMemo } from "react";
import { CheckCircle, AlertTriangle, XCircle, Clock, TrendingUp, Layers, Wrench, ClipboardList, Users, Truck } from "lucide-react";
import { getVendorSLA, getClientSLA, getProcurementSLA, getServiceSLA, getApprovalSLA, getEscalationRules } from "@/lib/slaEngine";

function KPICard({ label, value, sub, color, Icon }: { label: string; value: string | number; sub: string; color: string; Icon: React.ElementType }) {
  const colors: Record<string, string> = {
    green:  "bg-green-50 text-green-700 border-green-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  const iconColors: Record<string, string> = {
    green: "text-green-500", blue: "text-blue-500", amber: "text-amber-500", red: "text-red-500", purple: "text-purple-500",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon size={20} className={iconColors[color]} />
      </div>
      <p className="text-xs opacity-70">{sub}</p>
    </div>
  );
}

function SLABar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const barColor = color === "green" ? "bg-green-500" : color === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SLADashboardTab() {
  const stats = useMemo(() => {
    const vendor   = getVendorSLA();
    const clients  = getClientSLA();
    const proc     = getProcurementSLA();
    const services = getServiceSLA();
    const approvals= getApprovalSLA();
    const escalations = getEscalationRules();

    const activeVendor   = vendor.enabled ? 1 : 0;
    const activeClients  = clients.filter(c => c.enabled).length;
    const activeProc     = proc.filter(s => s.enabled).length;
    const activeServices = services.filter(s => s.enabled).length;
    const activeApprovals= approvals.filter(a => a.enabled).length;
    const activeEscl     = escalations.filter(e => e.enabled).length;

    const totalActive = activeVendor + activeClients + activeProc + activeServices + activeApprovals + activeEscl;

    return { vendor, clients, proc, services, approvals, escalations, activeVendor, activeClients, activeProc, activeServices, activeApprovals, activeEscl, totalActive };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">SLA Dashboard</h2>
        <p className="text-xs text-gray-500 mt-0.5">Overview of all active SLA policies and compliance indicators</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Active SLAs"  value={stats.totalActive}       sub="across all modules"       color="blue"   Icon={Layers} />
        <KPICard label="Vendor SLA"         value={stats.activeVendor ? "On" : "Off"} sub={`${stats.vendor.onTimeDeliveryPct}% on-time target`} color={stats.activeVendor ? "green" : "amber"} Icon={Truck} />
        <KPICard label="Client Tiers"       value={stats.activeClients}     sub="tiers configured"         color="purple" Icon={Users} />
        <KPICard label="Procurement Stages" value={stats.activeProc}        sub={`of ${stats.proc.length} stages`} color="blue" Icon={ClipboardList} />
        <KPICard label="Service Categories" value={stats.activeServices}    sub={`of ${stats.services.length} types`} color="green" Icon={Wrench} />
        <KPICard label="Approval Workflows" value={stats.activeApprovals}   sub={`of ${stats.approvals.length} types`} color="amber" Icon={CheckCircle} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Vendor Performance Targets */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Vendor Performance Targets</h3>
          <SLABar label="On-Time Delivery"   pct={stats.vendor.onTimeDeliveryPct}  color={stats.vendor.onTimeDeliveryPct >= 90 ? "green" : stats.vendor.onTimeDeliveryPct >= 75 ? "amber" : "red"} />
          <SLABar label="Order Fulfilment"   pct={stats.vendor.orderFulfilmentPct} color={stats.vendor.orderFulfilmentPct >= 90 ? "green" : "amber"} />
          <SLABar label="Acceptance Rate"    pct={stats.vendor.acceptanceRatePct}  color={stats.vendor.acceptanceRatePct >= 85 ? "green" : "amber"} />
        </div>

        {/* Procurement SLA Coverage */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><ClipboardList size={14} className="text-purple-500" /> Procurement SLA Coverage</h3>
          {stats.proc.slice(0, 6).map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 truncate">{s.stage}</span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-gray-500">{s.targetTimeHrs}h target</span>
                {s.enabled
                  ? <span className="flex items-center gap-0.5 text-green-600 font-medium"><CheckCircle size={11} /> Active</span>
                  : <span className="flex items-center gap-0.5 text-gray-400"><XCircle size={11} /> Off</span>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Service SLA Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><Wrench size={14} className="text-green-500" /> Service SLA Summary</h3>
          {stats.services.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{s.category}</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 font-medium flex items-center gap-0.5"><Clock size={10} /> {s.firstResponseTimeHrs}h resp</span>
                <span className="text-green-600 font-medium">{s.resolutionTimeHrs}h res</span>
                {s.enabled ? <CheckCircle size={11} className="text-green-500" /> : <XCircle size={11} className="text-gray-300" />}
              </div>
            </div>
          ))}
        </div>

        {/* Escalation Engine Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Escalation Engine</h3>
          {stats.escalations.map(e => (
            <div key={e.level} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {e.enabled ? <CheckCircle size={11} className="text-green-500" /> : <XCircle size={11} className="text-gray-300" />}
                <span className="text-gray-700 font-medium">{e.label}</span>
                <span className="text-gray-500">→ {e.notifyRole}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <Clock size={10} /> {e.triggerAfterHrs}h
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval SLA Overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-blue-500" /> Approval SLA Overview</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Approval Type</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">Response</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">Deadline</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">L1 Escalation</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">Auto Escalate</th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.approvals.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{a.approvalType}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{a.responseTimeHrs}h</td>
                  <td className="px-3 py-2 text-center text-gray-600">{a.approvalDeadlineHrs}h</td>
                  <td className="px-3 py-2 text-center text-amber-600">{a.escalationLevel1Hrs}h</td>
                  <td className="px-3 py-2 text-center">{a.autoEscalation ? <CheckCircle size={12} className="text-green-500 mx-auto" /> : <XCircle size={12} className="text-gray-300 mx-auto" />}</td>
                  <td className="px-3 py-2 text-center">{a.enabled ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Off</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
