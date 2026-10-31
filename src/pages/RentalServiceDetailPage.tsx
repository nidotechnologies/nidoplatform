import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, XCircle, Plus, Paperclip,
  Check, Lock, Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";

interface RentalData {
  id: string;
  status: "Active" | "Approved" | "Completed" | "Closed" | "Request Raised" | "Cancelled";
  createdOn: string;
  requestType: string;
  client: string;
  location: string;
  requestDate: string;
  requestedBy: string;
  priority: "Low" | "Medium" | "High";
  category: string;
  itemAsset: string;
  quantity: string;
  brand: string;
  model: string;
  configuration: string;
  accessories: string;
  unit: string;
  rentalPeriod: string;
  startDate: string;
  endDate: string;
  preferredDeliveryDate: string;
  preferredTimeSlot: string;
  purposeOfRental: string;
  deliveryAddress: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  invoiceRefNo: string;
  paymentTerms: string;
  notes: string;
  attachments: { name: string; size: string }[];
  activity: { label: string; date: string; time: string; note: string; done: boolean; active?: boolean }[];
}

const RENTAL_DATA: Record<string, RentalData> = {
  "REN-2026-00078": {
    id: "REN-2026-00078", status: "Active", createdOn: "12 Jul 2026, 10:30 AM",
    requestType: "Rental Service", client: "Apex Tech Solutions",
    location: "Bangalore - Main Office", requestDate: "12 Jul 2026, 10:30 AM",
    requestedBy: "Ramesh K.", priority: "Medium",
    category: "IT Assets", itemAsset: "Laptop - Dell Latitude 5420",
    quantity: "5 Units", brand: "Dell", model: "Latitude 5420",
    configuration: "Intel i5, 16GB RAM, 512GB SSD",
    accessories: "Charger, Laptop Bag", unit: "Per Unit",
    rentalPeriod: "3 Months", startDate: "15 Jul 2026", endDate: "15 Oct 2026",
    preferredDeliveryDate: "15 Jul 2026", preferredTimeSlot: "10:00 AM - 12:00 PM",
    purposeOfRental: "For new team onboarding and project implementation work.",
    deliveryAddress: "Apex Tech Solutions\nNo. 45, 3rd Cross, Koramangala\nBangalore - 560034, Karnataka",
    contactPerson: "Ramesh K.", contactNumber: "+91 98765 43210",
    email: "ramesh.k@apextech.com",
    invoiceRefNo: "INV-2026-1147", paymentTerms: "Monthly",
    notes: "Please ensure all laptops are configured with Windows 11 and MS Office.",
    attachments: [{ name: "quotation.pdf", size: "245 KB" }],
    activity: [
      { label: "Request Raised", date: "12 Jul 2026", time: "10:30 AM", note: "Request has been raised successfully", done: true },
      { label: "Approved", date: "12 Jul 2026", time: "04:20 PM", note: "Request approved by Admin", done: true },
      { label: "Active", date: "15 Jul 2026", time: "10:00 AM", note: "Rental has started", done: true, active: true },
      { label: "Completed", date: "-", time: "", note: "-", done: false },
      { label: "Closed", date: "-", time: "", note: "-", done: false },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIsoRnt(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildRentalFromStored(req: ReturnType<typeof getServiceRequests>[number]): RentalData {
  const p = (req.payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => String(v ?? "");

  const VALID_STATUSES = ["Active","Approved","Completed","Closed","Request Raised","Cancelled"] as const;
  const rawStatus = req.status || "Request Raised";
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as RentalData["status"]
    : "Request Raised";

  return {
    id:                    req.id,
    status,
    createdOn:             req.requestDate ? `${req.requestDate}, 10:00 AM` : "-",
    requestType:           "Rental Service",
    client:                str(p.client)          || req.requestedBy || "-",
    location:              req.location           || str(p.location) || "-",
    requestDate:           req.requestDate        ? `${req.requestDate}, 10:00 AM` : "-",
    requestedBy:           req.requestedBy        || str(p.client)   || "-",
    priority:              (req.priority as RentalData["priority"]) || "Medium",
    category:              str(p.category)        || "-",
    itemAsset:             str(p.itemName)        || req.itemAsset   || "-",
    quantity:              str(p.quantity)        ? `${str(p.quantity)} ${str(p.unit)}`.trim() : "-",
    brand:                 str(p.brand)           || "-",
    model:                 str(p.model)           || "-",
    configuration:         "-",
    accessories:           "-",
    unit:                  str(p.unit)            || "Nos",
    rentalPeriod:          str(p.duration)        || "-",
    startDate:             fmtIsoRnt(str(p.startDate)),
    endDate:               fmtIsoRnt(str(p.endDate)),
    preferredDeliveryDate: fmtIsoRnt(str(p.deliveryDate)),
    preferredTimeSlot:     str(p.timeSlot)        || "-",
    purposeOfRental:       str(p.purpose)         || "-",
    deliveryAddress:       req.location           || str(p.location) || "-",
    contactPerson:         str(p.contactPerson)   || req.requestedBy || "-",
    contactNumber:         str(p.contactNumber)   || "-",
    email:                 "-",
    invoiceRefNo:          "-",
    paymentTerms:          "-",
    notes:                 str(p.notes)           || "-",
    attachments:           [],
    activity: [
      { label: "Request Raised", date: req.requestDate || "-", time: "10:00 AM",
        note: "Request has been raised successfully", done: true },
      { label: "Approved", date: "-", time: "", note: "Pending admin approval", done: false },
      { label: "Active",   date: "-", time: "", note: "-", done: false, active: false },
      { label: "Completed",date: "-", time: "", note: "-", done: false },
      { label: "Closed",   date: "-", time: "", note: "-", done: false },
    ],
  };
}

function loadRentalData(id: string): RentalData | undefined {
  const stored = getServiceRequests().find(r => r.id === id);
  if (stored) return buildRentalFromStored(stored);
  return RENTAL_DATA[id];
}

const STATUS_COLORS: Record<string, string> = {
  "Request Raised": "bg-yellow-100 text-yellow-700",
  "Approved": "bg-blue-100 text-blue-700",
  "Active": "bg-green-100 text-green-700",
  "Completed": "bg-purple-100 text-purple-700",
  "Closed": "bg-gray-100 text-gray-600",
  "Cancelled": "bg-red-100 text-red-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low: "bg-gray-100 text-gray-500",
};

const STEPS = [
  { key: "Request Raised" },
  { key: "Approved" },
  { key: "Active" },
  { key: "Completed" },
  { key: "Closed" },
];
const STEP_ORDER = ["Request Raised", "Approved", "Active", "Completed", "Closed"];

function stepIndex(status: string) {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

const STEP_ICONS = [
  <Check className="w-4 h-4" />,
  <Check className="w-4 h-4" />,
  <span className="text-xs">🚚</span>,
  <Check className="w-4 h-4" />,
  <Lock className="w-4 h-4" />,
];

function InfoRow({ label, value, valueEl }: { label: string; value?: string; valueEl?: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs py-1">
      <span className="text-gray-500 w-40 flex-shrink-0">{label}</span>
      {valueEl ?? <span className="text-gray-800 font-medium">{value}</span>}
    </div>
  );
}

export default function RentalServiceDetailPage({ requestId }: { requestId?: string }) {
  const navigate = useNavigate();
  const id = requestId ?? "";
  const data = loadRentalData(id);
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
                  Rental Service Request &nbsp;|&nbsp; Created on {data.createdOn}
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
                        active ? "bg-white border-green-400 text-green-500" :
                        "bg-white border-gray-200 text-gray-300"
                      }`}>
                        {done ? <Check className="w-4 h-4" /> : STEP_ICONS[i]}
                      </div>
                      <p className={`text-xs font-semibold mt-1.5 text-center ${active ? "text-green-600" : done ? "text-gray-700" : "text-gray-400"}`}>
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

        {/* ── Row 1: Request / Item / Rental Info ── */}
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
                <InfoRow label="Item / Asset" value={data.itemAsset} />
                <InfoRow label="Quantity" value={data.quantity} />
                <InfoRow label="Brand" value={data.brand} />
                <InfoRow label="Model" value={data.model} />
                <InfoRow label="Configuration" value={data.configuration} />
                <InfoRow label="Accessories" value={data.accessories} />
                <InfoRow label="Unit" value={data.unit} />
              </div>
            </CardContent>
          </Card>

          {/* Rental Information */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Rental Information</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Rental Period" value={data.rentalPeriod} />
                <InfoRow label="Start Date" value={data.startDate} />
                <InfoRow label="End Date" value={data.endDate} />
                <InfoRow label="Preferred Delivery Date" value={data.preferredDeliveryDate} />
                <InfoRow label="Preferred Time Slot" value={data.preferredTimeSlot} />
                <InfoRow label="Purpose of Rental" value={data.purposeOfRental} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Delivery / Additional Info / Service Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Delivery & Contact Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Delivery & Contact Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Delivery Address" valueEl={
                  <p className="text-xs font-medium text-gray-800 whitespace-pre-line">{data.deliveryAddress}</p>
                } />
                <InfoRow label="Contact Person" value={data.contactPerson} />
                <InfoRow label="Contact Number" value={data.contactNumber} />
                <InfoRow label="Email" value={data.email} />
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Additional Information</h3>
              <div className="divide-y divide-gray-50 mb-3">
                <InfoRow label="Invoice / Reference No." value={data.invoiceRefNo} />
                <InfoRow label="Payment Terms" value={data.paymentTerms} />
                <InfoRow label="Notes" value={data.notes} />
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
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${act.done ? (act.active ? "bg-blue-500" : "bg-green-500") : "bg-gray-200"}`} />
                      {i < data.activity.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: "24px" }} />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className={`text-xs font-semibold ${act.done ? (act.active ? "text-blue-600" : "text-gray-800") : "text-gray-400"}`}>{act.label}</p>
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
