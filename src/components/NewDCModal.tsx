import { useState } from "react";
import { X, Plus, Trash2, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { generateDCPdfBase64, downloadDCPdf, type DeliveryChallanData, type DCLineItem } from "@/lib/dcPdfGenerator";
import { generateDCNumber } from "@/lib/dcStore";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DCFormLineItem {
  id: string;
  itemName: string;
  description: string;
  hsnCode: string;
  qty: string;
  unit: string;
  unitRate: string;
  discount: string;
  taxPercent: string;
}

interface DCForm {
  challanNo: string;
  challanDate: string;
  invoiceRef: string;
  poReference: string;
  placeOfSupply: string;
  // Consignee
  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin: string;
  consigneeContact: string;
  // Shipping
  shippedToName: string;
  shippedToAddress: string;
  shippedToStateCode: string;
  shippedToAttn: string;
  // Items
  lineItems: DCFormLineItem[];
  // Transport
  modeOfTransport: string;
  vehicleLrNo: string;
  eWayBillNo: string;
  transportationNote: string;
  shippingCharges: string;
  adjustment: string;
  // Declaration
  declaration: string;
  footerNote: string;
}

const emptyLine = (): DCFormLineItem => ({
  id: Math.random().toString(36).slice(2),
  itemName: "",
  description: "",
  hsnCode: "",
  qty: "1",
  unit: "Nos",
  unitRate: "",
  discount: "",
  taxPercent: "18",
});

const defaultForm = (): DCForm => ({
  challanNo: generateDCNumber(),
  challanDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "/"),
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
  lineItems: [emptyLine()],
  modeOfTransport: "",
  vehicleLrNo: "",
  eWayBillNo: "",
  transportationNote:
    "This Delivery Challan accompanies the movement of physical goods specified above under Rule 55 of CGST Rules, 2017.",
  shippingCharges: "",
  adjustment: "",
  declaration:
    "Please verify the quantity and condition of goods upon delivery before signing acknowledgment.\nAny discrepancy must be reported within 24 hours of receipt.",
  footerNote: "",
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeTaxable(item: DCFormLineItem): number {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.unitRate) || 0;
  const disc = parseFloat(item.discount) || 0;
  return Math.max(0, qty * rate - disc);
}

function toDataModel(form: DCForm): DeliveryChallanData {
  const lineItems: DCLineItem[] = form.lineItems
    .filter((it) => it.itemName.trim())
    .map((it) => {
      const qty = parseFloat(it.qty) || 0;
      const rate = parseFloat(it.unitRate) || undefined;
      const disc = parseFloat(it.discount) || undefined;
      const tax = parseFloat(it.taxPercent);
      const taxableValue = computeTaxable(it);
      return {
        itemName: it.itemName.trim(),
        description: it.description.trim() || undefined,
        hsnCode: it.hsnCode.trim(),
        qty,
        unit: it.unit.trim() || "Nos",
        unitRate: rate,
        discount: disc,
        taxPercent: isNaN(tax) ? undefined : tax,
        taxableValue,
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
    shippedToAddress: form.shippedToAddress.trim() || form.consigneeAddress.trim() || "—",
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

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 mt-6 first:mt-0">
      {children}
    </h3>
  );
}

function Field({
  label,
  required,
  children,
  half,
  third,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  half?: boolean;
  third?: boolean;
}) {
  return (
    <div className={half ? "col-span-1" : third ? "col-span-1" : "col-span-2"}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white placeholder-gray-400";
const textareaCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white placeholder-gray-400 resize-none";

// ── Preview modal (reused from parent) ────────────────────────────────────────
function PreviewModal({ dataUri, challanNo, onClose }: { dataUri: string; challanNo: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex flex-col bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <p className="text-sm font-semibold text-gray-800">Preview — {challanNo}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden rounded-b-xl">
          <iframe src={dataUri} title={`Preview ${challanNo}`} className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onSaved: (dc: DeliveryChallanData, id: string) => void;
}

export default function NewDCModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState<DCForm>(defaultForm);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // ── Field updaters ──────────────────────────────────────────────────────────
  const set = (key: keyof DCForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setLineItem =
    (id: string, key: keyof DCFormLineItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({
        ...f,
        lineItems: f.lineItems.map((it) => (it.id === id ? { ...it, [key]: e.target.value } : it)),
      }));
    };

  const addLine = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, emptyLine()] }));

  const removeLine = (id: string) =>
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((it) => it.id !== id) }));

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const uri = await generateDCPdfBase64(toDataModel(form));
      setPreviewUri(uri);
    } catch {
      toast.error("Failed to generate preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!form.challanNo.trim()) { toast.error("Challan number is required"); return; }
    if (!form.consigneeName.trim()) { toast.error("Consignee name is required"); return; }
    if (form.lineItems.filter((it) => it.itemName.trim()).length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const dc = toDataModel(form);
      const id = `dc_new_${Date.now()}`;
      onSaved(dc, id);
      toast.success(`${dc.challanNo} created`);
      onClose();
    } catch {
      toast.error("Failed to save delivery challan");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDownload = async () => {
    if (!form.challanNo.trim()) { toast.error("Challan number is required"); return; }
    setSaving(true);
    try {
      const dc = toDataModel(form);
      const id = `dc_new_${Date.now()}`;
      onSaved(dc, id);
      await downloadDCPdf(dc, `${dc.challanNo}.pdf`);
      toast.success(`${dc.challanNo}.pdf downloaded`);
      onClose();
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setSaving(false);
    }
  };

  // ── Totals summary (live) ────────────────────────────────────────────────────
  const validItems = form.lineItems.filter((it) => it.itemName.trim());
  const totalTaxable = validItems.reduce((s, it) => s + computeTaxable(it), 0);
  const totalGST = validItems.reduce((s, it) => {
    const taxable = computeTaxable(it);
    const tax = parseFloat(it.taxPercent);
    return s + (isNaN(tax) ? 0 : taxable * (tax / 100));
  }, 0);
  const shipping = parseFloat(form.shippingCharges) || 0;
  const adj = parseFloat(form.adjustment) || 0;
  const grandTotal = totalTaxable + totalGST + shipping + adj;

  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      {previewUri && (
        <PreviewModal dataUri={previewUri} challanNo={form.challanNo || "Draft"} onClose={() => setPreviewUri(null)} />
      )}

      {/* Modal backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-3xl flex flex-col bg-white shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">New Delivery Challan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill in all details — use Preview to check before saving</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {previewing ? (
                <span className="block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              Preview
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── 1. Challan Details ── */}
          <SectionTitle>Challan Details</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Challan Number" required half>
              <input className={inputCls} value={form.challanNo} onChange={set("challanNo")} placeholder="DC-2026-0001" />
            </Field>
            <Field label="Challan Date" required half>
              <input className={inputCls} value={form.challanDate} onChange={set("challanDate")} placeholder="DD/MM/YYYY" />
            </Field>
            <Field label="Invoice Reference" half>
              <input className={inputCls} value={form.invoiceRef} onChange={set("invoiceRef")} placeholder="INV-2026-0001" />
            </Field>
            <Field label="PO Reference" half>
              <input className={inputCls} value={form.poReference} onChange={set("poReference")} placeholder="PO-12345" />
            </Field>
            <Field label="Place of Supply">
              <input className={inputCls} value={form.placeOfSupply} onChange={set("placeOfSupply")} placeholder="e.g. Telangana (36)" />
            </Field>
          </div>

          {/* ── 2. Consignee (Billed To) ── */}
          <SectionTitle>Consignee (Billed To)</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Company / Person Name" required half>
              <input className={inputCls} value={form.consigneeName} onChange={set("consigneeName")} placeholder="Acme Corp Pvt Ltd" />
            </Field>
            <Field label="GSTIN" half>
              <input className={inputCls} value={form.consigneeGstin} onChange={set("consigneeGstin")} placeholder="27AABCT1234A1ZS" />
            </Field>
            <Field label="Address">
              <textarea className={textareaCls} rows={2} value={form.consigneeAddress} onChange={set("consigneeAddress")} placeholder="Street, City, State - PIN" />
            </Field>
            <Field label="Contact Email / Phone" half>
              <input className={inputCls} value={form.consigneeContact} onChange={set("consigneeContact")} placeholder="accounts@acme.com" />
            </Field>
          </div>

          {/* ── 3. Shipped To ── */}
          <SectionTitle>Shipped To (Delivery Address)</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Recipient Name" half>
              <input className={inputCls} value={form.shippedToName} onChange={set("shippedToName")} placeholder="Same as consignee if blank" />
            </Field>
            <Field label="State Code" half>
              <input className={inputCls} value={form.shippedToStateCode} onChange={set("shippedToStateCode")} placeholder="27 (Maharashtra)" />
            </Field>
            <Field label="Delivery Address">
              <textarea className={textareaCls} rows={2} value={form.shippedToAddress} onChange={set("shippedToAddress")} placeholder="Street, City, State - PIN" />
            </Field>
            <Field label="Attention (Attn)" half>
              <input className={inputCls} value={form.shippedToAttn} onChange={set("shippedToAttn")} placeholder="Warehouse Manager" />
            </Field>
          </div>

          {/* ── 4. Line Items ── */}
          <SectionTitle>Line Items</SectionTitle>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Item Name *", "Description", "HSN Code", "Qty", "Unit", "Unit Rate", "Discount", "GST %", "Taxable Val"].map((h) => (
                      <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((it, idx) => {
                    const taxable = computeTaxable(it);
                    return (
                      <tr key={it.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-2">
                          <input
                            className="w-36 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={it.itemName}
                            onChange={setLineItem(it.id, "itemName")}
                            placeholder={`Item ${idx + 1}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-28 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={it.description}
                            onChange={setLineItem(it.id, "description")}
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={it.hsnCode}
                            onChange={setLineItem(it.id, "hsnCode")}
                            placeholder="84713010"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-14 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                            type="number"
                            min="0"
                            value={it.qty}
                            onChange={setLineItem(it.id, "qty")}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="w-16 px-1.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            value={it.unit}
                            onChange={setLineItem(it.id, "unit")}
                          >
                            {["Nos", "Sets", "Kgs", "Ltrs", "Mtr", "Box", "Pcs", "Units"].map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                            type="number"
                            min="0"
                            value={it.unitRate}
                            onChange={setLineItem(it.id, "unitRate")}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
                            type="number"
                            min="0"
                            value={it.discount}
                            onChange={setLineItem(it.id, "discount")}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="w-16 px-1.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            value={it.taxPercent}
                            onChange={setLineItem(it.id, "taxPercent")}
                          >
                            <option value="">None</option>
                            {["0", "5", "12", "18", "28"].map((r) => (
                              <option key={r} value={r}>{r}%</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-gray-800 whitespace-nowrap">
                          {taxable > 0 ? `₹${fmt(taxable)}` : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeLine(it.id)}
                            disabled={form.lineItems.length === 1}
                            className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
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
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={13} /> Add Line Item
              </button>
            </div>
          </div>

          {/* ── Live totals ── */}
          <div className="mt-3 ml-auto w-64 border border-gray-200 rounded-xl overflow-hidden text-xs">
            {[
              ["Total Taxable Value", `₹${fmt(totalTaxable)}`],
              ["Total GST", `₹${fmt(totalGST)}`],
              ...(shipping ? [["Shipping & Handling", `₹${fmt(shipping)}`]] : []),
              ...(adj ? [["Round Off Adj.", `${adj < 0 ? "-" : ""}₹${fmt(Math.abs(adj))}`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between px-3 py-1.5 border-b border-gray-100 last:border-0 text-gray-700">
                <span>{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 bg-blue-50 font-bold text-gray-900">
              <span>Grand Total</span>
              <span>₹{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* ── 5. Transport Details ── */}
          <SectionTitle>Transport Details</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Mode of Transport" half>
              <input className={inputCls} value={form.modeOfTransport} onChange={set("modeOfTransport")} placeholder="Road – Truck / Air Cargo" />
            </Field>
            <Field label="Vehicle / LR Number" half>
              <input className={inputCls} value={form.vehicleLrNo} onChange={set("vehicleLrNo")} placeholder="MH-04-DX-7812" />
            </Field>
            <Field label="E-Way Bill Number" half>
              <input className={inputCls} value={form.eWayBillNo} onChange={set("eWayBillNo")} placeholder="881034567210" />
            </Field>
            <Field label="Shipping & Handling Charges (₹)" half>
              <input className={inputCls} type="number" min="0" value={form.shippingCharges} onChange={set("shippingCharges")} placeholder="0.00" />
            </Field>
            <Field label="Round Off Adjustment (₹)" half>
              <input className={inputCls} type="number" value={form.adjustment} onChange={set("adjustment")} placeholder="0.00" />
            </Field>
          </div>

          {/* ── 6. Transportation Note ── */}
          <SectionTitle>Transportation Note</SectionTitle>
          <textarea
            className={textareaCls}
            rows={3}
            value={form.transportationNote}
            onChange={set("transportationNote")}
            placeholder="Note about goods movement under Rule 55…"
          />

          {/* ── 7. Declaration ── */}
          <SectionTitle>Declaration Points</SectionTitle>
          <textarea
            className={textareaCls}
            rows={4}
            value={form.declaration}
            onChange={set("declaration")}
            placeholder="One declaration point per line…"
          />
          <p className="text-xs text-gray-400 mt-1">Each line becomes a separate numbered declaration point in the PDF.</p>

          {/* ── 8. Footer Note ── */}
          <SectionTitle>Footer Note</SectionTitle>
          <input
            className={inputCls}
            value={form.footerNote}
            onChange={set("footerNote")}
            placeholder="Thank you for choosing Nido Tech as your corporate essentials partner!"
          />

          <div className="h-6" />
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDownload}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="block w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save & Download PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus size={14} /> Save Challan
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
