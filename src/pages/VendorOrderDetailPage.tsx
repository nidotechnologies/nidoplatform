import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPODisplayStatus, getPOByNumber, updatePO, appendPOActivity, type StoredPO, type POLineItem, type PONote } from "@/lib/purchaseOrderStore";
import { getAvailabilityLabel } from "@/lib/productCommercialTerms";
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from "@/lib/productDocumentRules";
import {
  formatPartiallyProvisionedStatus,
  deriveDigitalFulfillmentStatus,
  getDigitalFulfillmentStatusIndex,
  getDigitalFulfillmentStatusSequence,
} from "@/lib/digitalFulfillmentStatuses";
import { getAllVendorProducts, updateVendorProduct, convertReservedToAllocated } from "@/lib/vendorStore";
import { downloadPOPdf, getPODataUri } from "@/lib/generatePO";
import { sendEmail } from "@/lib/emailApi";
import { derivePOFulfillmentStatus } from "@/lib/orderFulfillmentStatus";
import ProductConfigurationSummary from "@/components/shared/ProductConfigurationSummary";
import { getProductSpecLines } from "@/lib/productConfiguration";
import { useMyOrders } from "@/contexts/MyOrdersContext";
import { appendOrderActivity, createActivityNote, getActivityActor } from "@/lib/orderActivityStore";

// ── Mock Data ─────────────────────────────────────────────────────────────────
const PO_DATA: Record<string, any> = {
  default: {
    poNumber: "PO-10034",
    status: "Shipped",
    createdOn: "Apr 16, 2026 12:35 PM",
    vendorName: "TechHub Solutions",
    linkedMasterOrder: "ORD-24815779",
    totalItems: 8,
    totalAmount: "$1,192.00",
    orderDate: "Apr 16, 2026 12:35 PM",
    vendor: {
      name: "TechHub Solutions",
      contactPerson: "Rohit Mehta",
      email: "sales@techhub.com",
      phone: "+1 (408) 555-0198",
    },
    shipping: {
      address: "1235 Ave, San, CA 94821",
      deliveryMethod: "Direct Delivery",
      requestedDelivery: "Apr 28, 2026",
    },
    billing: {
      address: "1235 Ave, San, CA 94821",
      paymentTerms: "Net 30",
      paymentMethod: "Bank Transfer",
    },
    assignment: {
      assignedTo: "Anita Kapoor",
      initials: "AK",
      role: "Procurement Manager",
      assignedOn: "Apr 16, 2026 12:35 PM",
      notes: "Oversight on vendor coordination and delivery tracking.",
    },
    items: [
      {
        id: "i1", num: 1, name: "Mechanical Keyboard", image: "⌨️",
        referenceNumber: "",
        specs: ["USB Wired", "Black | Ergonomic Design"],
        qty: 8, unitPrice: "$149.00", total: "$1,192.00",
        status: "Shipped", expectedDelivery: "Apr 28, 2026",
        tracking: { number: "1Z999AA1234567890", carrier: "UPS", note: "Shipped on Apr 17, 2026", link: "Track Package" },
      },
      {
        id: "i2", num: 2, name: "Filing Cabinet", image: "🗄️",
        referenceNumber: "",
        specs: ["3 Drawers", "Metal | Lockable"],
        qty: 2, unitPrice: "$299.00", total: "$598.00",
        status: "Confirmed", expectedDelivery: "Apr 28, 2026",
        tracking: null,
      },
    ],
    documents: [
      { id: "d1", name: "PO-10034_Confirmation.pdf", ext: "pdf", type: "Order Confirmation", uploadedBy: "Anita Kapoor", uploadedOn: "Apr 16, 2026 01:05 PM" },
    ],
    notes: [
      { id: "n1", author: "Anita Kapoor", initials: "AK", color: "#2563eb", date: "Apr 16, 2026 01:10 PM", text: "Confirmed shipment details with TechHub. Items will be dispatched by Apr 17, 2026.", visibility: "Internal Note" },
    ],
  },
};

