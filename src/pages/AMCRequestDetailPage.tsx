import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Download,
  Plus,
  Calendar,
  RefreshCw,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MoreVertical,
  ChevronDown,
  CalendarDays,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";

// ─── Per-AMC data ─────────────────────────────────────────────────────────────
interface AMCData {
  id: string;
  status: "Active" | "Completed" | "Cancelled";
  assetName: string;
  location: string;
  // stat bar
  amcPeriod: string;
  periodRange: string;
  visitFrequency: string;
  visitFrequencyNote: string;
  totalScheduledVisits: number;
  visitType: string;
  completedVisits: number;
  lastVisitDate: string;
  remainingVisits: number;
  nextVisitDate: string;
  // contract details left
  client: string;
  requestType: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  // contract details right
  contractStartDate: string;
  contractEndDate: string;
  amcType: string;
  sla: string;
  workingDays: string;
  assignedVendor: string;
  assignedEngineer: string;
  reminderBeforeVisit: string;
  // next visit card
  nextVisitDay: string;
  nextVisitMonth: string;
  nextVisitYear: string;
  nextVisitCountdown: string;
  nextVisitTime: string;
  nextVisitLocation: string;
  // summary
  autoTicketCreation: "Enabled" | "Disabled";
  // activity
  createdDate: string;
}

