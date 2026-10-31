import { useState } from "react";
import { FileText, Download, Calendar, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getSLAAuditLog } from "@/lib/slaEngine";

const REPORT_TYPES = [
  { id: "vendor",       name: "Vendor SLA Report",         desc: "Vendor performance vs SLA commitments",      color: "blue"   },
  { id: "client",       name: "Client SLA Report",         desc: "Commitments delivered per client tier",      color: "purple" },
  { id: "procurement",  name: "Procurement SLA Report",    desc: "Stage-wise timeline compliance",             color: "indigo" },
  { id: "service",      name: "Service SLA Report",        desc: "Response & resolution metrics by category",  color: "green"  },
  { id: "approval",     name: "Approval SLA Report",       desc: "Approval turnaround and escalation data",    color: "amber"  },
  { id: "compliance",   name: "Monthly Compliance Report", desc: "Overall SLA compliance across all modules",  color: "teal"   },
  { id: "breach",       name: "SLA Breach Report",         desc: "All SLA violations with root cause",         color: "red"    },
  { id: "escalation",   name: "Escalation Report",         desc: "Escalated items and resolution status",      color: "orange" },
  { id: "trend",        name: "Performance Trend Report",  desc: "Month-over-month SLA trend analysis",        color: "cyan"   },
];

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  green:  "bg-green-50 text-green-700 border-green-200",
  amber:  "bg-amber-50 text-amber-700 border-amber-200",
  teal:   "bg-teal-50 text-teal-700 border-teal-200",
  red:    "bg-red-50 text-red-700 border-red-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  cyan:   "bg-cyan-50 text-cyan-700 border-cyan-200",
};

export default function SLAReportsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const [format, setFormat]   = useState("PDF");
  const auditLog = getSLAAuditLog();

  function handleExport(reportName: string) {
    toast({ title: `${reportName} export queued`, description: `${format} export will be ready shortly.` });
  }

  function handleEmailReport(reportName: string) {
    toast({ title: `${reportName} scheduled`, description: "Report will be emailed to your registered address." });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">SLA Reports</h2>
          <p className="text-xs text-gray-500 mt-0.5">Generate, export and schedule SLA performance reports</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Export Format</label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="Excel">Excel</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map(r => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${COLOR_MAP[r.color]}`}>
                <FileText size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1" onClick={() => handleExport(r.name)}>
                <Download size={11} /> Export {format}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleEmailReport(r.name)}>
                <Mail size={11} />
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast({ title: "Scheduled", description: `${r.name} will be sent weekly.` })}>
                <Calendar size={11} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Audit Log */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">SLA Configuration Audit Log</h3>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">{auditLog.length} entries</Badge>
        </div>
        {auditLog.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No changes recorded yet. Configuration changes will appear here.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {auditLog.slice(0, 50).map(entry => (
              <div key={entry.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60">
                <ChevronRight size={12} className="text-gray-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">{entry.module}</span>
                    <span className="text-xs text-gray-400">{entry.action}</span>
                    <span className="text-xs text-gray-500">by {entry.user}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.timestamp).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
