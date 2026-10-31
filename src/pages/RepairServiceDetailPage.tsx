import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, XCircle, Plus, Calendar, Paperclip,
  CheckCircle2, Clock, Wrench, Lock, Check, Phone, Mail,
  ChevronDown, Truck, X, Search, ChevronRight, MapPin, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";
import { getVendors, StoredVendor } from "@/lib/vendorDataStore";

interface RepairData {
  id: string;
  status: "In Progress" | "Scheduled" | "Completed" | "Cancelled" | "Closed";
  createdOn: string;
  requestType: string;
  client: string;
  location: string;
  requestDate: string;
  requestedBy: string;
  priority: "Low" | "Medium" | "High";
  preferredAppointment: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  purchaseDate: string;
  warrantyStatus: string;
  assignedVendor: string;
  assignedEngineer: string;
  vendorContact: string;
  email: string;
  sla: string;
  dueBy: string;
  timeRemaining: string;
  issueSubject: string;
  issueDescription: string;
  stepsTaken: string;
  attachments: { name: string; size: string }[];
  activity: { label: string; date: string; time: string; note: string; done: boolean }[];
  nextAppointmentDay: string;
  nextAppointmentMonth: string;
  nextAppointmentYear: string;
  nextAppointmentLabel: string;
  nextAppointmentTime: string;
  nextAppointmentLocation: string;
}

