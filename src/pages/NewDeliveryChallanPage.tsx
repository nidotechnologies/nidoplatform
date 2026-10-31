import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Eye, Save, Download, Plus, Trash2, CheckCircle2, FileText, X,
} from "lucide-react";
import { toast } from "sonner";
import { getInvoices, type StoredInvoice } from "@/lib/invoiceStore";
import {
  generateDCPdfBase64,
  downloadDCPdf,
  type DeliveryChallanData,
  type DCLineItem,
} from "@/lib/dcPdfGenerator";
import { addChallan, generateDCNumber } from "@/lib/dcStore";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormLineItem {
  id: string;
  itemName: string;
  description: string;
  hsnCode: string;
  qty: string;
  unitRate: string;
  taxPercent: string;
}

interface DCForm {
  challanNo: string;
  challanDate: string;
  invoiceRef: string;
  poReference: string;
  placeOfSupply: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin: string;
  consigneeContact: string;
  shippedToName: string;
  shippedToAddress: string;
  shippedToStateCode: string;
  shippedToAttn: string;
  lineItems: FormLineItem[];
  modeOfTransport: string;
  vehicleLrNo: string;
  eWayBillNo: string;
  transportationNote: string;
  shippingCharges: string;
  adjustment: string;
  declaration: string;
  footerNote: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function newLine(): FormLineItem {
  return {
    id: Math.random().toString(36).slice(2),
    itemName: "",
    description: "",
    hsnCode: "",
    qty: "1",
    unitRate: "",
    taxPercent: "18",
  };
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function genDCNo(): string {
  return generateDCNumber();
}

function computeTaxable(it: FormLineItem): number {
  return Math.max(0, (parseFloat(it.qty) || 0) * (parseFloat(it.unitRate) || 0));
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initForm(): DCForm {
  return {
    challanNo: genDCNo(),
    challanDate: todayDMY(),
    invoiceRef: "",
    poReference: "",
    placeOfSupply: "",
    consigneeName: "",
    consigneeAddress: "",
    consigneeGstin: "",
    consigneeContact: "",
    shippedToName: "",
    shippedToAddress: "",
    shippedToStateCode: "",
    shippedToAttn: "",
    lineItems: [newLine()],
    modeOfTransport: "",
    vehicleLrNo: "",
    eWayBillNo: "",
    transportationNote:
      "This Delivery Challan accompanies the movement of physical goods specified above under Rule 55 of CGST Rules, 2017. Service items are excluded from physical dispatch.",
    shippingCharges: "",
    adjustment: "",
    declaration:
      "Please verify the quantity and condition of goods upon delivery before signing acknowledgment.\nAny discrepancy must be reported within 24 hours of receipt.",
    footerNote: "",
  };
}

function toModel(form: DCForm): DeliveryChallanData {
  const lineItems: DCLineItem[] = form.lineItems
    .filter((it) => it.itemName.trim())
    .map((it) => {
      const tax = parseFloat(it.taxPercent);
      return {
        itemName: it.itemName.trim(),
        description: it.description.trim() || undefined,
        hsnCode: it.hsnCode.trim(),
        qty: parseFloat(it.qty) || 1,
        unit: "Nos",
        unitRate: parseFloat(it.unitRate) || undefined,
        taxPercent: isNaN(tax) ? undefined : tax,
        taxableValue: computeTaxable(it),
      };
    });

  const decl = form.declaration
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    challanNo: form.challanNo.trim() || `${generateDCNumber()}DRAFT`,
    challanDate: form.challanDate.trim(),
    invoiceRef: form.invoiceRef.trim() || undefined,
    poReference: form.poReference.trim() || undefined,
    placeOfSupply: form.placeOfSupply.trim() || undefined,
    consigneeName: form.consigneeName.trim() || "—",
    consigneeAddress: form.consigneeAddress.trim() || "—",
    consigneeGstin: form.consigneeGstin.trim() || undefined,
    consigneeContact: form.consigneeContact.trim() || undefined,
    shippedToName: form.shippedToName.trim() || form.consigneeName.trim() || "—",
    shippedToAddress:
      form.shippedToAddress.trim() || form.consigneeAddress.trim() || "—",
    shippedToStateCode: form.shippedToStateCode.trim() || undefined,
    shippedToAttn: form.shippedToAttn.trim() || undefined,
    lineItems,
    shippingCharges: parseFloat(form.shippingCharges) || undefined,
    adjustment: parseFloat(form.adjustment) || undefined,
    modeOfTransport: form.modeOfTransport.trim() || undefined,
    vehicleLrNo: form.vehicleLrNo.trim() || undefined,
    eWayBillNo: form.eWayBillNo.trim() || undefined,
    transportationNote: form.transportationNote.trim() || undefined,
    declaration: decl.length > 0 ? decl : undefined,
    footerNote: form.footerNote.trim() || undefined,
  };
}

// ── Preview modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  dataUri,
  challanNo,
  onClose,
}: {
  dataUri: string;
  challanNo: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex flex-col bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <p className="text-sm font-semibold text-gray-800">Preview — {challanNo}</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden rounded-b-xl">
          <iframe
            src={dataUri}
            title={`Preview ${challanNo}`}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-gray-100 bg-gray-50/70">
        <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
        {Icon && <Icon size={14} className="text-blue-600 shrink-0" />}
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Shared input classes ──────────────────────────────────────────────────────
const inp =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors";
const textarea =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white placeholder-gray-400 transition-colors resize-none";

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="text-red-400 ml-0.5 normal-case">*</span>}
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewDeliveryChallanPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<DCForm>(initForm);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [autoFilledFrom, setAutoFilledFrom] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | "download" | null>(null);

