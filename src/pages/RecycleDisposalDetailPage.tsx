import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, XCircle, Plus, Calendar, Paperclip,
  Check, Lock, Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";

interface RecycleData {
  id: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled" | "Request Raised";
  createdOn: string;
  requestType: string;
  client: string;
  location: string;
  requestDate: string;
  requestedBy: string;
  priority: "Low" | "Medium" | "High";
  preferredCollectionDate: string;
  preferredTimeSlot: string;
  category: string;
  subCategory: string;
  itemAssetName: string;
  brand: string;
  model: string;
  quantity: string;
  unit: string;
  conditionOfItems: string;
  reasonForDisposal: string;
  collectionLocation: string;
  collectionAddress: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  invoiceRefNo: string;
  purchaseDate: string;
  additionalNotes: string;
  attachments: { name: string; size: string }[];
  activity: { label: string; date: string; time: string; note: string; done: boolean; active?: boolean }[];
  nextAppointmentDate: string;
  nextAppointmentTime: string;
}

const RECYCLE_DATA: Record<string, RecycleData> = {
  "REC-2026-00056": {
    id: "REC-2026-00056", status: "Scheduled", createdOn: "18 Jul 2026, 11:00 AM",
    requestType: "Recycle / Disposal", client: "Apex Tech Solutions",
    location: "Bangalore - Main Office", requestDate: "18 Jul 2026, 11:00 AM",
    requestedBy: "Priya Sharma", priority: "Low",
    preferredCollectionDate: "25 Jul 2026", preferredTimeSlot: "10:00 AM - 12:00 PM",
    category: "IT Assets", subCategory: "Computer & Peripherals",
    itemAssetName: "IT Assets (10 Items)", brand: "Mixed", model: "-",
    quantity: "10", unit: "Nos",
    conditionOfItems: "Not Working / Obsolete", reasonForDisposal: "End of Life / Obsolete",
    collectionLocation: "Bangalore - Main Office",
    collectionAddress: "No. 45, 3rd Cross, Koramangala,\nBangalore - 560034, Karnataka",
    contactPerson: "Priya Sharma", contactNumber: "+91 98765 43210",
    email: "priya.sharma@apextech.com",
    invoiceRefNo: "INV-2025-0678", purchaseDate: "12 Mar 2023",
    additionalNotes: "Please ensure secure data wiping before disposal and share the disposal certificate.",
    attachments: [{ name: "asset_list.xlsx", size: "24.5 KB" }],
    activity: [
      { label: "Request Raised", date: "18 Jul 2026", time: "11:00 AM", note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: "18 Jul 2026", time: "11:30 AM", note: "Request scheduled for collection on 25 Jul 2026, 10:00 AM - 12:00 PM", done: true, active: true },
      { label: "In Progress", date: "-", time: "", note: "-", done: false },
      { label: "Completed", date: "-", time: "", note: "-", done: false },
    ],
    nextAppointmentDate: "25 Jul 2026", nextAppointmentTime: "10:00 AM - 12:00 PM",
  },
  "REC-2026-00021": {
    id: "REC-2026-00021", status: "Cancelled", createdOn: "01 Jul 2026, 10:00 AM",
    requestType: "Recycle / Disposal", client: "Apex Tech Solutions",
    location: "Chennai - Branch", requestDate: "01 Jul 2026, 10:00 AM",
    requestedBy: "Suresh B.", priority: "Low",
    preferredCollectionDate: "-", preferredTimeSlot: "-",
    category: "IT Assets", subCategory: "Displays",
    itemAssetName: "Old Monitors (5 Items)", brand: "Mixed", model: "-",
    quantity: "5", unit: "Nos",
    conditionOfItems: "Not Working", reasonForDisposal: "End of Life",
    collectionLocation: "Chennai - Branch",
    collectionAddress: "Chennai - Branch Office",
    contactPerson: "Suresh B.", contactNumber: "+91 98765 11111",
    email: "suresh.b@apextech.com",
    invoiceRefNo: "-", purchaseDate: "-",
    additionalNotes: "-",
    attachments: [],
    activity: [
      { label: "Request Raised", date: "01 Jul 2026", time: "10:00 AM", note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: "-", time: "", note: "-", done: false },
      { label: "In Progress", date: "-", time: "", note: "-", done: false },
      { label: "Completed", date: "-", time: "", note: "-", done: false },
    ],
    nextAppointmentDate: "-", nextAppointmentTime: "",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIsoRcy(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildRecycleFromStored(req: ReturnType<typeof getServiceRequests>[number]): RecycleData {
  const p = (req.payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => String(v ?? "");

  const collectionDate = str(p.collectionDate);
  const timeSlot       = str(p.timeSlot);

  const VALID_STATUSES = ["Scheduled","In Progress","Completed","Cancelled","Request Raised"] as const;
  const rawStatus = req.status || "Scheduled";
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as RecycleData["status"]
    : "Scheduled";

  return {
    id:                      req.id,
    status,
    createdOn:               req.requestDate ? `${req.requestDate}, 10:00 AM` : "-",
    requestType:             "Recycle / Disposal",
    client:                  str(p.client)         || req.requestedBy || "-",
    location:                req.location          || str(p.location) || "-",
    requestDate:             req.requestDate       ? `${req.requestDate}, 10:00 AM` : "-",
    requestedBy:             req.requestedBy       || str(p.client)   || "-",
    priority:                (req.priority as RecycleData["priority"]) || "Medium",
    preferredCollectionDate: fmtIsoRcy(collectionDate),
    preferredTimeSlot:       timeSlot || "-",
    category:                str(p.category)       || "-",
    subCategory:             str(p.subCategory)    || "-",
    itemAssetName:           str(p.itemName)       || req.itemAsset || "-",
    brand:                   str(p.brand)          || "-",
    model:                   str(p.model)          || "-",
    quantity:                str(p.quantity)       || "-",
    unit:                    str(p.unit)           || "Nos",
    conditionOfItems:        str(p.condition)      || "-",
    reasonForDisposal:       str(p.reason)         || "-",
    collectionLocation:      req.location          || str(p.location) || "-",
    collectionAddress:       req.location          || str(p.location) || "-",
    contactPerson:           str(p.contactPerson)  || req.requestedBy || "-",
    contactNumber:           str(p.contactNumber)  || "-",
    email:                   "-",
    invoiceRefNo:            str(p.invoiceRef)     || "-",
    purchaseDate:            fmtIsoRcy(str(p.purchaseDate)),
    additionalNotes:         str(p.notes)          || "-",
    attachments:             [],
    activity: [
      { label: "Request Raised", date: req.requestDate || "-", time: "10:00 AM",
        note: "Request has been created successfully", done: true },
      { label: "Scheduled", date: req.requestDate || "-", time: "",
        note: collectionDate ? `Collection scheduled for ${fmtIsoRcy(collectionDate)}${timeSlot ? ", " + timeSlot : ""}` : "-",
        done: status !== "Request Raised", active: status === "Scheduled" },
      { label: "In Progress", date: "-", time: "", note: "-", done: false },
      { label: "Completed",   date: "-", time: "", note: "-", done: false },
    ],
    nextAppointmentDate: fmtIsoRcy(collectionDate),
    nextAppointmentTime: timeSlot || "-",
  };
}

function loadRecycleData(id: string): RecycleData | undefined {
  const stored = getServiceRequests().find(r => r.id === id);
  if (stored) return buildRecycleFromStored(stored);
  return RECYCLE_DATA[id];
}

const STATUS_COLORS: Record<string, string> = {
  "Request Raised": "bg-yellow-100 text-yellow-700",
  "Scheduled": "bg-purple-100 text-purple-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Completed": "bg-green-100 text-green-700",
  "Cancelled": "bg-red-100 text-red-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low: "bg-gray-100 text-gray-500",
};

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
      <span className="text-gray-500 w-40 flex-shrink-0">{label}</span>
      {valueEl ?? <span className="text-gray-800 font-medium">{value}</span>}
    </div>
  );
}

const STEP_ICONS = [
  <Check className="w-4 h-4" />,
  <Calendar className="w-4 h-4" />,
  <span className="text-xs">🚛</span>,
  <Check className="w-4 h-4" />,
  <Lock className="w-4 h-4" />,
];

export default function RecycleDisposalDetailPage({ requestId }: { requestId?: string }) {
  const navigate = useNavigate();
  const id = requestId ?? "";
  const data = loadRecycleData(id);
  const activeStep = stepIndex(data?.status ?? "Request Raised");

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
                  Recycle / Disposal Request &nbsp;|&nbsp; Created on {data.createdOn}
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
        {/* ── Progress Stepper ── */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              {STEPS.map((step, i) => {
                const done = i < activeStep;
                const active = i === activeStep;
                const activityEntry = data.activity.find(a => a.label === step.key);
                const dateStr = activityEntry?.date !== "-" ? activityEntry?.date : "";
                const timeStr = activityEntry?.time ?? "";
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center min-w-[90px]">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                        done ? "bg-green-500 border-green-500 text-white" :
                        active ? "bg-white border-purple-400 text-purple-500" :
                        "bg-white border-gray-200 text-gray-300"
                      }`}>
                        {done ? <Check className="w-4 h-4" /> : STEP_ICONS[i]}
                      </div>
                      <p className={`text-xs font-semibold mt-1.5 text-center ${active ? "text-purple-600" : done ? "text-gray-700" : "text-gray-400"}`}>
                        {step.key}
                      </p>
                      {dateStr ? (
                        <p className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{dateStr}{timeStr ? `, ${timeStr}` : ""}</p>
                      ) : <p className="text-[10px] text-gray-300 text-center mt-0.5">-</p>}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded ${i < activeStep ? "bg-green-400" : "bg-gray-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Row 1: Request / Item / Collection ── */}
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
                <InfoRow label="Preferred Collection Date" value={data.preferredCollectionDate} />
                <InfoRow label="Preferred Time Slot" value={data.preferredTimeSlot} />
                <InfoRow label="Status" valueEl={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[data.status]}`}>{data.status}</span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Item / Asset Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Item / Asset Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Category" value={data.category} />
                <InfoRow label="Sub Category" value={data.subCategory} />
                <InfoRow label="Item / Asset Name" value={data.itemAssetName} />
                <InfoRow label="Brand" value={data.brand} />
                <InfoRow label="Model" value={data.model} />
                <InfoRow label="Quantity" value={data.quantity} />
                <InfoRow label="Unit" value={data.unit} />
                <InfoRow label="Condition of Items" value={data.conditionOfItems} />
                <InfoRow label="Reason for Disposal" value={data.reasonForDisposal} />
              </div>
            </CardContent>
          </Card>

          {/* Collection & Contact Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Collection & Contact Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Collection Location" valueEl={
                  <div>
                    <p className="text-xs font-medium text-gray-800">{data.collectionLocation}</p>
                    <p className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{data.collectionAddress}</p>
                  </div>
                } />
                <InfoRow label="Contact Person" value={data.contactPerson} />
                <InfoRow label="Contact Number" value={data.contactNumber} />
                <InfoRow label="Email" value={data.email} />
                <InfoRow label="Preferred Time Slot" value={data.preferredTimeSlot} />
                <InfoRow label="Preferred Collection Date" value={data.preferredCollectionDate} />
              </div>
              {data.nextAppointmentDate !== "-" && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-semibold text-gray-700">Next Appointment</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{data.nextAppointmentDate}</p>
                    <p className="text-xs text-gray-500">{data.nextAppointmentTime}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Additional Info / Service Activity / Notes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Additional Information */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Additional Information</h3>
              <div className="divide-y divide-gray-50 mb-3">
                <InfoRow label="Invoice / Reference No." value={data.invoiceRefNo} />
                <InfoRow label="Purchase Date" value={data.purchaseDate} />
                {data.additionalNotes !== "-" && (
                  <InfoRow label="Additional Notes" value={data.additionalNotes} />
                )}
              </div>
              {data.attachments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">Attachments ({data.attachments.length})</p>
                  {data.attachments.map(att => (
                    <div key={att.name} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-700">{att.name}</p>
                          <p className="text-gray-400">{att.size}</p>
                        </div>
                      </div>
                      <Download className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600" />
                    </div>
                  ))}
                </div>
              )}
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
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${act.done ? (act.active ? "bg-purple-500" : "bg-green-500") : "bg-gray-200"}`} />
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

          {/* Notes */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Notes</h3>
                <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1">
                  <Plus className="w-3 h-3" /> Add Note
                </button>
              </div>
              <p className="text-xs text-gray-400">No notes added yet.</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer ── */}
        <div className="pb-4">
          <p className="text-xs text-gray-400">
            Request created by {data.requestedBy} on {data.createdOn}
          </p>
        </div>
      </div>
    </div>
  );
}