// ─── Static fallback data (demo entries) ──────────────────────────────────────
const AMC_DATA: Record<string, AMCData> = {
  "AMC-2026-00124": {
    id: "AMC-2026-00124", status: "Active",
    assetName: "Dell Latitude 5420", location: "Bangalore - Main Office",
    amcPeriod: "1 Year", periodRange: "01 Jul 2026 - 30 Jun 2027",
    visitFrequency: "Monthly", visitFrequencyNote: "Auto ticket every 1 Month",
    totalScheduledVisits: 12, visitType: "Preventive Maintenance",
    completedVisits: 1, lastVisitDate: "Last on 01 Jul 2026",
    remainingVisits: 11, nextVisitDate: "Next on 15 Aug 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Laptops",
    brand: "Dell", model: "Latitude 5420", serialNumber: "DL5420A1B2C3D4", assetTag: "AST-1001",
    contractStartDate: "01 Jul 2026", contractEndDate: "30 Jun 2027",
    amcType: "Comprehensive", sla: "48 Hours", workingDays: "Mon - Fri (9 AM - 6 PM)",
    assignedVendor: "Dell Authorized Service", assignedEngineer: "Ramesh K.", reminderBeforeVisit: "3 Days",
    nextVisitDay: "15", nextVisitMonth: "AUG 2026", nextVisitYear: "",
    nextVisitCountdown: "In 23 days", nextVisitTime: "10:00 AM - 12:00 PM",
    nextVisitLocation: "Bangalore - Main Office",
    autoTicketCreation: "Enabled", createdDate: "29 Jun 2026",
  },
  "AMC-2026-00110": {
    id: "AMC-2026-00110", status: "Active",
    assetName: "Cisco Switch WS-C2960X", location: "Hyderabad - Branch",
    amcPeriod: "1 Year", periodRange: "05 Jul 2026 - 04 Jul 2027",
    visitFrequency: "Quarterly", visitFrequencyNote: "Auto ticket every 3 Months",
    totalScheduledVisits: 4, visitType: "Preventive Maintenance",
    completedVisits: 1, lastVisitDate: "Last on 05 Jul 2026",
    remainingVisits: 3, nextVisitDate: "Next on 05 Oct 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Networking",
    brand: "Cisco", model: "WS-C2960X-48TS-L", serialNumber: "CS2960A1B2C3D4", assetTag: "AST-1003",
    contractStartDate: "05 Jul 2026", contractEndDate: "04 Jul 2027",
    amcType: "Comprehensive", sla: "72 Hours", workingDays: "Mon - Sat (9 AM - 6 PM)",
    assignedVendor: "Cisco Authorized Service", assignedEngineer: "Vikram Singh", reminderBeforeVisit: "5 Days",
    nextVisitDay: "05", nextVisitMonth: "OCT 2026", nextVisitYear: "",
    nextVisitCountdown: "In 66 days", nextVisitTime: "09:00 AM - 11:00 AM",
    nextVisitLocation: "Hyderabad - Branch",
    autoTicketCreation: "Enabled", createdDate: "03 Jul 2026",
  },
  "AMC-2026-00085": {
    id: "AMC-2026-00085", status: "Active",
    assetName: "Dell PowerEdge R440", location: "Bangalore - Main Office",
    amcPeriod: "2 Years", periodRange: "01 Jul 2026 - 30 Jun 2028",
    visitFrequency: "Monthly", visitFrequencyNote: "Auto ticket every 1 Month",
    totalScheduledVisits: 24, visitType: "Preventive Maintenance",
    completedVisits: 1, lastVisitDate: "Last on 01 Jul 2026",
    remainingVisits: 23, nextVisitDate: "Next on 01 Aug 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Servers",
    brand: "Dell", model: "PowerEdge R440", serialNumber: "DP440A1B2C3D4", assetTag: "AST-1007",
    contractStartDate: "01 Jul 2026", contractEndDate: "30 Jun 2028",
    amcType: "Comprehensive", sla: "24 Hours", workingDays: "Mon - Fri (9 AM - 6 PM)",
    assignedVendor: "Dell Authorized Service", assignedEngineer: "Ramesh K.", reminderBeforeVisit: "3 Days",
    nextVisitDay: "01", nextVisitMonth: "AUG 2026", nextVisitYear: "",
    nextVisitCountdown: "In 9 days", nextVisitTime: "10:00 AM - 12:00 PM",
    nextVisitLocation: "Bangalore - Main Office",
    autoTicketCreation: "Enabled", createdDate: "29 Jun 2026",
  },
  "AMC-2026-00061": {
    id: "AMC-2026-00061", status: "Active",
    assetName: "Cisco IP Phone 7945", location: "Bangalore - Main Office",
    amcPeriod: "1 Year", periodRange: "18 Jun 2026 - 17 Jun 2027",
    visitFrequency: "Monthly", visitFrequencyNote: "Auto ticket every 1 Month",
    totalScheduledVisits: 12, visitType: "Preventive Maintenance",
    completedVisits: 1, lastVisitDate: "Last on 18 Jun 2026",
    remainingVisits: 11, nextVisitDate: "Next on 18 Jul 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Communication",
    brand: "Cisco", model: "IP Phone 7945G", serialNumber: "CP7945A1B2C3D4", assetTag: "AST-1010",
    contractStartDate: "18 Jun 2026", contractEndDate: "17 Jun 2027",
    amcType: "Standard", sla: "48 Hours", workingDays: "Mon - Fri (9 AM - 6 PM)",
    assignedVendor: "Cisco Authorized Service", assignedEngineer: "Ramesh K.", reminderBeforeVisit: "3 Days",
    nextVisitDay: "18", nextVisitMonth: "JUL 2026", nextVisitYear: "",
    nextVisitCountdown: "In 5 days", nextVisitTime: "09:30 AM - 11:30 AM",
    nextVisitLocation: "Bangalore - Main Office",
    autoTicketCreation: "Enabled", createdDate: "16 Jun 2026",
  },
  "AMC-2026-00042": {
    id: "AMC-2026-00042", status: "Active",
    assetName: "APC UPS 3000VA", location: "Hyderabad - Branch",
    amcPeriod: "1 Year", periodRange: "06 Jun 2026 - 05 Jun 2027",
    visitFrequency: "Quarterly", visitFrequencyNote: "Auto ticket every 3 Months",
    totalScheduledVisits: 4, visitType: "Battery & Load Testing",
    completedVisits: 1, lastVisitDate: "Last on 06 Jun 2026",
    remainingVisits: 3, nextVisitDate: "Next on 06 Sep 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Power & UPS",
    brand: "APC", model: "Smart-UPS 3000VA", serialNumber: "APC3000A1B2C3", assetTag: "AST-1012",
    contractStartDate: "06 Jun 2026", contractEndDate: "05 Jun 2027",
    amcType: "Standard", sla: "72 Hours", workingDays: "Mon - Sat (9 AM - 6 PM)",
    assignedVendor: "APC Authorized Service", assignedEngineer: "Suresh B.", reminderBeforeVisit: "5 Days",
    nextVisitDay: "06", nextVisitMonth: "SEP 2026", nextVisitYear: "",
    nextVisitCountdown: "In 37 days", nextVisitTime: "10:00 AM - 12:00 PM",
    nextVisitLocation: "Hyderabad - Branch",
    autoTicketCreation: "Disabled", createdDate: "04 Jun 2026",
  },
  "AMC-2026-00019": {
    id: "AMC-2026-00019", status: "Active",
    assetName: "Fortinet FortiGate 60F", location: "Bangalore - Main Office",
    amcPeriod: "1 Year", periodRange: "18 May 2026 - 17 May 2027",
    visitFrequency: "Monthly", visitFrequencyNote: "Auto ticket every 1 Month",
    totalScheduledVisits: 12, visitType: "Firmware & Security Audit",
    completedVisits: 2, lastVisitDate: "Last on 18 Jun 2026",
    remainingVisits: 10, nextVisitDate: "Next on 18 Jul 2026",
    client: "Apex Tech Solutions", requestType: "AMC", category: "Security",
    brand: "Fortinet", model: "FortiGate 60F", serialNumber: "FG60FA1B2C3D4", assetTag: "AST-1015",
    contractStartDate: "18 May 2026", contractEndDate: "17 May 2027",
    amcType: "Comprehensive", sla: "24 Hours", workingDays: "Mon - Fri (9 AM - 6 PM)",
    assignedVendor: "Fortinet Authorized Service", assignedEngineer: "Vikram Singh", reminderBeforeVisit: "3 Days",
    nextVisitDay: "18", nextVisitMonth: "JUL 2026", nextVisitYear: "",
    nextVisitCountdown: "In 5 days", nextVisitTime: "09:00 AM - 11:00 AM",
    nextVisitLocation: "Bangalore - Main Office",
    autoTicketCreation: "Enabled", createdDate: "16 May 2026",
  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_UPPER = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function fmtDateDisplay(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // already formatted
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function freqNoteLabel(freq: string): string {
  switch (freq) {
    case "Monthly":     return "Auto ticket every 1 Month";
    case "Quarterly":   return "Auto ticket every 3 Months";
    case "Half-Yearly": return "Auto ticket every 6 Months";
    case "Annually":    return "Auto ticket every 1 Year";
    default:            return `Auto ticket — ${freq}`;
  }
}

function freqIntervalDays(freq: string): number {
  switch (freq) {
    case "Monthly":     return 31;
    case "Quarterly":   return 92;
    case "Half-Yearly": return 183;
    case "Annually":    return 365;
    default:            return 31;
  }
}

function daysUntil(iso: string): number {
  if (!iso) return 0;
  const now  = new Date();
  const then = new Date(iso);
  return Math.round((then.getTime() - now.getTime()) / 86400000);
}

/** Build an AMCData object from a live stored service request */
function buildFromStored(req: ReturnType<typeof getServiceRequests>[number]): AMCData {
  const p = (req.payload ?? {}) as Record<string, string | number>;

  const startIso  = String(p.startDate  || "");
  const endIso    = String(p.endDate    || "");
  const amcPeriod = String(p.amcPeriod  || "1 Year");
  const visitFreq = String(p.visitFreq  || "Monthly");
  const totalV    = Number(p.totalVisits || 0);
  const brand     = String(p.brand      || "");
  const model     = String(p.model      || "");
  const prefDate  = String(p.prefDate   || "");

  // Compute next visit date
  const nextVisitIso = prefDate || (startIso
    ? addDays(new Date(startIso), freqIntervalDays(visitFreq)).toISOString().slice(0, 10)
    : "");

  let nextDay = "-", nextMonthUpper = "-", nextCountdown = "-", nextVisitTime = "10:00 AM - 12:00 PM";
  if (nextVisitIso) {
    const nd = new Date(nextVisitIso);
    nextDay          = String(nd.getDate()).padStart(2, "0");
    nextMonthUpper   = `${MONTHS_UPPER[nd.getMonth()]} ${nd.getFullYear()}`;
    const diff       = daysUntil(nextVisitIso);
    nextCountdown    = diff > 0 ? `In ${diff} days` : diff === 0 ? "Today" : `${Math.abs(diff)} days ago`;
  }
  if (prefDate) nextVisitTime = "10:00 AM - 12:00 PM";

  const contractStart = fmtDateDisplay(startIso);
  const contractEnd   = fmtDateDisplay(endIso);
  const periodRange   = (contractStart !== "-" && contractEnd !== "-") ? `${contractStart} - ${contractEnd}` : "-";

  // Status mapping
  const rawStatus = req.status || "Scheduled";
  const status: AMCData["status"] = rawStatus === "Completed" ? "Completed"
    : rawStatus === "Cancelled" ? "Cancelled"
    : "Active";

  return {
    id:                   req.id,
    status,
    assetName:            req.itemAsset || `${brand} ${model}`.trim() || "-",
    location:             req.location  || String(p.location || "-"),
    amcPeriod,
    periodRange,
    visitFrequency:       visitFreq,
    visitFrequencyNote:   freqNoteLabel(visitFreq),
    totalScheduledVisits: totalV,
    visitType:            "Preventive Maintenance",
    completedVisits:      0,
    lastVisitDate:        "-",
    remainingVisits:      totalV,
    nextVisitDate:        nextVisitIso ? `Next on ${fmtDateDisplay(nextVisitIso)}` : "-",
    client:               String(p.client    || req.requestedBy || "-"),
    requestType:          "AMC",
    category:             String(p.category  || "-"),
    brand,
    model,
    serialNumber:         String(p.serialNumber || "-"),
    assetTag:             req.assetTag || String(p.assetTag || "-"),
    contractStartDate:    contractStart,
    contractEndDate:      contractEnd,
    amcType:              "Comprehensive",
    sla:                  "48 Hours",
    workingDays:          "Mon - Fri (9 AM - 6 PM)",
    assignedVendor:       "-",
    assignedEngineer:     req.requestedBy || "-",
    reminderBeforeVisit:  "3 Days",
    nextVisitDay:         nextDay,
    nextVisitMonth:       nextMonthUpper,
    nextVisitYear:        "",
    nextVisitCountdown:   nextCountdown,
    nextVisitTime,
    nextVisitLocation:    req.location || String(p.location || "-"),
    autoTicketCreation:   "Enabled",
    createdDate:          req.requestDate || "-",
  };
}

/** Load AMCData: stored requests take precedence, then static fallback */
function loadAMCData(requestId: string): AMCData {
  const stored = getServiceRequests().find(r => r.id === requestId);
  if (stored) return buildFromStored(stored);
  return AMC_DATA[requestId] ?? AMC_DATA["AMC-2026-00124"];
}

// ─── Visit row data ───────────────────────────────────────────────────────────
interface VisitRow {
  visitNo: number;
  plannedDate: string;
  status: "Completed" | "Scheduled" | "Pending";
  serviceTicket: string;
  completedOn: string;
  engineer: string;
  notes: string;
}

function buildVisitSchedule(d: AMCData): VisitRow[] {
  const rows: VisitRow[] = [];
  const total = d.totalScheduledVisits || 5;

  // First visit: if completedVisits >= 1, mark as completed
  if (d.completedVisits >= 1) {
    rows.push({
      visitNo: 1,
      plannedDate: d.contractStartDate,
      status: "Completed",
      serviceTicket: "ST-" + d.id.replace("AMC-", ""),
      completedOn: d.contractStartDate,
      engineer: d.assignedEngineer !== "-" ? d.assignedEngineer : "-",
      notes: "Preventive maintenance completed.",
    });
  }

  // Next scheduled visit
  const scheduledIdx = d.completedVisits;
  if (scheduledIdx < total) {
    rows.push({
      visitNo: scheduledIdx + 1,
      plannedDate: d.nextVisitDay !== "-" ? `${d.nextVisitDay} ${d.nextVisitMonth}` : "-",
      status: "Scheduled",
      serviceTicket: "-",
      completedOn: "-",
      engineer: d.assignedEngineer !== "-" ? d.assignedEngineer : "-",
      notes: "Scheduled visit",
    });
  }

  // Remaining visits as Pending
  const pendingStart = rows.length + 1;
  const pendingCount = Math.min(Math.max(0, total - rows.length), 10); // cap at 10 for display
  for (let i = 0; i < pendingCount; i++) {
    rows.push({
      visitNo: pendingStart + i,
      plannedDate: "-",
      status: "Pending",
      serviceTicket: "-",
      completedOn: "-",
      engineer: "-",
      notes: "-",
    });
  }

  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const visitStatusColors: Record<VisitRow["status"], string> = {
  Completed: "bg-green-100 text-green-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Pending:   "bg-gray-100 text-gray-500",
};

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-44 flex-shrink-0">{label}</span>
      <span className={`text-xs ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>{value || "-"}</span>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-blue-600" : "text-gray-800"}`}>{value || "-"}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AMCRequestDetailPage({ requestId }: { requestId: string }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"Visit Schedule" | "Service Requests" | "Documents" | "Notes & History">("Visit Schedule");

  // Live data: reload whenever store changes
  const [d, setD] = useState<AMCData>(() => loadAMCData(requestId));

  useEffect(() => {
    setD(loadAMCData(requestId));
  }, [requestId]);

  const visits = buildVisitSchedule(d);
  const TABS = ["Visit Schedule", "Service Requests", "Documents", "Notes & History"] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(window.location.pathname.startsWith("/portal/") ? "/portal/my-services" : "/my-services")}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{d.id}</h1>
                <Badge className={d.status === "Active" ? "bg-emerald-100 text-emerald-700" : d.status === "Completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                  {d.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <span>{d.assetName}</span>
                <span className="text-gray-300">|</span>
                <span>{d.location}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit Contract
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Download Contract
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <Plus className="w-3.5 h-3.5" /> Raise Service Request
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat bar ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-gray-100 gap-0">
          {[
            { icon: <Calendar className="w-8 h-8 text-blue-400" />,      label: "AMC Period",              value: d.amcPeriod,                        sub: d.periodRange },
            { icon: <RefreshCw className="w-8 h-8 text-emerald-400" />,  label: "Visit Frequency",         value: d.visitFrequency,                   sub: d.visitFrequencyNote },
            { icon: <CalendarDays className="w-8 h-8 text-orange-400" />, label: "Total Scheduled Visits", value: String(d.totalScheduledVisits),     sub: d.visitType },
            { icon: <CheckCircle2 className="w-8 h-8 text-green-500" />, label: "Completed Visits",        value: String(d.completedVisits),          sub: d.completedVisits > 0 ? d.lastVisitDate : "No visits yet" },
            { icon: <Clock3 className="w-8 h-8 text-amber-400" />,       label: "Remaining Visits",        value: String(d.remainingVisits),          sub: d.nextVisitDate },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 px-4 first:pl-0 last:pr-0 py-1">
              <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium mb-0.5">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-4 flex gap-4 items-start">

        {/* ── Left (main) ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Contract Details */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Contract Details</h2>
              <div className="grid grid-cols-2 gap-x-8">
                {/* Left column */}
                <div>
                  <DetailRow label="Client"               value={d.client} bold />
                  <DetailRow label="Location"             value={d.location} />
                  <DetailRow label="Request Type"         value={d.requestType} />
                  <DetailRow label="Category"             value={d.category} />
                  <DetailRow label="Brand"                value={d.brand} />
                  <DetailRow label="Model"                value={d.model} />
                  <DetailRow label="Serial Number / IMEI" value={d.serialNumber} />
                  <DetailRow label="Asset Tag"            value={d.assetTag} />
                </div>
                {/* Right column */}
                <div>
                  <DetailRow label="Contract Start Date"   value={d.contractStartDate} bold />
                  <DetailRow label="Contract End Date"     value={d.contractEndDate} bold />
                  <DetailRow label="AMC Type"              value={d.amcType} />
                  <DetailRow label="SLA"                   value={d.sla} />
                  <DetailRow label="Working Days"          value={d.workingDays} />
                  <DetailRow label="Assigned Vendor"       value={d.assignedVendor} bold />
                  <DetailRow label="Assigned Engineer"     value={d.assignedEngineer} bold />
                  <DetailRow label="Reminder Before Visit" value={d.reminderBeforeVisit} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs + Table */}
          <Card>
            <CardContent className="p-0">
              {/* Tab bar */}
              <div className="flex border-b border-gray-100">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab
                        ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "Visit Schedule" && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold w-16">Visit #</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Planned Date</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Status</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Service Ticket</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Completed On</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Engineer</th>
                          <th className="px-4 py-3 text-left text-gray-500 font-semibold">Notes</th>
                          <th className="px-4 py-3 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {visits.map(v => (
                          <tr key={v.visitNo} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-700">{v.visitNo}</td>
                            <td className="px-4 py-3 text-gray-700">{v.plannedDate}</td>
                            <td className="px-4 py-3">
                              <Badge className={visitStatusColors[v.status]}>{v.status}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {v.serviceTicket !== "-" ? (
                                <button className="text-blue-600 font-semibold hover:underline">{v.serviceTicket}</button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{v.completedOn === "-" ? <span className="text-gray-300">-</span> : v.completedOn}</td>
                            <td className="px-4 py-3 text-gray-700">{v.engineer === "-" ? <span className="text-gray-300">-</span> : v.engineer}</td>
                            <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                              {v.notes === "-" ? <span className="text-gray-300">-</span> : v.notes}
                            </td>
                            <td className="px-4 py-3">
                              <button className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* View All */}
                  {d.totalScheduledVisits > visits.length && (
                    <div className="flex items-center justify-center py-3 border-t border-gray-50">
                      <button className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                        View All {d.totalScheduledVisits} Visits <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === "Service Requests" && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <CalendarCheck className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No service requests yet</p>
                </div>
              )}
              {activeTab === "Documents" && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Download className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No documents uploaded</p>
                </div>
              )}
              {activeTab === "Notes & History" && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Pencil className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No notes added yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-72 flex-shrink-0 space-y-4">

          {/* Next Scheduled Visit */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-800">Next Scheduled Visit</h3>
              </div>
              {d.nextVisitDay !== "-" ? (
                <>
                  <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-4 mb-3">
                    {/* Date block */}
                    <div className="text-center flex-shrink-0">
                      <p className="text-4xl font-bold text-gray-900 leading-none">{d.nextVisitDay}</p>
                      <p className="text-xs font-semibold text-gray-500 uppercase mt-0.5">{d.nextVisitMonth}</p>
                    </div>
                    {/* Details */}
                    <div className="min-w-0">
                      <span className="inline-block text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full mb-2">
                        {d.nextVisitCountdown}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                        <Clock3 className="w-3 h-3 text-gray-400" /> {d.nextVisitTime}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin className="w-3 h-3 text-gray-400" /> {d.nextVisitLocation}
                      </div>
                    </div>
                  </div>
                  <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> View Full Schedule
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <Calendar className="w-7 h-7 mb-1 opacity-30" />
                  <p className="text-xs">No visit scheduled yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract Summary */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Contract Summary</h3>
              <SummaryRow label="Total Visits"         value={String(d.totalScheduledVisits)} />
              <SummaryRow label="Completed Visits"     value={String(d.completedVisits)} />
              <SummaryRow label="Remaining Visits"     value={String(d.remainingVisits)} highlight />
              <SummaryRow label="Contract Start Date"  value={d.contractStartDate} />
              <SummaryRow label="Contract End Date"    value={d.contractEndDate} />
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500">Auto Ticket Creation</span>
                <span className={`text-xs font-semibold ${d.autoTicketCreation === "Enabled" ? "text-emerald-600" : "text-gray-500"}`}>
                  {d.autoTicketCreation}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-500">Status</span>
                <span className={`flex items-center gap-1 text-xs font-semibold ${d.status === "Active" ? "text-emerald-600" : "text-gray-500"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${d.status === "Active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {d.status}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {d.completedVisits > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-800">Visit completed</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">{d.contractStartDate}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Visit #1 completed on {d.contractStartDate}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">By {d.assignedEngineer}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800">AMC Request Created</p>
                      <p className="text-[11px] text-gray-400 whitespace-nowrap">{d.createdDate}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Request submitted successfully</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {d.assignedEngineer !== "-" ? `By ${d.assignedEngineer}` : "By System"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