  // Load invoices on mount
  useEffect(() => {
    setInvoices(getInvoices());
  }, []);

  // ── Field helpers ───────────────────────────────────────────────────────────
  const setF =
    (k: keyof DCForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setLine =
    (id: string, k: keyof FormLineItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({
        ...f,
        lineItems: f.lineItems.map((it) =>
          it.id === id ? { ...it, [k]: e.target.value } : it
        ),
      }));

  const addLine = () =>
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, newLine()] }));

  const removeLine = (id: string) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.length > 1 ? f.lineItems.filter((it) => it.id !== id) : f.lineItems,
    }));

  // ── Invoice auto-fill ───────────────────────────────────────────────────────
  const handleInvoiceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invId = e.target.value;
    setSelectedInvoiceId(invId);
    if (!invId) {
      setAutoFilledFrom("");
      return;
    }
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;

    const lineItems: FormLineItem[] = inv.lineItems.map((it) => ({
      id: Math.random().toString(36).slice(2),
      itemName: it.description,
      description: it.itemDetails ?? "",
      hsnCode: it.hsnSac ?? "",
      qty: String(it.quantity),
      unitRate: String(it.rate),
      taxPercent: String(it.taxPercent),
    }));

    setForm((f) => ({
      ...f,
      invoiceRef: inv.invoiceNumber,
      poReference: inv.poReference ?? "",
      placeOfSupply: inv.placeOfSupply ?? "",
      consigneeName: inv.clientName,
      consigneeAddress: inv.billingAddress,
      consigneeGstin: inv.clientGstin ?? "",
      consigneeContact: inv.clientContact ?? "",
      shippedToName: inv.clientName,
      shippedToAddress: inv.shippingAddress || inv.billingAddress,
      shippedToStateCode: inv.shippingStateCode ?? "",
      shippedToAttn: inv.shippingAttn ?? "",
      lineItems,
    }));
    setAutoFilledFrom(`${inv.invoiceNumber} — ${inv.clientName}`);
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const validItems = form.lineItems.filter((it) => it.itemName.trim());
  const totalTaxable = validItems.reduce((s, it) => s + computeTaxable(it), 0);
  const totalGST = validItems.reduce((s, it) => {
    const tax = parseFloat(it.taxPercent);
    return s + (isNaN(tax) ? 0 : computeTaxable(it) * (tax / 100));
  }, 0);
  const shipping = parseFloat(form.shippingCharges) || 0;
  const adj = parseFloat(form.adjustment) || 0;
  const grandTotal = totalTaxable + totalGST + shipping + adj;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.challanNo.trim()) { toast.error("Challan number is required"); return false; }
    if (!form.consigneeName.trim()) { toast.error("Consignee name is required"); return false; }
    if (validItems.length === 0) { toast.error("Add at least one line item"); return false; }
    return true;
  };

  const handlePreview = async () => {
    setBusy("preview");
    try {
      const uri = await generateDCPdfBase64(toModel(form));
      setPreviewUri(uri);
    } catch {
      toast.error("Failed to generate preview");
    } finally {
      setBusy(null);
    }
  };

  const persistAndGoBack = (dc: DeliveryChallanData) => {
    const id = `dc_${Date.now()}`;
    const amount = grandTotal;
    addChallan(
      {
        id,
        date: new Date().toISOString().split("T")[0],
        number: dc.challanNo,
        referenceNumber: dc.invoiceRef || dc.poReference || "—",
        customerName: dc.consigneeName.toUpperCase(),
        status: "OPEN",
        invoiceStatus: "NOT INVOICED",
        amount,
      },
      dc
    );
    return id;
  };

  const handleSave = () => {
    if (!validate()) return;
    setBusy("save");
    try {
      persistAndGoBack(toModel(form));
      toast.success(`${form.challanNo} created`);
      navigate(-1);
    } catch {
      toast.error("Failed to save");
      setBusy(null);
    }
  };

  const handleSaveDownload = async () => {
    if (!validate()) return;
    setBusy("download");
    try {
      const dc = toModel(form);
      persistAndGoBack(dc);
      await downloadDCPdf(dc, `${dc.challanNo}.pdf`);
      toast.success(`${dc.challanNo}.pdf downloaded`);
      navigate(-1);
    } catch {
      toast.error("Failed to generate PDF");
      setBusy(null);
    }
  };

  const Spinner = () => (
    <span className="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {previewUri && (
        <PreviewModal
          dataUri={previewUri}
          challanNo={form.challanNo || "Draft"}
          onClose={() => setPreviewUri(null)}
        />
      )}

      <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
        {/* ── Fixed header ── */}
        <div className="shrink-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-full px-6 py-3 flex items-center justify-between gap-4">
            {/* Left: back + title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
                Delivery Challans
              </button>
              <span className="text-gray-300 font-light">|</span>
              <h1 className="text-sm font-bold text-gray-900 truncate">
                New Delivery Challan
              </h1>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePreview}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {busy === "preview" ? <Spinner /> : <Eye size={14} />}
                Preview PDF
              </button>
              <button
                onClick={handleSaveDownload}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {busy === "download" ? <Spinner /> : <Download size={14} />}
                Save &amp; Download PDF
              </button>
              <button
                onClick={handleSave}
                disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {busy === "save" ? <Spinner /> : <Save size={14} />}
                Save Challan
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── 1. Invoice Reference (auto-fill) ── */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl mb-5 p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Invoice Reference — Auto-fill</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select an existing invoice to automatically populate all fields below including consignee details and line items.
                </p>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-md">
                <Label>Invoice Number</Label>
                <div className="relative">
                  <select
                    value={selectedInvoiceId}
                    onChange={handleInvoiceSelect}
                    className="w-full px-3 py-2.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white appearance-none pr-8 font-medium text-gray-800 transition-colors"
                  >
                    <option value="">Select invoice to auto-fill…</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.clientName}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              {autoFilledFrom && (
                <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  Populated from {autoFilledFrom}
                </div>
              )}
            </div>
          </div>

          {/* ── 2. Challan Details ── */}
          <Section title="Challan Details">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <Label required>Challan Number</Label>
                <input
                  className={`${inp} bg-gray-50 text-gray-500 cursor-not-allowed select-none`}
                  value={form.challanNo}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="col-span-1">
                <Label required>Challan Date</Label>
                <input className={inp} value={form.challanDate} onChange={setF("challanDate")} placeholder="DD/MM/YYYY" />
              </div>
              <div className="col-span-1">
                <Label>PO Reference</Label>
                <input className={inp} value={form.poReference} onChange={setF("poReference")} placeholder="PO-12345" />
              </div>
              <div className="col-span-1">
                <Label>Place of Supply</Label>
                <input className={inp} value={form.placeOfSupply} onChange={setF("placeOfSupply")} placeholder="Telangana (36)" />
              </div>
            </div>
          </Section>

          {/* ── 3. Consignee & Shipping ── */}
          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Consignee */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">Consignee (Billed To)</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>Company / Person Name</Label>
                    <input className={inp} value={form.consigneeName} onChange={setF("consigneeName")} placeholder="Acme Corp Pvt Ltd" />
                  </div>
                  <div>
                    <Label>GSTIN</Label>
                    <input className={inp} value={form.consigneeGstin} onChange={setF("consigneeGstin")} placeholder="27AABCT1234A1ZS" />
                  </div>
                </div>
                <div>
                  <Label>Billing Address</Label>
                  <textarea className={textarea} rows={2} value={form.consigneeAddress} onChange={setF("consigneeAddress")} placeholder="Street, City, State - PIN" />
                </div>
                <div>
                  <Label>Contact Email / Phone</Label>
                  <input className={inp} value={form.consigneeContact} onChange={setF("consigneeContact")} placeholder="accounts@acme.com" />
                </div>
              </div>
            </div>

            {/* Shipped To */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <div className="w-1 h-4 bg-blue-600 rounded-full shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">Shipped To (Delivery Address)</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Recipient Name</Label>
                    <input className={inp} value={form.shippedToName} onChange={setF("shippedToName")} placeholder="Same as consignee if blank" />
                  </div>
                  <div>
                    <Label>State Code</Label>
                    <input className={inp} value={form.shippedToStateCode} onChange={setF("shippedToStateCode")} placeholder="27 (Maharashtra)" />
                  </div>
                </div>
                <div>
                  <Label>Delivery Address</Label>
                  <textarea className={textarea} rows={2} value={form.shippedToAddress} onChange={setF("shippedToAddress")} placeholder="Street, City, State - PIN" />
                </div>
                <div>
                  <Label>Attention (Attn)</Label>
                  <input className={inp} value={form.shippedToAttn} onChange={setF("shippedToAttn")} placeholder="Warehouse Manager" />
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Line Items ── */}
          <Section title="Line Items">
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 w-8">#</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Item Name <span className="text-red-400">*</span></th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Description</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 w-28">HSN Code</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 w-20">Qty</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 w-32">Unit Rate (INR)</th>
                      <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 w-24">GST %</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 w-32">Taxable Value</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.lineItems.map((it, idx) => {
                      const tv = computeTaxable(it);
                      return (
                        <tr key={it.id} className="group hover:bg-gray-50/60 transition-colors">
                          {/* # */}
                          <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-medium">{idx + 1}</td>
                          {/* Item Name */}
                          <td className="px-2 py-2.5">
                            <input
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white font-medium text-gray-900"
                              value={it.itemName}
                              onChange={setLine(it.id, "itemName")}
                              placeholder={`Item ${idx + 1}`}
                            />
                          </td>
                          {/* Description */}
                          <td className="px-2 py-2.5">
                            <input
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white text-gray-600"
                              value={it.description}
                              onChange={setLine(it.id, "description")}
                              placeholder="Optional details"
                            />
                          </td>
                          {/* HSN */}
                          <td className="px-2 py-2.5">
                            <input
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white text-center font-mono text-gray-700"
                              value={it.hsnCode}
                              onChange={setLine(it.id, "hsnCode")}
                              placeholder="84713010"
                            />
                          </td>
                          {/* Qty */}
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min="0"
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white text-right"
                              value={it.qty}
                              onChange={setLine(it.id, "qty")}
                            />
                          </td>
                          {/* Unit Rate */}
                          <td className="px-2 py-2.5">
                            <input
                              type="number"
                              min="0"
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white text-right"
                              value={it.unitRate}
                              onChange={setLine(it.id, "unitRate")}
                              placeholder="0.00"
                            />
                          </td>
                          {/* GST % */}
                          <td className="px-2 py-2.5">
                            <select
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white text-center appearance-none"
                              value={it.taxPercent}
                              onChange={setLine(it.id, "taxPercent")}
                            >
                              <option value="">None</option>
                              {["0", "5", "12", "18", "28"].map((r) => (
                                <option key={r} value={r}>{r}%</option>
                              ))}
                            </select>
                          </td>
                          {/* Taxable Value */}
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900 text-sm tabular-nums">
                            {tv > 0 ? `₹${fmtINR(tv)}` : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Delete */}
                          <td className="px-2 py-2.5">
                            <button
                              onClick={() => removeLine(it.id)}
                              disabled={form.lineItems.length === 1}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Add row */}
              <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus size={13} /> Add Line Item
                </button>
              </div>
            </div>

            {/* Totals panel */}
            <div className="flex justify-end">
              <div className="w-72 border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="divide-y divide-gray-100">
                  {[
                    ["Total Taxable Value", `₹${fmtINR(totalTaxable)}`, false],
                    ["Total GST", `₹${fmtINR(totalGST)}`, false],
                    ...(shipping ? [["Shipping & Handling", `₹${fmtINR(shipping)}`, false] as const] : []),
                    ...(adj ? [[`Round Off`, `${adj < 0 ? "-" : ""}₹${fmtINR(Math.abs(adj))}`, false] as const] : []),
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between items-center px-4 py-2.5 text-sm text-gray-600">
                      <span>{label}</span>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-blue-600 text-white">
                  <span className="text-sm font-bold">Grand Total</span>
                  <span className="text-sm font-bold tabular-nums">₹{fmtINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* ── 5. Transport & Logistics ── */}
          <Section title="Transport & Logistics">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label>Mode of Transport</Label>
                <input className={inp} value={form.modeOfTransport} onChange={setF("modeOfTransport")} placeholder="Road – Truck / Air Cargo" />
              </div>
              <div>
                <Label>Vehicle / LR Number</Label>
                <input className={inp} value={form.vehicleLrNo} onChange={setF("vehicleLrNo")} placeholder="MH-04-DX-7812" />
              </div>
              <div>
                <Label>E-Way Bill Number</Label>
                <input className={inp} value={form.eWayBillNo} onChange={setF("eWayBillNo")} placeholder="881034567210" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label>Shipping & Handling Charges (INR)</Label>
                <input type="number" min="0" className={inp} value={form.shippingCharges} onChange={setF("shippingCharges")} placeholder="0.00" />
              </div>
              <div>
                <Label>Round Off Adjustment (INR)</Label>
                <input type="number" className={inp} value={form.adjustment} onChange={setF("adjustment")} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Transportation Note</Label>
              <textarea className={textarea} rows={3} value={form.transportationNote} onChange={setF("transportationNote")} placeholder="Note about goods movement under Rule 55 of CGST Rules, 2017…" />
            </div>
          </Section>

          {/* ── 6. Declaration & Notes ── */}
          <Section title="Declaration & Notes">
            <div className="space-y-4">
              <div>
                <Label>Declaration Points</Label>
                <textarea className={textarea} rows={4} value={form.declaration} onChange={setF("declaration")} placeholder="One declaration point per line…" />
                <p className="text-xs text-gray-400 mt-1.5">Each line becomes a numbered declaration point in the PDF.</p>
              </div>
              <div>
                <Label>Footer Note</Label>
                <input className={inp} value={form.footerNote} onChange={setF("footerNote")} placeholder="Thank you for choosing Nido Tech as your corporate essentials partner!" />
              </div>
            </div>
          </Section>

          {/* Bottom action bar */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDownload}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {busy === "download" ? <Spinner /> : <Download size={14} />}
              Save &amp; Download PDF
            </button>
            <button
              onClick={handleSave}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {busy === "save" ? <Spinner /> : <Save size={14} />}
              Save Challan
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
