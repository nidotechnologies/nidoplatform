import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, XCircle, Plus, Paperclip,
  Check, Calendar, Download, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServiceRequests } from "@/lib/serviceRequestsStore";

interface PurchaseItem {
  no: number;
  name: string;
  subtitle?: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  imageEmoji?: string;
}

interface PurchaseData {
  id: string;
  status: "Approved" | "Requested" | "Ordered" | "Completed" | "Cancelled";
  requestedOn: string;
  requestType: string;
  requestedBy: string;
  department: string;
  priority: "Low" | "Medium" | "High";
  totalItems: number;
  totalQuantity: string;
  estimatedTotal: string;
  purchaseFrequency: string;
  nextOrderDate: string;
  endDate: string;
  deliveryLocation: string;
  preferredTimeSlot: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  items: PurchaseItem[];
  purpose: string;
  notes: string;
  preferredVendor: string;
  attachments: { name: string; size: string }[];
  timeline: { label: string; date: string; time: string; note: string; link?: string; done: boolean; active?: boolean }[];
}

const PURCHASE_DATA: Record<string, PurchaseData> = {
  "PUR-2026-00126": {
    id: "PUR-2026-00126", status: "Approved", requestedOn: "28 Jul 2026, 11:20 AM",
    requestType: "Regular Purchase", requestedBy: "Ramesh K.",
    department: "Facilities", priority: "Medium",
    totalItems: 1, totalQuantity: "5 Cans", estimatedTotal: "₹ 300.00",
    purchaseFrequency: "Weekly", nextOrderDate: "01 Aug 2026", endDate: "28 Jul 2027",
    deliveryLocation: "Bangalore - Main Office",
    preferredTimeSlot: "10:00 AM - 12:00 PM",
    contactPerson: "Ramesh K.", contactNumber: "+91 98765 43210",
    email: "ramesh.k@apextech.com",
    items: [
      { no: 1, name: "20 Liter Water Can", subtitle: "(5 Cans)", category: "Pantry & Consumables", quantity: 5, unit: "Cans", unitPrice: 60, total: 300, imageEmoji: "🫙" },
    ],
    purpose: "Office Use",
    notes: "For pantry replenishment.",
    preferredVendor: "Aqua Pure Supplies",
    attachments: [{ name: "water_can_spec_sheet.pdf", size: "245 KB" }],
    timeline: [
      { label: "Requested", date: "28 Jul 2026", time: "11:20 AM", note: "Request has been raised", done: true },
      { label: "Approved", date: "28 Jul 2026", time: "11:25 AM", note: "Approved by Admin", done: true },
      { label: "Ordered", date: "29 Jul 2026", time: "09:15 AM", note: "PO created and sent to vendor", link: "PO-2026-01458", done: true, active: true },
      { label: "Completed", date: "-", time: "", note: "-", done: false },
      { label: "Cancelled", date: "-", time: "", note: "-", done: false },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtIsoPur(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildPurchaseFromStored(req: ReturnType<typeof getServiceRequests>[number]): PurchaseData {
  const p = (req.payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => String(v ?? "");
  const num = (v: unknown) => Number(v) || 0;

  const VALID_STATUSES = ["Approved","Requested","Ordered","Completed","Cancelled"] as const;
  const rawStatus = req.status || "Requested";
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? rawStatus as PurchaseData["status"]
    : "Requested";

  const qty      = str(p.quantity);
  const unit     = str(p.unit) || "Nos";
  const unitPrice= num(p.unitPrice);
  const total    = unitPrice && qty ? unitPrice * Number(qty) : 0;

  return {
    id:                req.id,
    status,
    requestedOn:       req.requestDate ? `${req.requestDate}, 10:00 AM` : "-",
    requestType:       "Regular Purchase",
    requestedBy:       req.requestedBy || str(p.client) || "-",
    department:        "-",
    priority:          (req.priority as PurchaseData["priority"]) || "Medium",
    totalItems:        1,
    totalQuantity:     qty ? `${qty} ${unit}` : "-",
    estimatedTotal:    total ? `₹ ${total.toFixed(2)}` : "-",
    purchaseFrequency: str(p.freqType) || "One-Time",
    nextOrderDate:     fmtIsoPur(str(p.requiredBy)),
    endDate:           fmtIsoPur(str(p.endDate)),
    deliveryLocation:  req.location || str(p.location) || "-",
    preferredTimeSlot: str(p.timeSlot) || "-",
    contactPerson:     req.requestedBy || str(p.client) || "-",
    contactNumber:     "-",
    email:             "-",
    items: [
      {
        no: 1,
        name:     str(p.itemName)   || req.itemAsset || "-",
        category: str(p.category)   || "-",
        quantity: Number(qty)       || 1,
        unit,
        unitPrice,
        total,
      },
    ],
    purpose:         str(p.purpose)        || "-",
    notes:           str(p.notes)          || "-",
    preferredVendor: str(p.vendor)         || "-",
    attachments:     [],
    timeline: [
      { label: "Requested", date: req.requestDate || "-", time: "10:00 AM",
        note: "Request has been raised", done: true },
      { label: "Approved",  date: "-", time: "", note: "Pending admin approval", done: false },
      { label: "Ordered",   date: "-", time: "", note: "-", done: false },
      { label: "Completed", date: "-", time: "", note: "-", done: false },
      { label: "Cancelled", date: "-", time: "", note: "-", done: false },
    ],
  };
}

function loadPurchaseData(id: string): PurchaseData | undefined {
  const stored = getServiceRequests().find(r => r.id === id);
  if (stored) return buildPurchaseFromStored(stored);
  return PURCHASE_DATA[id];
}

const STATUS_COLORS: Record<string, string> = {
  "Requested": "bg-yellow-100 text-yellow-700",
  "Approved": "bg-green-100 text-green-700",
  "Ordered": "bg-blue-100 text-blue-700",
  "Completed": "bg-purple-100 text-purple-700",
  "Cancelled": "bg-red-100 text-red-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-100 text-red-600",
  Medium: "bg-orange-100 text-orange-600",
  Low: "bg-gray-100 text-gray-500",
};

const STEPS = [
  { key: "Requested" },
  { key: "Approved" },
  { key: "Ordered" },
  { key: "Completed" },
  { key: "Cancelled" },
];
const STEP_ORDER = ["Requested", "Approved", "Ordered", "Completed", "Cancelled"];

function stepIndex(status: string) {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

const STEP_ICONS = [
  <Check className="w-4 h-4" />,
  <Check className="w-4 h-4" />,
  <span className="text-xs">🚚</span>,
  <Check className="w-4 h-4" />,
  <XCircle className="w-4 h-4" />,
];

function InfoRow({ label, value, valueEl }: { label: string; value?: string; valueEl?: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs py-1">
      <span className="text-gray-500 w-40 flex-shrink-0">{label}</span>
      {valueEl ?? <span className="text-gray-800 font-medium">{value}</span>}
    </div>
  );
}

export default function RegularPurchaseDetailPage({ requestId }: { requestId?: string }) {
  const navigate = useNavigate();
  const id = requestId ?? "";
  const data = loadPurchaseData(id);
  const activeStep = stepIndex(data?.status ?? "Requested");

  const orderedEntry = data?.timeline.find(t => t.label === "Ordered");

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
                  Regular Purchase Request &nbsp;|&nbsp; Requested on {data.requestedOn}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Edit Request
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <XCircle className="w-3.5 h-3.5" /> Cancel Request
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" /> More
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
                const timelineEntry = data.timeline.find(t => t.label === step.key);
                const dateStr = timelineEntry?.date !== "-" ? timelineEntry?.date : "";
                const timeStr = timelineEntry?.time ?? "";
                const linkStr = timelineEntry?.link;
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center min-w-[90px]">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                        done ? "bg-green-500 border-green-500 text-white" :
                        active ? "bg-white border-blue-400 text-blue-500" :
                        "bg-white border-gray-200 text-gray-300"
                      }`}>
                        {done ? <Check className="w-4 h-4" /> : STEP_ICONS[i]}
                      </div>
                      <p className={`text-xs font-semibold mt-1.5 text-center ${active ? "text-blue-600" : done ? "text-gray-700" : "text-gray-400"}`}>
                        {step.key}
                      </p>
                      {dateStr ? (
                        <>
                          <p className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{dateStr}{timeStr ? `, ${timeStr}` : ""}</p>
                          {linkStr && <p className="text-[10px] text-blue-600 text-center mt-0.5">{linkStr}</p>}
                        </>
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

        {/* ── Row 1: Request / Item Summary / Delivery ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Request Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Request Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Request ID" value={data.id} />
                <InfoRow label="Request Type" value={data.requestType} />
                <InfoRow label="Requested By" value={data.requestedBy} />
                <InfoRow label="Department" value={data.department} />
                <InfoRow label="Priority" valueEl={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLORS[data.priority]}`}>{data.priority}</span>
                } />
                <InfoRow label="Status" valueEl={
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[data.status]}`}>{data.status}</span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Item Summary */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Item Summary</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Total Items" value={String(data.totalItems)} />
                <InfoRow label="Total Quantity" value={data.totalQuantity} />
                <InfoRow label="Estimated Total" value={data.estimatedTotal} />
                <InfoRow label="Purchase Frequency" value={data.purchaseFrequency} />
                <InfoRow label="Next Order Date" valueEl={
                  <span className="flex items-center gap-1 text-gray-800 font-medium text-xs">
                    <Calendar className="w-3 h-3 text-gray-400" /> {data.nextOrderDate}
                  </span>
                } />
                <InfoRow label="End Date" valueEl={
                  <span className="flex items-center gap-1 text-gray-800 font-medium text-xs">
                    <Calendar className="w-3 h-3 text-gray-400" /> {data.endDate}
                  </span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Delivery Details</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow label="Delivery Location" value={data.deliveryLocation} />
                <InfoRow label="Preferred Time Slot" value={data.preferredTimeSlot} />
                <InfoRow label="Contact Person" value={data.contactPerson} />
                <InfoRow label="Contact Number" value={data.contactNumber} />
                <InfoRow label="Email" value={data.email} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Items Requested Table ── */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Items Requested</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 font-semibold">
                    <th className="py-2 px-3 text-left">#</th>
                    <th className="py-2 px-3 text-left">Item / Product</th>
                    <th className="py-2 px-3 text-left">Category</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3 text-left">Unit</th>
                    <th className="py-2 px-3 text-right">Unit Price (₹)</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <tr key={item.no} className="border-b border-gray-50">
                      <td className="py-3 px-3 text-gray-600">{item.no}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {item.imageEmoji && (
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                              {item.imageEmoji}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800">{item.name}</p>
                            {item.subtitle && <p className="text-gray-400">{item.subtitle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{item.category}</td>
                      <td className="py-3 px-3 text-right text-gray-800 font-medium">{item.quantity}</td>
                      <td className="py-3 px-3 text-gray-600">{item.unit}</td>
                      <td className="py-3 px-3 text-right text-gray-800">{item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-gray-800 font-medium">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-right text-xs font-bold text-gray-700">Total Estimated Amount</td>
                    <td className="py-3 px-3 text-right text-sm font-bold text-gray-900">₹ {data.items.reduce((s, i) => s + i.total, 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Row 2: Additional Info / Status Timeline ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Additional Information */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Additional Information</h3>
              <div className="divide-y divide-gray-50 mb-3">
                <InfoRow label="Purpose" value={data.purpose} />
                <InfoRow label="Notes" value={data.notes} />
                <InfoRow label="Preferred Vendor" value={data.preferredVendor} />
                <InfoRow label="Attachments" valueEl={
                  data.attachments.length > 0 ? (
                    <div className="flex flex-col gap-1.5 flex-1">
                      {data.attachments.map(att => (
                        <div key={att.name} className="flex items-center justify-between border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Paperclip className="w-3 h-3 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-700">{att.name}</p>
                              <p className="text-gray-400">{att.size}</p>
                            </div>
                          </div>
                          <Download className="w-3 h-3 text-gray-400 cursor-pointer hover:text-gray-600" />
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-gray-400">None</span>
                } />
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Status Timeline</h3>
              <div className="space-y-0">
                {data.timeline.map((entry, i) => (
                  <div key={entry.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                        entry.done ? (entry.active ? "bg-blue-500" : "bg-green-500") : "bg-gray-200"
                      }`} />
                      {i < data.timeline.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: "24px" }} />}
                    </div>
                    <div className="pb-3 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className={`text-xs font-semibold ${entry.done ? "text-gray-800" : "text-gray-400"}`}>{entry.label}</p>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">{entry.date}{entry.time ? `, ${entry.time}` : ""}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{entry.note}</p>
                      {entry.link && (
                        <p className="text-[11px] text-blue-600 mt-0.5 font-medium">PO Number: {entry.link}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1">
                View Full Timeline →
              </button>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer ── */}
        <div className="pb-4">
          <p className="text-xs text-gray-400">
            Created on {data.requestedOn} by {data.requestedBy}
          </p>
        </div>
      </div>
    </div>
  );
}