const ORDER_FULFILLMENT_STATUSES = [
  "Processing",
  "Pending Shipping",
  "Partially Shipped",
  "Shipped",
  "Partially Delivered",
  "Delivered",
];
const ITEM_STATUS_SEQUENCE = [
  "Pending",
  "Confirmed",
  ...ORDER_FULFILLMENT_STATUSES,
];

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Pending:    { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  Confirmed:  { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  Processing: { bg: "#faf5ff", color: "#6b21a8", border: "#d8b4fe" },
  "Pending Shipping": { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  "Partially Shipped": { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
  Shipped:    { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  "Partially Delivered": { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  Delivered:  { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Provisioning: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "Partially Provisioned": { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  Provisioned: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  Activated: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Completed: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  Cancelled:  { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
};

const STEPPER_STEPS = ORDER_FULFILLMENT_STATUSES;

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const baseStatus = String(status || "").replace(/\s+\([^)]*\)$/, "");
  const s = STATUS_STYLE[status] || STATUS_STYLE[baseStatus] || STATUS_STYLE["Pending"];
  return (
    <span style={{ padding: "4px 11px", borderRadius: 14, fontSize: 12.5, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap", display: "inline-block" }}>
      {status}
    </span>
  );
}

function isCustomerSubOrderLocked(po: any, subOrderId?: string): boolean {
  if (!po?.orderId || !subOrderId || typeof window === "undefined") return false;
  try {
    const saved = JSON.parse(localStorage.getItem(`nido_subitems_${po.orderId}`) || "{}");
    const status = saved?.[subOrderId]?.itemStatus;
    return status === "Shipped" || status === "Delivered";
  } catch {
    return false;
  }
}

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function makePOActivity(
  text: string,
  eventType: "activity" | "status-change",
  id?: string,
): PONote {
  const note = createActivityNote(text, {
    actor: getActivityActor("System"),
    eventType,
    id,
  });
  return {
    ...note,
    initials: note.initials || "SY",
    color: note.color || (eventType === "status-change" ? "#d97706" : "#6b7280"),
  };
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111827", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: accent ? "#2563eb" : "#111827" }}>{value}</div>
    </div>
  );
}

function DocIcon({ ext }: { ext: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pdf:  { bg: "#fee2e2", color: "#dc2626", label: "PDF" },
    xlsx: { bg: "#d1fae5", color: "#059669", label: "XLS" },
    docx: { bg: "#dbeafe", color: "#2563eb", label: "DOC" },
    png:  { bg: "#fef9c3", color: "#ca8a04", label: "IMG" },
    jpg:  { bg: "#fef9c3", color: "#ca8a04", label: "IMG" },
  };
  const ic = map[ext?.toLowerCase()] || { bg: "#f3f4f6", color: "#6b7280", label: ext?.toUpperCase() || "FILE" };
  return (
    <div style={{ width: 36, height: 36, borderRadius: 6, background: ic.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: ic.color, flexShrink: 0 }}>
      {ic.label}
    </div>
  );
}

// ── Update Tracking Modal ─────────────────────────────────────────────────────
function UpdateTrackingModal({ itemName, tracking, onSave, onClose }: { itemName: string; tracking: any; onSave: (t: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    number: tracking?.number || "",
    carrier: tracking?.carrier || "",
    note: tracking?.note || "",
    link: tracking?.link || "Track Package",
  });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Update Tracking Info</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{itemName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {([
            ["number", "Tracking Number", "e.g. 1Z999AA1234567890"],
            ["carrier", "Carrier", "e.g. UPS, FedEx, DHL"],
            ["note", "Note", "e.g. Shipped on Apr 17, 2026"],
          ] as [string, string, string][]).map(([key, label, placeholder]) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button
            onClick={() => {
              if (!form.number.trim() && !form.carrier.trim()) return;
              onSave({ ...form, link: form.link || "Track Package" });
              onClose();
            }}
            disabled={!form.number.trim() && !form.carrier.trim()}
            data-confirmation-skip=""
            style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: form.number.trim() || form.carrier.trim() ? "#2563eb" : "#93c5fd", color: "#fff", cursor: form.number.trim() || form.carrier.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}
          >
            Save Tracking
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveredConfirmationModal({ subject, onConfirm, onClose }: { subject: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 420, boxShadow: "0 12px 44px rgba(0,0,0,0.22)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f3f4f6", fontSize: 15, fontWeight: 700 }}>
          Mark {subject} as Delivered?
        </div>
        <div style={{ padding: "20px 22px 8px" }}>
          <div style={{ fontSize: 14, color: "#374151", marginBottom: 10 }}>
            Are you sure you want to mark this {subject} as <b>Delivered</b>?
          </div>
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#9a3412" }}>
            Delivered is a final status and cannot be replaced. Documents and Notes will be locked afterward.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "20px 22px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Keep Open</button>
          <button onClick={() => { onConfirm(); onClose(); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Confirm Delivered</button>
        </div>
      </div>
    </div>
  );
}

// ── Doc Actions Menu ──────────────────────────────────────────────────────────
function DocActionsMenu({ onDownload, onDelete }: { onDownload: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 150 });
    }
    setOpen(v => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, color: "#6b7280", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center" }}
      >
        ⋮
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, boxShadow: "0 4px 20px rgba(0,0,0,0.14)", zIndex: 9999, minWidth: 150, overflow: "hidden" }}
        >
          <button onClick={() => { onDownload(); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: 13.5, fontFamily: "inherit", color: "#374151" }}>
            ⬇ Download
          </button>
          <button onClick={() => { onDelete(); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "none", textAlign: "left", cursor: "pointer", fontSize: 13.5, fontFamily: "inherit", color: "#dc2626" }}>
            🗑 Delete
          </button>
        </div>
      )}
    </>
  );
}

// ── Upload Document Modal ─────────────────────────────────────────────────────
function UploadDocumentModal({ onSave, onClose }: { onSave: (doc: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", type: "Order Confirmation", uploadedBy: "", file: null as File | null });
  const fileRef = useRef<HTMLInputElement>(null);

  const DOC_TYPES = ["Order Confirmation", "Invoice", "Packing Slip", "Delivery Note", "Contract", "Other"];

  const handleSubmit = () => {
    const fileName = form.file ? form.file.name : form.name.trim();
    if (!fileName || !form.uploadedBy.trim()) return;
    const ext = fileName.split(".").pop()?.toLowerCase() || "file";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    onSave({ id: "d" + Date.now(), name: fileName, ext, type: form.type, uploadedBy: form.uploadedBy.trim(), uploadedOn: dateStr });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Upload Document</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* File picker */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>File</label>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #d1d5db", borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer", background: "#f9fafb" }}
            >
              {form.file ? (
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "#374151" }}>📄 {form.file.name}</div>
              ) : (
                <>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>📁</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Click to choose a file</div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0] || null;
                  setForm(prev => ({ ...prev, file: f, name: f?.name || prev.name }));
                }}
              />
            </div>
          </div>
          {/* Document type */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Document Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}
            >
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {/* Uploaded By */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Uploaded By</label>
            <input
              value={form.uploadedBy}
              onChange={e => setForm(f => ({ ...f, uploadedBy: e.target.value }))}
              placeholder="Your name"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!form.file && !form.name.trim()}
            style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: (!form.file && !form.name.trim()) ? "#93c5fd" : "#2563eb", color: "#fff", cursor: (!form.file && !form.name.trim()) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status Dropdown ───────────────────────────────────────────────────────────
function StatusDropdown({ status, onChange, disabled, allowCancel = true, digital = false, quantity }: { status: string; onChange: (s: string) => void; disabled?: boolean; allowCancel?: boolean; digital?: boolean; quantity?: number | string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const baseStatus = String(status || "").replace(/\s+\([^)]*\)$/, "");
  const s = STATUS_STYLE[status] || STATUS_STYLE[baseStatus] || STATUS_STYLE["Pending"];
  const statusSequence = digital
    ? getDigitalFulfillmentStatusSequence(quantity)
    : ITEM_STATUS_SEQUENCE;
  const canPartiallyProvision = Number.isInteger(Number(quantity)) && Number(quantity) > 1;
  const physicalNextStatus: Record<string, string> = {
    Pending: "Processing",
    Confirmed: "Processing",
    Processing: "Pending Shipping",
    "Pending Shipping": "Shipped",
    "Partially Shipped": "Shipped",
    Shipped: "Delivered",
    "Partially Delivered": "Delivered",
  };
  const currentStatusIndex = digital
    ? getDigitalFulfillmentStatusIndex(status, quantity)
    : ITEM_STATUS_SEQUENCE.indexOf(baseStatus);
  const nextStatus = digital
    ? currentStatusIndex >= 0
      ? statusSequence.slice(currentStatusIndex + 1).find(stage =>
        stage !== "Partially Provisioned" || canPartiallyProvision
      )
      : statusSequence[0]
    : physicalNextStatus[baseStatus];
  const itemStatuses = Array.from(new Set([
    ...(nextStatus ? [nextStatus] : []),
    status,
    ...(allowCancel ? ["Cancelled"] : []),
  ])).filter(option =>
    (option !== "Cancelled" || allowCancel) &&
    option !== "Partially Shipped" &&
    option !== "Partially Delivered"
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (disabled) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 14, fontSize: 12.5, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}`, opacity: 0.7 }}>
        {status}
      </span>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 14, fontSize: 12.5, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}`, cursor: "pointer", fontFamily: "inherit" }}
      >
        {status} ▾
      </button>
      {open && (
        <div style={{ position: "absolute", left: 0, top: 32, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 200, minWidth: 160, overflow: "hidden" }}>
          {itemStatuses.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 14px", border: "none", background: opt === status ? "#eff6ff" : "none", textAlign: "left", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: opt === status ? "#2563eb" : "#374151", fontWeight: opt === status ? 600 : 400 }}
            >
              {opt} {opt === status && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Assignment Modal ─────────────────────────────────────────────────────
function EditAssignmentModal({ data, onSave, onClose }: { data: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...data });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Edit Assignment</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[["assignedTo", "Assigned To"], ["role", "Role"], ["notes", "Notes"]].map(([key, label]) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
              {key === "notes"
                ? <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={3} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                : <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel Item Status Modal ──────────────────────────────────────────────────
function CancelItemStatusModal({ itemName, onConfirm, onClose }: { itemName: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length > 0;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>Cancel Item</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
            Are you sure you want to mark <strong>{itemName}</strong> as cancelled? Once cancelled, this item's status cannot be changed further.
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
            Reason for Cancellation <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Enter reason for cancellation..."
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${ok ? "#d1d5db" : "#fca5a5"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }}
          />
          {!ok && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 4 }}>Reason is required before confirming cancellation.</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Keep Item</button>
          <button onClick={() => { if (!ok) return; onConfirm(reason.trim()); onClose(); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: ok ? "#dc2626" : "#fca5a5", color: "#fff", cursor: ok ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13, fontFamily: "inherit", transition: "background 0.15s" }}>Yes, Cancel Item</button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel PO Modal ───────────────────────────────────────────────────────────
function CancelPOModal({ poNumber, onConfirm, onClose }: { poNumber: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length > 0;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>Cancel Purchase Order</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}>
            Are you sure you want to cancel <strong>{poNumber}</strong>? This action cannot be undone and the vendor will be notified.
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 }}>
            Reason for Cancellation <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Enter reason for cancellation..."
            style={{ width: "100%", padding: "8px 10px", border: `1px solid ${ok ? "#d1d5db" : "#fca5a5"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }}
          />
          {!ok && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 4 }}>Reason is required before confirming cancellation.</div>}
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Keep PO</button>
          <button onClick={() => { if (!ok) return; onConfirm(reason.trim()); onClose(); }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: ok ? "#dc2626" : "#fca5a5", color: "#fff", cursor: ok ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13, fontFamily: "inherit", transition: "background 0.15s" }}>Cancel PO</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Note Modal ────────────────────────────────────────────────────────────
function AddNoteModal({ onSave, onClose }: { onSave: (text: string, vis: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [vis, setVis] = useState("Internal Note");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Add Note</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Note</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Enter your note..." style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Visibility</label>
            <select value={vis} onChange={e => setVis(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}>
              <option>Internal Note</option>
              <option>Vendor Visible</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "12px 22px 20px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => { if (text.trim()) { onSave(text.trim(), vis); onClose(); } }} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 7, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Save Note</button>
        </div>
      </div>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ currentStatus }: { currentStatus: string }) {
  const steps = STEPPER_STEPS;
  const currentIdx = Math.max(0, steps.indexOf(currentStatus));
  const dates: Record<string, string> = {
    Confirmed: "Apr 16, 2026",
    Processing: "Apr 16, 2026",
    Shipped: "Apr 17, 2026",
    Delivered: "Pending",
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, flex: 1 }}>
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                {i > 0 && <div style={{ flex: 1, height: 2, background: done || active ? "#22c55e" : "#e5e7eb", marginTop: 0 }} />}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: done ? "#22c55e" : active ? "#3b82f6" : "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                  {done ? <span style={{ color: "#fff", fontSize: 14 }}>✓</span> : active ? <span style={{ fontSize: 16 }}>🚚</span> : <span style={{ fontSize: 14 }}>🔔</span>}
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: done ? "#22c55e" : "#e5e7eb" }} />}
              </div>
              <div style={{ marginTop: 6, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: done || active ? "#111827" : "#9ca3af" }}>{step}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{dates[step]}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Update Status Dropdown ────────────────────────────────────────────────────
function UpdateStatusDropdown({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const opts = Array.from(new Set([
    ...ORDER_FULFILLMENT_STATUSES,
    current,
  ])).filter(status =>
    status !== "Delivered" ||
    current === "Shipped" ||
    current === "Partially Delivered" ||
    current === "Delivered"
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", border: "1px solid #2563eb", borderRadius: 8, background: "#fff", color: "#2563eb", cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit" }}>
        Update Status ▾
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: 44, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 180, overflow: "hidden" }}>
          {opts.map(opt => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 16px", border: "none", background: opt === current ? "#eff6ff" : "none", textAlign: "left", cursor: "pointer", fontSize: 13.5, fontFamily: "inherit", color: opt === current ? "#2563eb" : "#374151", fontWeight: opt === current ? 600 : 400 }}>
              {opt} {opt === current && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Convert StoredPO → detail page shape ──────────────────────────────────────
function storedPOToDetail(po: StoredPO) {
  const fmtINR = (n: number) =>
    "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateObj = new Date(po.createdOn);
  const dateDisp =
    dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return {
    poNumber: po.poNumber,
    // Procurement lifecycle (Draft/Confirmed) remains stored separately.
    // The visible order status is always derived from line-item fulfillment.
    status: derivePOFulfillmentStatus(po),
    lifecycleStatus: po.status,
    createdOn: dateDisp,
    vendorName: po.vendorName,
    linkedMasterOrder: po.orderId,
    totalItems: 1,
    totalAmount: fmtINR(po.grandTotal),
    orderDate: dateDisp,
    vendor: {
      name: po.vendorName,
      contactPerson: po.vendorContact || "—",
      email: po.vendorEmail || "—",
      phone: po.vendorPhone || "—",
    },
    shipping: {
      address: [po.vendorAddressLine1, po.vendorCity, po.vendorState].filter(Boolean).join(", ") || "—",
      deliveryMethod: "Direct Delivery",
      requestedDelivery: po.requestedDelivery || "Within 30 days",
    },
    billing: {
      address: "No. 41/1, 2nd Floor, 10th Cross, Bangalore 560027",
      paymentTerms: po.paymentTerms,
      paymentMethod: "Bank Transfer",
    },
    assignment: {
      assignedTo: "System Owner",
      initials: "SO",
      role: "Procurement Manager",
      assignedOn: dateDisp,
      notes: "Auto-generated purchase order from the Nido procurement system.",
    },
    items:
      po.items && po.items.length > 0
        ? po.items.map((li, i) => ({
            id: `i${i + 1}`,
            num: i + 1,
            subOrderId: li.subOrderId,
            name: li.item,
            image: "📦",
            referenceNumber: li.referenceNumber || "",
            serialNumber: li.serialNumber || "",
            specs: li.specs || [],
             configuration: li.configuration || {},
             configurationPriceAdjustment: li.configurationPriceAdjustment || 0,
             commercialTerms: li.commercialTerms,
            qty: li.qty,
            unitPrice: fmtINR(li.unitPrice),
            total: fmtINR(li.lineSubtotal),
            status: po.status === "Cancelled"
              ? "Cancelled"
              : (po.status === "Draft"
                ? "Pending"
                : (po.status === "Confirmed" && (!li.status || li.status === "Pending" || li.status === "Confirmed")
                  ? "Processing"
                  : (li.status || getPODisplayStatus(po.status)))),
            expectedDelivery: po.requestedDelivery || "Within 30 days",
            tracking: li.tracking || null,
            cancelReason: li.cancelReason,
          }))
        : [
            {
              id: "i1",
              num: 1,
              subOrderId: po.subOrderId,
              name: po.item,
              image: "📦",
              referenceNumber: po.referenceNumber || "",
              serialNumber: po.serialNumber || "",
              specs: po.specs || [],
              commercialTerms: undefined,
              qty: po.qty,
              unitPrice: fmtINR(po.unitPrice),
              total: fmtINR(po.subtotal),
              status: po.status === "Cancelled" ? "Cancelled" : getPODisplayStatus(po.status),
              expectedDelivery: po.requestedDelivery || "Within 30 days",
              tracking: null,
            },
          ],
    documents: po.documents || [],
    notes: po.notes || [],
    // keep subtotal rows for the footer
    _subtotal: po.subtotal,
    _sgstAmt: po.sgstAmt,
    _cgstAmt: po.cgstAmt,
    _grandTotal: po.grandTotal,
    _sgstPct: po.sgstPct,
    _cgstPct: po.cgstPct,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders: masterOrders } = useMyOrders();

  const poKey = id || "PO-10034";

  // Load from shared PO store if available, else fall back to static mock data
  const realPO: StoredPO | undefined = getPOByNumber(poKey);
  const initialData = realPO
    ? storedPOToDetail(realPO)
    : (PO_DATA[poKey] || { ...PO_DATA.default, poNumber: poKey });
  const linkedMasterOrder = masterOrders.find(order =>
    order.id === (realPO?.orderId || initialData.linkedMasterOrder),
  );
  const isMasterOrderCancelled = linkedMasterOrder?.status === "Cancelled";

  const [orderStatus, setOrderStatus] = useState(initialData.status);
  const [items, setItems] = useState(initialData.items);
  const [documents, setDocuments] = useState(initialData.documents);
  const [notes, setNotes] = useState(initialData.notes);
  const [assignment, setAssignment] = useState(initialData.assignment);
  const [search, setSearch] = useState("");
  const [showCancelPO, setShowCancelPO] = useState(false);
  const [showEditAssignment, setShowEditAssignment] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("Internal Note");
  const [cancelled, setCancelled] = useState(false);
  const [poCancelReason, setPoCancelReason] = useState<string>(() => getPOByNumber(poKey)?.cancelReason || "");
  const [updateTrackingItem, setUpdateTrackingItem] = useState<{ id: string; name: string; tracking: any } | null>(null);
  const [showUploadDocument, setShowUploadDocument] = useState(false);
  const [pendingItemCancel, setPendingItemCancel] = useState<{ id: string; name: string } | null>(null);

  // A cancelled PO is a terminal state: no further status changes, item
  // edits, vendor/reference updates, or tracking changes are allowed. Derive
  // from orderStatus (single source of truth) rather than only the local
  // `cancelled` flag, so a PO cancelled elsewhere (e.g. bulk status update
  // on the orders list) is also locked here.
  const lifecycleStatus = realPO?.status || initialData.lifecycleStatus || initialData.status;
  const isDraft = lifecycleStatus === "Draft";
  const isPOCancelled = lifecycleStatus === "Cancelled" || orderStatus === "Cancelled" || cancelled;
  const isCancelled = isPOCancelled || isMasterOrderCancelled;
  const isDelivered = orderStatus === "Delivered";

  // Reset all state when navigating between different PO detail pages
  useEffect(() => {
    const po = getPOByNumber(poKey);
    const data = po
      ? storedPOToDetail(po)
      : (PO_DATA[poKey] || { ...PO_DATA.default, poNumber: poKey });
    setOrderStatus(data.status);
    setItems(data.items);
    setDocuments(data.documents);
    setNotes(data.notes);
    setAssignment(data.assignment);
    setCancelled(false);
    setPoCancelReason(po?.cancelReason || "");
  }, [poKey]);

  // Keep an already-open PO detail page in sync when the master-order page
  // updates a line's tracking or cancellation reason in the shared store.
  useEffect(() => {
    const refreshFromStore = () => {
      const latest = getPOByNumber(poKey);
      if (!latest) return;
      const data = storedPOToDetail(latest);
      setOrderStatus(data.status);
      setItems(data.items);
      setNotes(data.notes);
      setPoCancelReason(latest.cancelReason || "");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "nido_all_purchase_orders") refreshFromStore();
    };
    window.addEventListener("poCreated", refreshFromStore);
    window.addEventListener("poActivityUpdated", refreshFromStore);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("poCreated", refreshFromStore);
      window.removeEventListener("poActivityUpdated", refreshFromStore);
      window.removeEventListener("storage", onStorage);
    };
  }, [poKey]);

  const filteredItems = items.filter(it =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    (it.referenceNumber || "").toLowerCase().includes(search.toLowerCase())
  );
  const hasDigitalItems = items.some((item) => isDigitalDocumentProduct({
    productType: item.commercialTerms?.productType,
    itemName: item.name,
  }));
  const hasPhysicalItems = items.some((item) => !isDigitalDocumentProduct({
    productType: item.commercialTerms?.productType,
    itemName: item.name,
  }));
  const isDigitalOrder = hasDigitalItems && !hasPhysicalItems;
  const isMixedOrder = hasDigitalItems && hasPhysicalItems;
  const vendorDisplayStatus = isDigitalOrder
    ? deriveDigitalFulfillmentStatus(items.map(item => ({
        status: item.status || "Pending",
        quantity: item.qty,
      })))
    : orderStatus;
  const digitalStageIndex = isDigitalOrder
    ? getDigitalFulfillmentStatusIndex(vendorDisplayStatus)
    : -1;
  const itemTableGridTemplate = isDigitalOrder
    ? "40px 1fr 160px 60px 110px 110px 140px 160px 100px"
    : "40px 1fr 160px 60px 110px 110px 140px 160px 180px 100px";

  const handleItemStatusChange = (id: string, status: string) => {
    if (isCancelled) return; // PO is cancelled — no further status changes allowed
    const currentItem = items.find(item => item.id === id);
    const digital = Boolean(currentItem && isDigitalDocumentProduct(currentItem));
    if (digital && (status === "Shipped" || status === "Delivered")) return;
    const currentIndex = currentItem
      ? digital
        ? getDigitalFulfillmentStatusIndex(currentItem.status, currentItem.qty)
        : ITEM_STATUS_SEQUENCE.indexOf(currentItem.status)
      : -1;
    const nextIndex = digital
      ? getDigitalFulfillmentStatusIndex(status, currentItem?.qty)
      : ITEM_STATUS_SEQUENCE.indexOf(status);
    if (
      currentIndex >= 0 &&
      nextIndex >= 0 &&
      nextIndex < currentIndex
    ) {
      return;
    }
    if (status === "Cancelled") {
      const it = currentItem;
      if (it?.status === "Shipped" || it?.status === "Delivered") return;
      setPendingItemCancel({ id, name: it?.name || "this item" });
      return;
    }
    if (status === "Shipped") {
      const it = currentItem;
      if (!it) return;
      setUpdateTrackingItem({ id: it.id, name: it.name, tracking: it.tracking });
      return;
    }
    let savedStatus = status;
    if (digital && status === "Partially Provisioned") {
      const totalQuantity = Number(currentItem?.qty);
      if (!Number.isInteger(totalQuantity) || totalQuantity < 2) {
        window.alert("Partial provisioning is only available when at least two licenses were ordered. For a single license, select Provisioned when it is complete.");
        return;
      }
      const enteredQuantity = window.prompt(
        `Enter the actual number of licenses provisioned (1–${Math.max(0, totalQuantity - 1)}).`,
        "",
      );
      if (enteredQuantity === null) return;
      const partialStatus = formatPartiallyProvisionedStatus(Number(enteredQuantity), totalQuantity);
      if (!partialStatus) {
        window.alert(`Enter a whole number between 1 and ${Math.max(0, totalQuantity - 1)}.`);
        return;
      }
      savedStatus = partialStatus;
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, status: savedStatus } : it));
    const po = getPOByNumber(poKey);
    const itemIndex = items.findIndex(it => it.id === id);
    if (po && itemIndex >= 0) {
      const previousStatus = po.items[itemIndex]?.status || currentItem?.status || "Pending";
      const updatedLines = po.items.map((line, index) => index === itemIndex ? { ...line, status: savedStatus } : line);
      updatePO(poKey, {
        items: updatedLines,
      });
      setOrderStatus(derivePOFulfillmentStatus({ ...po, items: updatedLines }));
      const text = `${currentItem?.name || "Item"} status changed from ${previousStatus} to ${savedStatus}.`;
      const activity = makePOActivity(text, "status-change", `activity_item_status_${poKey}_${id}_${savedStatus}_${Date.now()}`);
      appendPOActivity(poKey, activity);
      appendOrderActivity(po.orderId, `PO ${po.poNumber}: ${text}`, {
        actor: activity.author,
        eventType: "status-change",
        id: activity.id,
      });
    }
  };
  const confirmItemCancel = (reason: string) => {
    if (!pendingItemCancel) return;
    const itemIndex = items.findIndex(it => it.id === pendingItemCancel.id);
    setItems(prev => prev.map(it => it.id === pendingItemCancel.id ? { ...it, status: "Cancelled", cancelReason: reason } : it));
    const po = getPOByNumber(poKey);
    if (po && itemIndex >= 0) {
      const previousStatus = po.items[itemIndex]?.status || "Pending";
      updatePO(poKey, {
        items: po.items.map((line, index) => index === itemIndex
          ? { ...line, status: "Cancelled", cancelReason: reason }
          : line),
      });
      const subOrderId = po.items[itemIndex]?.subOrderId;
      if (subOrderId) {
        try {
          const key = `nido_subitems_${po.orderId}`;
          const saved = JSON.parse(localStorage.getItem(key) || "{}");
          saved[subOrderId] = { ...(saved[subOrderId] || {}), itemStatus: "Cancelled", cancelReason: reason, updatedOn: new Date().toLocaleDateString("en-IN") };
          localStorage.setItem(key, JSON.stringify(saved));
          window.dispatchEvent(new CustomEvent("orderSubItemsUpdated", { detail: { orderId: po.orderId } }));
        } catch { /* storage unavailable */ }
      }
      const text = `${pendingItemCancel.name} status changed from ${previousStatus} to Cancelled. Reason: ${reason}`;
      const activity = makePOActivity(text, "status-change", `activity_item_cancel_${poKey}_${pendingItemCancel.id}_${Date.now()}`);
      appendPOActivity(poKey, activity);
      appendOrderActivity(po.orderId, `PO ${po.poNumber}: ${text}`, {
        actor: activity.author,
        eventType: "status-change",
        id: activity.id,
      });
    }
    setPendingItemCancel(null);
  };
  const handleItemFieldChange = (id: string, field: "referenceNumber" | "serialNumber", value: string) => {
    if (isCancelled) return;
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

    const currentRealPO = getPOByNumber(poKey);
    if (!currentRealPO) return;
    const itemIndex = items.findIndex(it => it.id === id);
    if (itemIndex < 0) return;

    const updatedItems = currentRealPO.items.map((li, index) =>
      index === itemIndex ? { ...li, [field]: value } : li
    );
    const changes: Partial<StoredPO> = { items: updatedItems };
    const updatedLine = updatedItems[itemIndex];
    if (
      currentRealPO.subOrderId === updatedLine?.subOrderId ||
      (!currentRealPO.items.length && currentRealPO.item)
    ) {
      changes[field] = value;
    }
    updatePO(poKey, changes);

    // Project vendor-entered item identifiers into Order Details immediately.
    const subOrderId = updatedLine?.subOrderId || currentRealPO.subOrderId;
    if (!subOrderId || !currentRealPO.orderId) return;
    try {
      const itemStateKey = `nido_subitems_${currentRealPO.orderId}`;
      const saved = JSON.parse(localStorage.getItem(itemStateKey) || "{}");
      saved[subOrderId] = { ...(saved[subOrderId] || {}), [field]: value };
      localStorage.setItem(itemStateKey, JSON.stringify(saved));
      window.dispatchEvent(new CustomEvent("orderSubItemsUpdated", {
        detail: { orderId: currentRealPO.orderId, subOrderIds: [subOrderId] },
      }));
    } catch {
      /* storage unavailable */
    }
  };
  const handleDeleteItem = (id: string) => {
    if (isCancelled) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };
  const handleUpdateTracking = (id: string, tracking: any) => {
    if (isCancelled) return;
    const currentItem = items.find(item => item.id === id);
    if (!currentItem || isDigitalDocumentProduct(currentItem)) return;
    const normalizedTracking = tracking?.number?.trim() || tracking?.carrier?.trim() ? tracking : null;
    const itemIndex = items.findIndex(it => it.id === id);
    const updatedItems = items.map(it => it.id === id
      ? { ...it, tracking: normalizedTracking, status: normalizedTracking ? "Shipped" : it.status }
      : it);
    setItems(updatedItems);

    const po = getPOByNumber(poKey);
    if (!po || itemIndex < 0) return;
    const updatedLines = po.items.map((line, index) => index === itemIndex
      ? { ...line, tracking: normalizedTracking, status: normalizedTracking ? "Shipped" : line.status }
      : line);
    const activeLines = updatedLines.filter(line => line.status !== "Cancelled");
    const trackedCount = activeLines.filter(line => Boolean(line.tracking?.number?.trim() || line.tracking?.carrier?.trim())).length;
    const shipmentStatus = trackedCount === 0
      ? (po.status === "Draft" ? "Draft" : "Processing")
      : trackedCount === activeLines.length ? "Shipped" : "Partially Shipped";
    updatePO(poKey, { items: updatedLines, status: shipmentStatus as StoredPO["status"] });
     setOrderStatus(derivePOFulfillmentStatus({ ...po, items: updatedLines }));
    const previousStatus = currentItem.status;
    const activity = makePOActivity(
      `${currentItem.name} status changed from ${previousStatus} to ${normalizedTracking ? "Shipped" : previousStatus}. Tracking details were ${normalizedTracking ? "recorded" : "cleared"}.`,
      normalizedTracking && previousStatus !== "Shipped" ? "status-change" : "activity",
      `activity_tracking_${poKey}_${id}_${Date.now()}`,
    );
    appendPOActivity(poKey, activity);
    appendOrderActivity(po.orderId, `PO ${po.poNumber}: ${activity.text}`, {
      actor: activity.author,
      eventType: activity.kind === "status-change" ? "status-change" : "activity",
      id: activity.id,
    });

  };
  const recordDocumentActivity = (action: "uploaded" | "downloaded", doc: any) => {
    const activity = makePOActivity(
      `Document ${action}: ${doc.name || "Untitled document"} (${doc.type || "Document"}).`,
      "activity",
      `activity_document_${action}_${poKey}_${doc.id || Date.now()}${action === "downloaded" ? `_${Date.now()}` : ""}`,
    );
    if (getPOByNumber(poKey)) {
      appendPOActivity(poKey, activity);
    } else {
      setNotes(prev => [activity, ...prev]);
    }
  };
  const handleUploadDocument = (doc: any) => {
    const nextDocuments = [...documents, doc];
    if (getPOByNumber(poKey)) updatePO(poKey, { documents: nextDocuments });
    setDocuments(nextDocuments);
    recordDocumentActivity("uploaded", doc);
  };
  const handleDownloadDocument = (doc: any) => {
    if (doc?.dataUrl) {
      const link = document.createElement("a");
      link.href = doc.dataUrl;
      link.download = doc.name || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      recordDocumentActivity("downloaded", doc);
    } else {
      const currentPO = getPOByNumber(poKey);
      if (!currentPO) {
        alert(`Downloading: ${doc.name}`);
        return;
      }
      void downloadPOPdf(currentPO)
        .then(() => recordDocumentActivity("downloaded", doc))
        .catch(console.warn);
    }
  };
  const handleDeleteDoc = (id: string) => {
    const nextDocuments = documents.filter(doc => doc.id !== id);
    if (getPOByNumber(poKey)) updatePO(poKey, { documents: nextDocuments });
    setDocuments(nextDocuments);
  };
  const handleDeleteNote = (id: string) => {
    const nextNotes = notes.filter(n => n.id !== id);
    updatePO(poKey, { notes: nextNotes });
    setNotes(nextNotes);
  };
  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const actor = getActivityActor("System Owner");
    const nextNotes = [{
      id: "n" + Date.now(),
      author: actor,
      initials: actor.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "SO",
      color: "#2563eb",
      date: dateStr,
      text: noteText.trim(),
      visibility: noteVisibility,
    }, ...notes];
    updatePO(poKey, { notes: nextNotes });
    setNotes(nextNotes);
    setNoteText("");
  };

  const card: any = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" };

  // ── Confirm Draft PO ──────────────────────────────────────────────────────────
  const handleConfirmPO = () => {
    const po = getPOByNumber(poKey);
    if (!po || po.status !== "Draft") return;

    // 1. Convert reserved stock → allocated for every line item
    for (const li of po.items) {
      if (li.productCode && po.vendorId && li.qty > 0) {
        convertReservedToAllocated(po.vendorId, li.productCode, li.qty, po.poNumber);
      }
    }

    // 2. Create audit log note inside the PO
    const now = new Date();
    const dateStr =
      now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const auditNote: PONote = {
      id: "audit_confirm_" + Date.now(),
      author: getActivityActor("System"),
      initials: getActivityActor("System").split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "SY",
      color: "#d97706",
      date: dateStr,
      text: `Purchase Order ${po.poNumber} confirmed. Status changed from Draft to Confirmed. Reserved stock converted to allocated. Vendor notification and email dispatched to ${po.vendorName} (${po.vendorEmail || "—"}).`,
      visibility: "Internal Note",
      kind: "status-change",
    };
    const updatedNotes = [auditNote, ...(po.notes || [])];

    // 3. Update PO status to Confirmed + persist audit note
    updatePO(poKey, { status: "Confirmed", notes: updatedNotes });
    setOrderStatus("Processing");
    setNotes(updatedNotes);
    appendOrderActivity(po.orderId, `Purchase Order ${po.poNumber} status changed from Draft to Confirmed.`, {
      actor: auditNote.author,
      eventType: "status-change",
      id: `activity_po_confirmed_${po.poNumber}_${auditNote.id}`,
    });

    // 4. Send vendor email notification
    if (po.vendorEmail) {
      sendEmail({
        templateKey: "purchase_order_confirmed",
        to: po.vendorEmail,
        variables: {
          vendor_name: po.vendorName,
          po_number: po.poNumber,
          order_id: po.orderId,
          grand_total: po.grandTotal,
          payment_terms: po.paymentTerms || "—",
          delivery_address: po.vendorAddress || "—",
        },
        triggerModule: "purchase_orders",
        sentBy: "System",
        dedupeKey: `po_confirm_${po.poNumber}`,
      }).catch(() => {
        // Email service may not be configured yet — log silently, PO is still confirmed
        console.warn(`[PO Confirm] Email to ${po.vendorEmail} could not be sent — email service not configured.`);
      });
    }

    // 5. Dispatch vendor notification event (for in-app notification listeners)
    try {
      window.dispatchEvent(
        new CustomEvent("vendorNotified", {
          detail: {
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            vendorName: po.vendorName,
            orderId: po.orderId,
          },
        })
      );
    } catch {
      /* SSR safe */
    }
  };

  // ── Inline-edit qty / unit price on Draft items ───────────────────────────────
  const handleDraftItemQtyChange = (itemId: string, newQty: number) => {
    if (!isDraft || isCancelled) return;
    setItems(prev => {
      if (prev.some(it => it.id === itemId && String(it.status || "").toLowerCase() === "cancelled")) return prev;
      const updated = prev.map(it => {
        if (it.id !== itemId) return it;
        const po = getPOByNumber(poKey);
        if (!po) return it;
        const fmt = (n: number) => "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const unitNum = po.items[prev.indexOf(it)]?.unitPrice ?? 0;
        return { ...it, qty: newQty, total: fmt(unitNum * newQty) };
      });
      // Persist to StoredPO
      const po = getPOByNumber(poKey);
      if (po) {
        const updatedLineItems: POLineItem[] = po.items.map((li, i) => {
          if (updated[i]?.id !== itemId) return li;
          return { ...li, qty: newQty, lineSubtotal: li.unitPrice * newQty };
        });
        const activeLineItems = updatedLineItems.filter((li) => String(li.status || "").toLowerCase() !== "cancelled");
        const newSubtotal = activeLineItems.reduce((s, li) => s + li.lineSubtotal, 0);
        const sgstAmt = Math.round(activeLineItems.reduce((s, li) => s + li.lineSubtotal * ((li.gstPct ?? 18) / 2) / 100, 0) * 100) / 100;
        updatePO(poKey, { items: updatedLineItems, subtotal: newSubtotal, sgstAmt, cgstAmt: sgstAmt, grandTotal: newSubtotal + sgstAmt * 2 });
      }
      return updated;
    });
  };

  const handleDraftItemPriceChange = (itemId: string, newPrice: number) => {
    if (!isDraft || isCancelled) return;
    setItems(prev => {
      if (prev.some(it => it.id === itemId && String(it.status || "").toLowerCase() === "cancelled")) return prev;
      const updated = prev.map(it => {
        if (it.id !== itemId) return it;
        const fmt = (n: number) => "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return { ...it, unitPrice: fmt(newPrice), total: fmt(newPrice * it.qty) };
      });
      // Persist to StoredPO
      const po = getPOByNumber(poKey);
      if (po) {
        const updatedLineItems: POLineItem[] = po.items.map((li, i) => {
          if (updated[i]?.id !== itemId) return li;
          return { ...li, unitPrice: newPrice, lineSubtotal: newPrice * li.qty };
        });
        const activeLineItems = updatedLineItems.filter((li) => String(li.status || "").toLowerCase() !== "cancelled");
        const newSubtotal = activeLineItems.reduce((s, li) => s + li.lineSubtotal, 0);
        const sgstAmt = Math.round(activeLineItems.reduce((s, li) => s + li.lineSubtotal * ((li.gstPct ?? 18) / 2) / 100, 0) * 100) / 100;
        updatePO(poKey, { items: updatedLineItems, subtotal: newSubtotal, sgstAmt, cgstAmt: sgstAmt, grandTotal: newSubtotal + sgstAmt * 2 });
      }
      return updated;
    });
  };

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: "#ffffff", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, fontFamily: "inherit", marginBottom: 12, padding: 0 }}>
          ← Back
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                <span style={{ color: "#374151" }}>{initialData.poNumber}</span>
              </h1>
              <StatusPill status={vendorDisplayStatus} />
              {isPOCancelled && <span style={{ padding: "4px 11px", borderRadius: 14, fontSize: 12.5, fontWeight: 500, background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}>PO Cancelled</span>}
              {isMasterOrderCancelled && <span style={{ padding: "4px 11px", borderRadius: 14, fontSize: 12.5, fontWeight: 600, background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}>Order Cancelled</span>}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>Vendor Order</span>
              <span style={{ color: "#d1d5db" }}>•</span>
              <span>Created on <b style={{ color: "#374151" }}>{initialData.createdOn}</b></span>
              <span style={{ color: "#d1d5db" }}>•</span>
              <span>From <b style={{ color: "#374151" }}>{initialData.vendorName}</b></span>
            </div>
          </div>
          {!isCancelled && (
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              {isDraft && (
                <button
                  onClick={handleConfirmPO}
                  style={{ padding: "9px 20px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit" }}
                >
                  ✓ Confirm Purchase Order
                </button>
              )}
              <button
                onClick={() => setShowCancelPO(true)}
                style={{ padding: "9px 20px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit" }}
              >
                Cancel PO
              </button>
            </div>
          )}
        </div>

        {/* Cancellation Reason Banner */}
        {isMasterOrderCancelled && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "12px 18px", marginTop: 14, marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#dc2626", fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Master Order Cancelled</div>
              <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}>
                The linked order was cancelled, so this purchase order is also cancelled and cannot be edited or updated.
                {linkedMasterOrder?.cancelReason ? ` Reason: ${linkedMasterOrder.cancelReason}` : ""}
              </div>
            </div>
          </div>
        )}
        {isPOCancelled && !isMasterOrderCancelled && poCancelReason && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "12px 18px", marginTop: 14, marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#dc2626", fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Cancellation Reason</div>
              <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}>{poCancelReason}</div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 20, marginBottom: 20 }}>
          <InfoCard title="Vendor Information">
            <Field label="Vendor Name" value={initialData.vendor.name} />
            <Field label="Contact Person" value={initialData.vendor.contactPerson} />
            <Field label="Email" value={initialData.vendor.email} />
            <Field label="Phone" value={initialData.vendor.phone} />
          </InfoCard>
          <InfoCard title="Shipping Information">
            <Field label="Shipping Address" value={initialData.shipping.address} />
            <Field label="Delivery Method" value={initialData.shipping.deliveryMethod} />
            <Field label="Requested Delivery" value={initialData.shipping.requestedDelivery} />
          </InfoCard>
          <InfoCard title="Billing Information">
            <Field label="Billing Address" value={initialData.billing.address} />
            <Field label="Payment Terms" value={initialData.billing.paymentTerms} />
            <Field label="Payment Method" value={initialData.billing.paymentMethod} />
          </InfoCard>
          <InfoCard title="Vendor Order Summary">
            {[
              ["PO Number", initialData.poNumber],
              ["Linked Master Order", initialData.linkedMasterOrder],
              ["Order Status", isMasterOrderCancelled ? "Cancelled" : "Active"],
              ["Total Items", initialData.totalItems],
              ["Total Amount", initialData.totalAmount],
              ["Order Date", initialData.orderDate],
            ].map(([l, v]) => (
              <div key={l as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, color: "#6b7280" }}>{l as string}</span>
                <span style={{ fontSize: 13, fontWeight: l === "Linked Master Order" || l === "Order Status" ? 600 : 500, color: l === "Linked Master Order" ? "#2563eb" : l === "Order Status" && isMasterOrderCancelled ? "#991b1b" : "#111827", cursor: l === "Linked Master Order" ? "pointer" : "default" }}
                  onClick={() => l === "Linked Master Order" && navigate(`/orders/${v}`)}
                >{v as string}</span>
              </div>
            ))}
          </InfoCard>
        </div>

        {/* Stepper + Assignment */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 20 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚚</div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 1 }}>Supplier Fulfillment Progress</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{vendorDisplayStatus}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Driven by the saved fulfillment status of the PO lines.</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginBottom: 16 }}>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Internal PO lifecycle</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700 }}>
                  {isCancelled ? "Cancelled" : isDraft ? "Draft" : "Confirmed"}
                </div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Fulfillment scope</div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700 }}>
                  {items.length} line{items.length === 1 ? "" : "s"} · {items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)} ordered units
                </div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Next action</div>
                <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}>
                  {isCancelled
                    ? "No further fulfillment updates."
                    : isDraft
                      ? "Review the vendor, quantities and terms before confirming."
                      : isDigitalOrder
                        ? "Record actual provider quantities; activation depends on the product terms."
                        : orderStatus === "Pending Shipping"
                          ? "Record dispatch tracking before marking items shipped."
                          : orderStatus === "Shipped" || orderStatus === "Partially Shipped"
                            ? "Capture proof of delivery and delivered quantities."
                            : orderStatus === "Delivered" || orderStatus === "Partially Delivered"
                              ? "Complete acceptance under the applicable client terms."
                              : "Advance each line only after its required work is complete."}
                </div>
              </div>
            </div>
            {isDigitalOrder ? (
              <div>
                <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "#6b7280" }}>Digital fulfillment stages</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${getDigitalFulfillmentStatusSequence().length}, minmax(0, 1fr))`, gap: 5 }}>
                  {getDigitalFulfillmentStatusSequence().map((stage, index) => {
                    const done = digitalStageIndex > index;
                    const current = digitalStageIndex === index;
                    return (
                      <div key={stage} style={{ minWidth: 0, textAlign: "center" }}>
                        <div style={{ height: 4, borderRadius: 4, marginBottom: 6, background: done || current ? "#2563eb" : "#e5e7eb" }} />
                        <span style={{ display: "block", fontSize: 9.5, lineHeight: 1.25, color: current ? "#1d4ed8" : "#6b7280", fontWeight: current ? 700 : 500 }}>
                          {stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Stepper currentStatus={orderStatus} />
            )}
            <div style={{ marginTop: 12, fontSize: 11.5, color: "#6b7280" }}>
              Invoice, payment, credit and refund states are tracked separately from fulfillment.
              {isDigitalOrder ? " Digital provisioning counts are recorded per line; no fixed percentage is assumed." : ""}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              {isCancelled ? (
                <span style={{ fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>This PO is cancelled and can no longer be updated.</span>
              ) : isDraft ? (
                <>
                  <span style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 7, padding: "6px 12px", fontWeight: 500 }}>
                    Draft – Review items, then confirm to send to vendor
                  </span>
                  <button
                    onClick={handleConfirmPO}
                    style={{ padding: "8px 18px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}
                  >
                    ✓ Confirm Purchase Order
                  </button>
                </>
              ) : isDelivered ? (
                <span style={{ fontSize: 12.5, color: "#166534", fontStyle: "italic" }}>This PO is Delivered and can no longer be updated.</span>
              ) : (
                <span style={{ fontSize: 12.5, color: "#6b7280", fontStyle: "italic" }}>
                  Status updates automatically from item fulfillment progress.
                </span>
              )}
            </div>
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>Assignment</span>
              {!isCancelled && (
                <button onClick={() => setShowEditAssignment(true)} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Edit</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Assigned To</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Avatar initials={assignment.initials} color="#2563eb" size={36} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{assignment.assignedTo}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{assignment.role}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Assigned On</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{assignment.assignedOn}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>{assignment.notes}</div>
          </div>
        </div>

        {/* Items Section */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "0 20px" }}>
            <div style={{ padding: "14px 0", fontSize: 14, fontWeight: 700, color: "#111827" }}>
              Items ({items.length})
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 14 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." style={{ padding: "7px 12px 7px 30px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", width: 200 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: itemTableGridTemplate, padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5 }}>
            {(isDigitalOrder
              ? ["#", "ITEM DETAILS", "SKU / DESCRIPTION", DIGITAL_PRODUCT_HEADERS.quantity, DIGITAL_PRODUCT_HEADERS.tenure, "TOTAL", "STATUS", DIGITAL_PRODUCT_HEADERS.provisioning, "ACTIONS"]
              : isMixedOrder
                ? ["#", "ITEM DETAILS", "SKU / DESCRIPTION", "QTY / USERS / LICENSES", "UNIT PRICE / TENURE", "TOTAL", "STATUS", "DELIVERY / PROVISIONING", "TRACKING INFO", "ACTIONS"]
                : ["#", "ITEM DETAILS", "SKU / DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL", "STATUS", "EXPECTED DELIVERY", "TRACKING INFO", "ACTIONS"]
            ).map(h => <div key={h}>{h}</div>)}
          </div>
          {filteredItems.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No items found.</div>
          )}
          {filteredItems.map((item, idx) => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: itemTableGridTemplate, padding: "16px 20px", alignItems: "start", borderBottom: idx < filteredItems.length - 1 ? "1px solid #f3f4f6" : "none", background: "#fff" }}>
              <div style={{ color: "#6b7280", fontSize: 13, paddingTop: 3 }}>{item.num}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: "#f3f4f6", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.image}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
                    <ProductConfigurationSummary
                      configuration={item.configuration}
                      priceAdjustment={item.configurationPriceAdjustment}
                      className="rounded-md bg-violet-50 px-2 py-1"
                    />
                     {item.commercialTerms && (
                       <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px", fontSize: 10.5, color: "#6b7280", lineHeight: 1.4 }}>
                         <span>Pricing Model: <strong style={{ color: "#374151" }}>{item.commercialTerms.pricingModel}</strong></span>
                          <span>{isDigitalDocumentProduct(item) ? `${DIGITAL_PRODUCT_HEADERS.tenure}:` : "MOQ / Min Qty:"} <strong style={{ color: "#374151" }}>{isDigitalDocumentProduct(item) ? getDocumentProductPresentation(item, { quantity: item.qty }).tenureBilling : item.commercialTerms.moqLabel}</strong></span>
                          <span>{isDigitalDocumentProduct(item) ? `${DIGITAL_PRODUCT_HEADERS.provisioning}:` : "Lead Time / SLA:"} <strong style={{ color: "#374151" }}>{isDigitalDocumentProduct(item) ? getDocumentProductPresentation(item, { quantity: item.qty }).provisioningTime : `${item.commercialTerms.leadTimePrimary}${item.commercialTerms.leadTimeSecondary ? ` · ${item.commercialTerms.leadTimeSecondary}` : ""}`}</strong></span>
                         <span>Availability: <strong style={{ color: item.commercialTerms.availabilityStatus === "Out of Stock" ? "#dc2626" : "#059669" }}>{getAvailabilityLabel(item.commercialTerms)}</strong></span>
                       </div>
                     )}
                     <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxWidth: 240 }}>
                       <label style={{ display: "block", fontSize: 10.5, color: "#6b7280" }}>
                         Reference No
                         <input
                           value={item.referenceNumber || ""}
                           onChange={e => handleItemFieldChange(item.id, "referenceNumber", e.target.value)}
                           disabled={isCancelled}
                           placeholder="Reference No"
                           style={{ width: "100%", marginTop: 2, padding: "5px 7px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: isCancelled ? "#f9fafb" : "#fff" }}
                         />
                       </label>
                       <label style={{ display: "block", fontSize: 10.5, color: "#6b7280" }}>
                         Serial No
                         <input
                           value={item.serialNumber || ""}
                           onChange={e => handleItemFieldChange(item.id, "serialNumber", e.target.value)}
                           disabled={isCancelled}
                           placeholder="Serial No"
                           style={{ width: "100%", marginTop: 2, padding: "5px 7px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: isCancelled ? "#f9fafb" : "#fff" }}
                         />
                       </label>
                    </div>
                    <button style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit", marginTop: 4 }}>View more</button>
                  </div>
                </div>
              </div>
              <div>
                {getProductSpecLines(item.specs, item.configuration).map(s => <div key={s} style={{ fontSize: 11.5, color: "#6b7280" }}>• {s}</div>)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.qty}</div>
               <div style={{ fontSize: 13 }}>{isDigitalDocumentProduct(item) ? getDocumentProductPresentation(item, { quantity: item.qty }).tenureBilling : item.unitPrice}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.total}</div>
              <div>
                <StatusDropdown
                  status={item.status}
                  onChange={s => handleItemStatusChange(item.id, s)}
                  disabled={isCancelled || item.status === "Cancelled"}
                  allowCancel={false}
                  digital={isDigitalDocumentProduct(item)}
                  quantity={item.qty}
                />
                {item.status === "Cancelled" && (item as any).cancelReason && (
                  <div style={{ fontSize: 11, color: "#991b1b", marginTop: 5, lineHeight: 1.4, fontStyle: "italic" }}>
                    Reason: {(item as any).cancelReason}
                  </div>
                )}
              </div>
                <div style={{ fontSize: 12.5, color: "#374151" }}>{isDigitalDocumentProduct(item) ? getDocumentProductPresentation(item, { quantity: item.qty }).provisioningTime : item.expectedDelivery}</div>
              {!isDigitalOrder && (
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.65 }}>
                  {isDigitalDocumentProduct(item) ? (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  ) : item.tracking ? (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{item.tracking.number}</div>
                      <div style={{ color: "#6b7280" }}>{item.tracking.carrier}</div>
                      <div style={{ color: "#6b7280" }}>{item.tracking.note}</div>
                      <a href="#" onClick={e => e.preventDefault()} style={{ color: "#2563eb", textDecoration: "none", fontSize: 12 }}>{item.tracking.link}</a>
                    </>
                  ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  {!isDigitalDocumentProduct(item) && !isCancelled && item.status === "Shipped" && (
                    <div style={{ marginTop: 7 }}>
                      <button
                        onClick={() => setUpdateTrackingItem({ id: item.id, name: item.name, tracking: item.tracking })}
                        style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 5, background: "#f9fafb", color: "#374151", cursor: "pointer", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit" }}
                      >
                        Update
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                {item.status === "Cancelled" ? (
                  <span style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}>Cancelled</span>
                ) : item.status === "Shipped" || item.status === "Delivered" ? (
                  <span style={{ fontSize: 12, color: "#9ca3af" }} title="Shipped and delivered items cannot be cancelled here">—</span>
                ) : isCancelled ? (
                  <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                ) : (
                  <button
                    onClick={() => setPendingItemCancel({ id: item.id, name: item.name })}
                    style={{ padding: "5px 12px", border: "1px solid #fca5a5", borderRadius: 6, background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
          {/* Totals */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 280 }}>
              {realPO ? (
                <>
                  {[
                    ["Sub-total", "₹ " + realPO.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
                    [`SGST (${realPO.sgstPct}%)`, "₹ " + realPO.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
                    [`CGST (${realPO.cgstPct}%)`, "₹ " + realPO.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, color: "#6b7280" }}>{l}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </>
              ) : (
                [["Sub-total", "$1,790.00"], ["Tax (10%)", "$222.00"]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, color: "#6b7280" }}>{l}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{v}</span>
                  </div>
                ))
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Total Order Amount</span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{initialData.totalAmount}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 20px", borderTop: "1px solid #f3f4f6", fontSize: 13, color: "#6b7280" }}>
            Showing 1 to {filteredItems.length} of {items.length} items
          </div>
        </div>

        {isCancelled ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "28px 24px", textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#991b1b" }}>Purchase Order is Cancelled</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>This purchase order and its linked order are inactive and can no longer be edited or updated.</div>
          </div>
        ) : isDelivered ? (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "28px 24px", textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>Documents & Notes are locked</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>This PO is Delivered and can no longer be edited.</div>
          </div>
        ) : (
          <>
        {/* Documents Section */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", padding: "14px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Documents ({documents.length})</div>
            <button onClick={() => setShowUploadDocument(true)} style={{ padding: "7px 16px", border: "1px solid #d1d5db", borderRadius: 7, background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>+ Upload Document</button>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {documents.length === 0 ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "48px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>No documents</div>
              </div>
            ) : (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 180px 60px", padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5 }}>
                  {["DOCUMENT NAME", "TYPE", "UPLOADED BY", "UPLOADED ON", "ACTIONS"].map(h => <div key={h}>{h}</div>)}
                </div>
                {documents.map((doc, idx) => (
                  <div key={doc.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 180px 60px", padding: "14px 16px", alignItems: "center", borderBottom: idx < documents.length - 1 ? "1px solid #f3f4f6" : "none", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <DocIcon ext={doc.ext} />
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{doc.name}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{doc.type}</div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{doc.uploadedBy}</div>
                    <div style={{ fontSize: 12.5, color: "#6b7280" }}>{doc.uploadedOn}</div>
                    <DocActionsMenu
                      onDownload={() => handleDownloadDocument(doc)}
                      onDelete={() => handleDeleteDoc(doc.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ borderBottom: "1px solid #f3f4f6", padding: "14px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Notes</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>{notes.length} note{notes.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ padding: "20px 24px 28px" }}>
            {/* Inline Add Note composer */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 220px" }}>
                <div style={{ padding: "14px 16px", borderRight: "1px solid #e5e7eb" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8, color: "#111827" }}>Add Note</div>
                  <textarea
                    value={noteText}
                    onChange={e => { if (e.target.value.length <= 500) setNoteText(e.target.value); }}
                    placeholder="Write your note here..."
                    rows={4}
                    style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13.5, fontFamily: "inherit", color: "#374151", boxSizing: "border-box", background: "transparent" }}
                  />
                  <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>{noteText.length} / 500</div>
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>Visibility</div>
                    {([["Internal Note", "🔒", "Only visible to internal users"], ["External Note", "🌐", "Visible to vendors and other external users"]] as [string, string, string][]).map(([label, icon, sub]) => (
                      <div key={label} onClick={() => setNoteVisibility(label)} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14, cursor: "pointer" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${noteVisibility === label ? "#2563eb" : "#d1d5db"}`, background: noteVisibility === label ? "#2563eb" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0 }}>
                          {noteVisibility === label && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", display: "flex", alignItems: "center", gap: 5 }}>{icon} {label}</div>
                          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={handleAddNote}
                      disabled={!noteText.trim()}
                      style={{ padding: "8px 22px", border: "none", borderRadius: 8, background: noteText.trim() ? "#2563eb" : "#93c5fd", color: "#fff", cursor: noteText.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit" }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Note list */}
            {notes.map((note, i) => (
              <div key={note.id} style={{ display: "flex", gap: 12, marginBottom: 14, padding: note.kind ? "10px 12px 14px" : "0 0 14px", borderBottom: i < notes.length - 1 ? "1px solid #f3f4f6" : "none", borderLeft: note.kind === "status-change" ? "3px solid #f59e0b" : note.kind ? "3px solid #9ca3af" : "none", background: note.kind === "status-change" ? "#fffbeb" : note.kind ? "#f9fafb" : "transparent", borderRadius: note.kind ? 7 : 0 }}>
                <Avatar initials={(note.initials || note.author?.charAt(0) || "U")} color={note.color || "#2563eb"} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>{note.author}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{note.date}</span>
                    <span style={{ fontSize: 11, background: note.visibility === "Internal Note" ? "#eff6ff" : "#faf5ff", color: note.visibility === "Internal Note" ? "#1d4ed8" : "#7c3aed", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                      {note.visibility === "Internal Note" ? "🔒 Internal" : "🌐 External"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                    {note.kind && <span style={{ display: "inline-block", marginRight: 8, padding: "2px 7px", borderRadius: 8, background: note.kind === "status-change" ? "#fef3c7" : "#e5e7eb", color: note.kind === "status-change" ? "#92400e" : "#4b5563", fontSize: 10.5, fontWeight: 700, verticalAlign: "middle" }}>{note.kind === "status-change" ? "STATUS CHANGE" : "ACTIVITY"}</span>}
                    {note.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

          </>
        )}

      </div>

      {/* Modals */}
      {showCancelPO && (
        <CancelPOModal
          poNumber={initialData.poNumber}
          onConfirm={(reason) => {
            // Restore vendor stock for all line items on this PO
            const po = getPOByNumber(poKey);
            if (po) {
              const storeMap = getAllVendorProducts();
              const vendorProducts = storeMap[po.vendorId] || [];
              for (const li of (po.items || [])) {
                if (!li.productCode) continue;
                const match = vendorProducts.find(
                  p => p.masterProductCode === li.productCode && p.status === 'Active'
                );
                if (match) {
                  const current = parseInt(match.stock) || 0;
                  updateVendorProduct(po.vendorId, match.id, { stock: String(current + li.qty) });
                }
              }
              // Persist the terminal status so the master order can mark every
              // covered item inactive and prevent vendor re-selection.
              updatePO(poKey, { status: "Cancelled", cancelReason: reason });
              const activity = makePOActivity(`Purchase Order ${po.poNumber} status changed from ${po.status} to Cancelled. Reason: ${reason}`, "status-change", `activity_po_cancelled_${po.poNumber}_${Date.now()}`);
              appendPOActivity(poKey, activity);
              appendOrderActivity(po.orderId, activity.text, {
                actor: activity.author,
                eventType: "status-change",
                id: activity.id,
              });
            }
            setCancelled(true);
            setOrderStatus("Cancelled");
            setPoCancelReason(reason);
          }}
          onClose={() => setShowCancelPO(false)}
        />
      )}
      {pendingItemCancel && (
        <CancelItemStatusModal
          itemName={pendingItemCancel.name}
          onConfirm={confirmItemCancel}
          onClose={() => setPendingItemCancel(null)}
        />
      )}
      {showEditAssignment && (
        <EditAssignmentModal
          data={assignment}
          onSave={d => setAssignment(d)}
          onClose={() => setShowEditAssignment(false)}
        />
      )}
      {updateTrackingItem && (
        <UpdateTrackingModal
          itemName={updateTrackingItem.name}
          tracking={updateTrackingItem.tracking}
          onSave={t => handleUpdateTracking(updateTrackingItem.id, t)}
          onClose={() => setUpdateTrackingItem(null)}
        />
      )}
      {showUploadDocument && (
        <UploadDocumentModal
          onSave={handleUploadDocument}
          onClose={() => setShowUploadDocument(false)}
        />
      )}
    </div>
  );
}