const REPAIR_DATA: Record<string, RepairData> = {
  "REP-2026-00187": {
    id: "REP-2026-00187", status: "In Progress", createdOn: "22 Jul 2026, 09:30 AM",
    requestType: "Repair Service", client: "Apex Tech Solutions",
    location: "Bangalore - Main Office", requestDate: "22 Jul 2026, 09:30 AM",
    requestedBy: "Ramesh K.", priority: "Medium",
    preferredAppointment: "24 Jul 2026, 10:00 AM",
    category: "Laptops", brand: "Dell", model: "Latitude 5420",
    serialNumber: "DL5420A1B2C3D4", assetTag: "AST-1001",
    purchaseDate: "15 Jan 2025", warrantyStatus: "Under Warranty",
    assignedVendor: "Dell Authorized Service", assignedEngineer: "Ramesh K.",
    vendorContact: "080-4567 8900", email: "service@dell.com",
    sla: "48 Hours", dueBy: "24 Jul 2026, 10:00 AM", timeRemaining: "22h 35m",
    issueSubject: "Laptop not powering on",
    issueDescription: "The laptop is not turning on. No response from the power button and no display.",
    stepsTaken: "Checked power adapter and battery. Still not working.",
    attachments: [{ name: "issue_video.mp4", size: "18.4 MB" }],
    activity: [
      { label: "Request Raised", date: "22 Jul 2026", time: "09:30 AM", note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: "22 Jul 2026", time: "10:15 AM", note: "Appointment scheduled for 24 Jul 2026, 10:00 AM", done: true },
      { label: "In Progress", date: "22 Jul 2026", time: "11:45 AM", note: "Engineer Ramesh K. has started working on this request", done: true },
      { label: "Completed", date: "-", time: "", note: "Pending", done: false },
    ],
    nextAppointmentDay: "24", nextAppointmentMonth: "JUL 2026", nextAppointmentYear: "",
    nextAppointmentLabel: "Tomorrow",
    nextAppointmentTime: "10:00 AM - 12:00 PM",
    nextAppointmentLocation: "Bangalore - Main Office",
  },
  "REP-2026-00120": {
    id: "REP-2026-00120", status: "Completed", createdOn: "10 Jul 2026, 09:00 AM",
    requestType: "Repair Service", client: "Apex Tech Solutions",
    location: "Pune - Branch Office", requestDate: "10 Jul 2026, 09:00 AM",
    requestedBy: "Anita Patil", priority: "Low",
    preferredAppointment: "10 Jul 2026, 04:30 PM",
    category: "UPS", brand: "APC", model: "Smart UPS 1500VA",
    serialNumber: "APC1500A1B2C3", assetTag: "AST-1004",
    purchaseDate: "03 Mar 2024", warrantyStatus: "Under Warranty",
    assignedVendor: "APC Authorized Service", assignedEngineer: "Anita Patil",
    vendorContact: "020-4567 8900", email: "service@apc.com",
    sla: "24 Hours", dueBy: "11 Jul 2026, 09:00 AM", timeRemaining: "Completed",
    issueSubject: "UPS not charging",
    issueDescription: "The UPS is not charging and beeps continuously.",
    stepsTaken: "Checked battery and connections.",
    attachments: [],
    activity: [
      { label: "Request Raised", date: "10 Jul 2026", time: "09:00 AM", note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: "10 Jul 2026", time: "10:00 AM", note: "Appointment scheduled", done: true },
      { label: "In Progress", date: "10 Jul 2026", time: "02:00 PM", note: "Engineer started working", done: true },
      { label: "Completed", date: "10 Jul 2026", time: "04:30 PM", note: "Battery replaced. Issue resolved.", done: true },
    ],
    nextAppointmentDay: "-", nextAppointmentMonth: "", nextAppointmentYear: "",
    nextAppointmentLabel: "", nextAppointmentTime: "", nextAppointmentLocation: "",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIsoRepair(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const MONTH_MAP: Record<string, number> = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
};

/** Parse "DD Mon YYYY, HH:MM AM/PM" or ISO strings into a Date */
function parseDueDate(s: string): Date | null {
  if (!s || s === "-") return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/(\d{1,2})\s+(\w{3})\s+(\d{4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (m) {
    const mon = MONTH_MAP[m[2].toLowerCase()];
    if (mon === undefined) return null;
    let h = parseInt(m[4]), min = parseInt(m[5]);
    if (m[6]) {
      if (m[6].toLowerCase() === "pm" && h !== 12) h += 12;
      if (m[6].toLowerCase() === "am" && h === 12) h = 0;
    }
    return new Date(parseInt(m[3]), mon, parseInt(m[1]), h, min);
  }
  return null;
}

/** Compute human-readable time remaining from dueBy string */
function computeTimeRemaining(dueBy: string, status: string): string {
  if (["Completed", "Closed", "Cancelled"].includes(status)) return status;
  const due = parseDueDate(dueBy);
  if (!due) return "-";
  const diff = due.getTime() - Date.now();
  if (diff <= 0) return "Overdue";
  const totalMins = Math.floor(diff / 60000);
  const days  = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins  = totalMins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Format a Date into display parts for the appointment card */
function fmtApptDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "-", month: "" };
  const day   = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase();
  return { day, month };
}

/** Convert "HH:MM" 24h to "HH:MM AM/PM" */
function to12h(t: string) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr), m = parseInt(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Build a RepairData object from a stored service request */
function buildRepairFromStored(req: ReturnType<typeof getServiceRequests>[number]): RepairData {
  const p = (req.payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => String(v ?? "");

  const prefDate = str(p.prefDate);
  let nextApptDisplay = "-";
  let nextApptDay = "-", nextApptMonth = "", nextApptTime = "";
  if (prefDate) {
    const d = new Date(prefDate);
    if (!isNaN(d.getTime())) {
      nextApptDay   = String(d.getDate()).padStart(2, "0");
      nextApptMonth = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase();
      nextApptTime  = "10:00 AM - 12:00 PM";
      nextApptDisplay = fmtIsoRepair(prefDate) + ", 10:00 AM";
    }
  }

  const VALID_STATUSES = ["In Progress", "Scheduled", "Completed", "Cancelled", "Closed"] as const;
  const rawStatus = req.status || "Scheduled";
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as RepairData["status"]
    : "Scheduled";

  return {
    id:                    req.id,
    status,
    createdOn:             req.requestDate ? `${req.requestDate}, 10:00 AM` : "-",
    requestType:           "Repair Service",
    client:                str(p.client) || req.requestedBy || "-",
    location:              req.location  || str(p.location) || "-",
    requestDate:           req.requestDate ? `${req.requestDate}, 10:00 AM` : "-",
    requestedBy:           req.requestedBy || str(p.client) || "-",
    priority:              (req.priority as RepairData["priority"]) || "Medium",
    preferredAppointment:  nextApptDisplay,
    category:              str(p.category)     || "-",
    brand:                 str(p.brand)        || "-",
    model:                 str(p.model)        || "-",
    serialNumber:          str(p.serialNumber) || "-",
    assetTag:              req.assetTag || str(p.assetTag) || "-",
    purchaseDate:          fmtIsoRepair(str(p.purchaseDate)),
    warrantyStatus:        "Unknown",
    assignedVendor:        "-",
    assignedEngineer:      "-",
    vendorContact:         "-",
    email:                 "-",
    sla:                   "48 Hours",
    dueBy:                 "-",
    timeRemaining:         status === "Completed" ? "Completed" : "-",
    issueSubject:          str(p.issueSubject) || "-",
    issueDescription:      str(p.issueDesc)    || "-",
    stepsTaken:            "-",
    attachments:           [],
    activity: [
      { label: "Request Raised", date: req.requestDate || "-", time: "10:00 AM",
        note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: req.requestDate || "-", time: "",
        note: prefDate ? `Appointment scheduled for ${nextApptDisplay}` : "-",
        done: status !== "Request Raised" },
      { label: "In Progress", date: "-", time: "", note: "Pending", done: false },
      { label: "Completed",   date: "-", time: "", note: "Pending", done: false },
    ],
    nextAppointmentDay:      nextApptDay,
    nextAppointmentMonth:    nextApptMonth,
    nextAppointmentYear:     "",
    nextAppointmentLabel:    "",
    nextAppointmentTime:     nextApptTime,
    nextAppointmentLocation: req.location || str(p.location) || "-",
  };
}

function loadRepairData(id: string): RepairData | undefined {
  const stored = getServiceRequests().find(r => r.id === id);
  if (stored) return buildRepairFromStored(stored);
  return REPAIR_DATA[id];
}

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-blue-100 text-blue-700",
  "Scheduled": "bg-purple-100 text-purple-700",
  "Completed": "bg-green-100 text-green-700",
  "Cancelled": "bg-red-100 text-red-600",
  "Closed": "bg-gray-100 text-gray-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low: "bg-gray-100 text-gray-500",
};

// Step definitions for the progress stepper
const STEPS = [
  { key: "Request Raised" },
  { key: "Scheduled" },
  { key: "In Progress" },
  { key: "Completed" },
  { key: "Closed" },
];
const STEP_ORDER = ["Request Raised", "Scheduled", "In Progress", "Completed", "Closed"];

function stepIndex(status: string) {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function InfoRow({ label, value, valueEl }: { label: string; value?: string; valueEl?: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs py-1">
      <span className="text-gray-500 w-36 flex-shrink-0">{label}</span>
      {valueEl ?? <span className="text-gray-800 font-medium">{value}</span>}
    </div>
  );
}

// ─── Assignment state type ────────────────────────────────────────────────────
interface AssignmentState {
  assignedVendor: string;
  vendorId: string;
  assignedEngineer: string;
  vendorContact: string;
  email: string;
  sla: string;
  dueBy: string;
}

// ─── Assignment Edit Modal ────────────────────────────────────────────────────
function AssignmentEditModal({
  initial,
  onSave,
  onClose,
}: {
  initial: AssignmentState;
  onSave: (a: AssignmentState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AssignmentState>({ ...initial });
  const [vendors, setVendors] = useState<StoredVendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorDropOpen, setVendorDropOpen] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVendors(getVendors().filter(v => v.status === "Active"));
  }, []);

  // close vendor dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setVendorDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.category.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  function selectVendor(v: StoredVendor) {
    setForm(f => ({
      ...f,
      vendorId: v.id,
      assignedVendor: v.name,
      assignedEngineer: v.primaryContact,
      vendorContact: v.phone,
      email: v.email,
    }));
    setVendorSearch(v.name);
    setVendorDropOpen(false);
  }

  function set(key: keyof AssignmentState, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Edit Assignment</h2>
              <p className="text-[11px] text-gray-400">Update vendor &amp; engineer details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Assigned Vendor */}
          <div ref={vendorRef} className="relative">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Assigned Vendor <span className="text-red-400">*</span>
            </label>
            <div
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer bg-white hover:border-blue-300 transition-colors"
              onClick={() => setVendorDropOpen(o => !o)}
            >
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                className="flex-1 text-xs outline-none bg-transparent text-gray-800 placeholder-gray-400"
                placeholder="Search vendors…"
                value={vendorSearch}
                onChange={e => { setVendorSearch(e.target.value); setVendorDropOpen(true); }}
                onClick={e => { e.stopPropagation(); setVendorDropOpen(true); }}
              />
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${vendorDropOpen ? "rotate-180" : ""}`} />
            </div>
            {vendorDropOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {filteredVendors.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-3">No vendors found</p>
                ) : (
                  filteredVendors.map(v => (
                    <button
                      key={v.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors group"
                      onClick={() => selectVendor(v)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700">{v.name}</p>
                          <p className="text-[10px] text-gray-400">{v.category} &nbsp;·&nbsp; {v.id}</p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-blue-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Auto-filled fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assigned Engineer</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
                value={form.assignedEngineer}
                onChange={e => set("assignedEngineer", e.target.value)}
                placeholder="Engineer name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor Contact</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-blue-300">
                <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  className="flex-1 text-xs text-gray-800 outline-none bg-transparent"
                  value={form.vendorContact}
                  onChange={e => set("vendorContact", e.target.value)}
                  placeholder="+91 00000 00000"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-blue-300">
              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                className="flex-1 text-xs text-gray-800 outline-none bg-transparent"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="vendor@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">SLA</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
                value={form.sla}
                onChange={e => set("sla", e.target.value)}
              >
                {["24 Hours", "48 Hours", "72 Hours", "5 Days", "7 Days"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due By</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
                value={form.dueBy}
                onChange={e => set("dueBy", e.target.value)}
              />
            </div>
          </div>

          {/* Auto-fill info banner */}
          {form.vendorId && (
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Vendor details auto-filled from <strong>{form.assignedVendor}</strong>. You can still edit them manually.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Appointment state ────────────────────────────────────────────────────────
interface AppointmentState {
  date: string;      // ISO date "YYYY-MM-DD"
  timeFrom: string;  // "10:00"
  timeTo: string;    // "12:00"
  location: string;
  label: string;
}

// ─── Reschedule Modal ─────────────────────────────────────────────────────────
function RescheduleModal({
  initial,
  onSave,
  onClose,
}: {
  initial: AppointmentState;
  onSave: (a: AppointmentState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AppointmentState>({ ...initial });
  const set = (k: keyof AppointmentState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const isValid = !!form.date && !!form.timeFrom && !!form.timeTo && !!form.location;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Reschedule Appointment</h2>
              <p className="text-[11px] text-gray-400">Update the next service appointment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
              value={form.date}
              onChange={e => set("date", e.target.value)}
            />
          </div>

          {/* Time From / To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Time From <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
                value={form.timeFrom}
                onChange={e => set("timeFrom", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Time To <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
                value={form.timeTo}
                onChange={e => set("timeTo", e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Location <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-blue-300">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                className="flex-1 text-xs text-gray-800 outline-none bg-transparent"
                placeholder="e.g. Bangalore – Main Office"
                value={form.location}
                onChange={e => set("location", e.target.value)}
              />
            </div>
          </div>

          {/* Label (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Label <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-800 outline-none focus:border-blue-300 bg-gray-50"
              placeholder="e.g. Rescheduled, Follow-up…"
              value={form.label}
              onChange={e => set("label", e.target.value)}
            />
          </div>

          {!isValid && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">Please fill in all required fields.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-700 transition-colors">
            Cancel
          </button>
          <button
            disabled={!isValid}
            onClick={() => isValid && onSave(form)}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Confirm Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RepairServiceDetailPage({ requestId }: { requestId?: string }) {
  const navigate = useNavigate();
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const id = requestId ?? "";
  const data = loadRepairData(id);

  const [currentStatus, setCurrentStatus] = useState<RepairData["status"]>(
    data?.status ?? "Request Raised" as RepairData["status"]
  );

  const [assignment, setAssignment] = useState<AssignmentState>(() => ({
    assignedVendor: data?.assignedVendor ?? "-",
    vendorId: "",
    assignedEngineer: data?.assignedEngineer ?? "-",
    vendorContact: data?.vendorContact ?? "-",
    email: data?.email ?? "-",
    sla: data?.sla ?? "48 Hours",
    dueBy: data?.dueBy ?? "-",
  }));

  // Live time remaining — recomputes every 30 s
  const [timeRemaining, setTimeRemaining] = useState(() =>
    computeTimeRemaining(data?.dueBy ?? "-", data?.status ?? "-")
  );
  useEffect(() => {
    setTimeRemaining(computeTimeRemaining(assignment.dueBy, currentStatus));
    const id = setInterval(
      () => setTimeRemaining(computeTimeRemaining(assignment.dueBy, currentStatus)),
      30_000
    );
    return () => clearInterval(id);
  }, [assignment.dueBy, currentStatus]);

  // Appointment state
  const initAppt = (): AppointmentState => {
    if (!data) return { date: "", timeFrom: "10:00", timeTo: "12:00", location: "", label: "" };
    // Try to derive initial ISO date from nextAppointmentDay + nextAppointmentMonth
    let isoDate = "";
    if (data.nextAppointmentDay !== "-" && data.nextAppointmentMonth) {
      const parsed = new Date(`${data.nextAppointmentDay} ${data.nextAppointmentMonth}`);
      if (!isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString().slice(0, 10);
      }
    }
    const timeParts = (data.nextAppointmentTime ?? "").split(" - ");
    const to12hRev = (t: string) => {
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!m) return "";
      let h = parseInt(m[1]);
      if (m[3].toLowerCase() === "pm" && h !== 12) h += 12;
      if (m[3].toLowerCase() === "am" && h === 12) h = 0;
      return `${String(h).padStart(2,"0")}:${m[2]}`;
    };
    return {
      date: isoDate,
      timeFrom: to12hRev(timeParts[0] ?? "") || "10:00",
      timeTo:   to12hRev(timeParts[1] ?? "") || "12:00",
      location: data.nextAppointmentLocation ?? "",
      label:    data.nextAppointmentLabel ?? "",
    };
  };
  const [appointment, setAppointment] = useState<AppointmentState>(initAppt);

  const activeStep = stepIndex(currentStatus);

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Request not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate(window.location.pathname.startsWith("/portal/") ? "/portal/my-services" : "/my-services")}
                className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{data.id}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[data.status]}`}>
                    {data.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.requestType} &nbsp;|&nbsp; Created on {data.createdOn}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Edit Request
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <XCircle className="w-3.5 h-3.5" /> Cancel Request
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Raise Follow-up
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* ── Service Status Bar ── */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">

              {/* Left: current status panel */}
              <div className="flex items-center gap-3 min-w-[170px] pr-4 border-r border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-tight">Service Status</p>
                  <p className="text-sm font-bold text-gray-900 leading-snug">{data.status}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{data.requestType}</p>
                </div>
              </div>

              {/* Middle: horizontal stepper */}
              <div className="flex items-center flex-1 min-w-0">
                {STEPS.map((step, i) => {
                  const done = i < activeStep;
                  const active = i === activeStep;
                  const activityEntry = data.activity.find(a => a.label === step.key);
                  const dateStr = activityEntry?.date && activityEntry.date !== "-" ? activityEntry.date : "";

                  let subLabel: string;
                  let subColor: string;
                  if (done) {
                    subLabel = dateStr || "Done";
                    subColor = "text-gray-400";
                  } else if (active) {
                    subLabel = dateStr || "In Progress";
                    subColor = "text-blue-500";
                  } else {
                    subLabel = "Pending";
                    subColor = "text-gray-300";
                  }

                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center">
                        {/* Step circle with pencil icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                          done
                            ? "bg-blue-600 border-blue-600 text-white"
                            : active
                            ? "bg-white border-blue-500 text-blue-500"
                            : "bg-white border-gray-200 text-gray-300"
                        }`}>
                          {done
                            ? <Check className="w-3.5 h-3.5" />
                            : <Pencil className="w-3 h-3" />}
                        </div>
                        {/* Step name */}
                        <p className={`text-[11px] font-semibold mt-1 text-center whitespace-nowrap ${
                          active ? "text-gray-900" : done ? "text-gray-600" : "text-gray-400"
                        }`}>
                          {step.key}
                        </p>
                        {/* Date or status label */}
                        <p className={`text-[10px] text-center leading-tight mt-0.5 ${subColor}`}>
                          {subLabel}
                        </p>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1.5 mb-6 rounded ${i < activeStep ? "bg-blue-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right: Update Status button */}
              <div className="relative flex-shrink-0 pl-4 border-l border-gray-100">
                <button
                  onClick={() => setStatusDropdownOpen(o => !o)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm"
                >
                  Update Status <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                    {STEP_ORDER.map(s => (
                      <button
                        key={s}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 text-gray-700 hover:text-blue-700"
                        onClick={() => setStatusDropdownOpen(false)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ── Row 1: Request Details / Equipment / Assignment ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Request Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Request Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Request Type" value={data.requestType} />
                <InfoRow label="Client" value={data.client} />
                <InfoRow label="Location" value={data.location} />
                <InfoRow label="Request Date" value={data.requestDate} />
                <InfoRow label="Requested By" value={data.requestedBy} />
                <InfoRow label="Priority" valueEl={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[data.priority]}`}>{data.priority}</span>
                } />
                <InfoRow label="Preferred Appointment" value={data.preferredAppointment} />
                <InfoRow label="Status" valueEl={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[data.status]}`}>{data.status}</span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Equipment / Asset Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Equipment / Asset Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Category" value={data.category} />
                <InfoRow label="Brand" value={data.brand} />
                <InfoRow label="Model" value={data.model} />
                <InfoRow label="Serial Number / IMEI" value={data.serialNumber} />
                <InfoRow label="Asset Tag" value={data.assetTag} />
                <InfoRow label="Purchase Date" value={data.purchaseDate} />
                <InfoRow label="Warranty Status" valueEl={
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{data.warrantyStatus}</span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 text-xs">👤</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">Assignment</h3>
                </div>
                <button
                  onClick={() => setAssignmentModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit Assignment"
                >
                  <Pencil className="w-3 h-3" />
                  <span className="text-[11px] font-medium">Edit</span>
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Assigned Vendor" value={assignment.assignedVendor} />
                <InfoRow label="Assigned Engineer" value={assignment.assignedEngineer} />
                <InfoRow label="Vendor Contact" valueEl={
                  <span className="flex items-center gap-1 text-gray-800 font-medium text-xs">
                    <Phone className="w-3 h-3 text-gray-400" /> {assignment.vendorContact}
                  </span>
                } />
                <InfoRow label="Email" valueEl={
                  <span className="flex items-center gap-1 text-gray-800 font-medium text-xs">
                    <Mail className="w-3 h-3 text-gray-400" /> {assignment.email}
                  </span>
                } />
                <InfoRow label="SLA" value={assignment.sla} />
                <InfoRow label="Due By" value={assignment.dueBy} />
              </div>
              {data.timeRemaining !== "Completed" && (
                <div className="mt-3 rounded-xl bg-blue-50 border border-blue-100 p-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Time Remaining</span>
                  <span className="text-lg font-bold text-blue-600">{data.timeRemaining}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Issue Details / Service Activity / Next Appointment ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Issue Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Issue Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400">Issue Subject</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{data.issueSubject}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Issue Description</p>
                  <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{data.issueDescription}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Steps Already Taken</p>
                  <p className="text-xs text-gray-700 mt-0.5">{data.stepsTaken}</p>
                </div>
                {data.attachments.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Attachments</p>
                    {data.attachments.map(att => (
                      <div key={att.name} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-700">{att.name}</p>
                          <p className="text-gray-400">{att.size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Service Activity */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Service Activity</h3>
              <div className="space-y-0">
                {data.activity.map((act, i) => (
                  <div key={act.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${act.done ? "bg-blue-500" : "bg-gray-200"}`} />
                      {i < data.activity.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: "28px" }} />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className={`text-xs font-semibold ${act.done ? "text-gray-800" : "text-gray-400"}`}>{act.label}</p>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">{act.date}</p>
                          <p className="text-[10px] text-gray-400">{act.time}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{act.note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1">
                View Full Activity →
              </button>
            </CardContent>
          </Card>

          {/* Next Appointment + Notes */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-800">Next Appointment</h3>
                </div>
                {data.nextAppointmentDay !== "-" ? (
                  <>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-900">{data.nextAppointmentDay}</p>
                        <p className="text-xs font-semibold text-gray-500 uppercase">{data.nextAppointmentMonth}</p>
                      </div>
                      <div>
                        {data.nextAppointmentLabel && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            {data.nextAppointmentLabel}
                          </span>
                        )}
                        <p className="text-sm font-medium text-gray-700 mt-1">{data.nextAppointmentTime}</p>
                        <p className="text-xs text-gray-500">{data.nextAppointmentLocation}</p>
                      </div>
                    </div>
                    <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                      <Calendar className="w-3.5 h-3.5" /> Reschedule Appointment
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">No upcoming appointment.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-bold text-gray-800">Notes</h3>
                  </div>
                  <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1">
                    <Plus className="w-3 h-3" /> Add Note
                  </button>
                </div>
                <p className="text-xs text-gray-400">No notes added yet.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <p className="text-xs text-gray-400">
            Created by {data.requestedBy} on {data.createdOn}
          </p>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <XCircle className="w-3.5 h-3.5" /> Cancel Request
          </button>
        </div>
      </div>

      {/* ── Assignment Edit Modal ── */}
      {assignmentModalOpen && (
        <AssignmentEditModal
          initial={assignment}
          onSave={(updated) => {
            setAssignment(updated);
            setAssignmentModalOpen(false);
          }}
          onClose={() => setAssignmentModalOpen(false)}
        />
      )}
    </div>
  );
}
