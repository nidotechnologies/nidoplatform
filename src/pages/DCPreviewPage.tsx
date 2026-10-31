import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { getDCDetail } from "@/lib/dcStore";
import { downloadDCPdf, type DeliveryChallanData, type DCLineItem } from "@/lib/dcPdfGenerator";
import { loadConfig } from "@/lib/configService";

// ── number helpers ────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── totals ────────────────────────────────────────────────────────────────────
function computeTotals(dc: DeliveryChallanData) {
  const totalTaxable = dc.lineItems.reduce((s, it) => s + it.taxableValue, 0);
  const totalGST = dc.lineItems.reduce(
    (s, it) => s + (it.taxPercent != null ? it.taxableValue * (it.taxPercent / 100) : 0),
    0,
  );
  const shipping = dc.shippingCharges ?? 0;
  const adjustment = dc.adjustment ?? 0;
  const grandTotal = totalTaxable + totalGST + shipping + adjustment;
  return { totalTaxable, totalGST, shipping, adjustment, grandTotal };
}

// ── small sub-components ──────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-1 text-xs">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function AddressCard({ title, name, address, extras = [] }: {
  title: string; name: string; address: string; extras?: string[];
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2 pb-2 border-b border-gray-100">
        {title}
      </p>
      <p className="text-sm font-bold text-gray-900 mb-1">{name}</p>
      {address.split(/[,\n]/).map((l) => l.trim()).filter(Boolean).map((line, i) => (
        <p key={i} className="text-xs text-gray-600 leading-relaxed">{line}</p>
      ))}
      {extras.map((e, i) => (
        <p key={i} className="text-xs text-gray-600 leading-relaxed">{e}</p>
      ))}
    </div>
  );
}

function LineItemsTable({ items }: { items: DCLineItem[] }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-blue-50 text-gray-700 border-b border-blue-100">
          <th className="px-3 py-2 text-left font-semibold w-8">#</th>
          <th className="px-3 py-2 text-left font-semibold">Item Name</th>
          <th className="px-3 py-2 text-left font-semibold w-24">HSN / SAC</th>
          <th className="px-3 py-2 text-right font-semibold w-16">Qty</th>
          <th className="px-3 py-2 text-right font-semibold w-28">Unit Rate (₹)</th>
          <th className="px-3 py-2 text-center font-semibold w-16">GST %</th>
          <th className="px-3 py-2 text-right font-semibold w-28">Taxable Value (₹)</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
            <td className="px-3 py-2.5 text-gray-400 text-center">{i + 1}</td>
            <td className="px-3 py-2.5">
              <p className="font-semibold text-gray-900">{it.itemName}</p>
              {it.description && <p className="text-gray-500 mt-0.5">{it.description}</p>}
            </td>
            <td className="px-3 py-2.5 text-center font-mono text-gray-600">{it.hsnCode || "—"}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">{it.qty}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">
              {it.unitRate != null ? fmt(it.unitRate) : "—"}
            </td>
            <td className="px-3 py-2.5 text-center text-gray-700">
              {it.taxPercent != null ? `${it.taxPercent}%` : "—"}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(it.taxableValue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function DCPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dc, setDc] = useState<DeliveryChallanData | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const cfg = loadConfig();
  const org = cfg.organization;

  useEffect(() => {
    if (!id) { setError("No challan ID provided."); return; }
    const data = getDCDetail(id);
    if (!data) { setError("Delivery Challan not found."); return; }
    setDc(data);
  }, [id]);

  const handleDownload = async () => {
    if (!id || !dc) return;
    setDownloading(true);
    try {
      await downloadDCPdf(dc, `${dc.challanNo}.pdf`);
      toast.success(`${dc.challanNo}.pdf downloaded`);
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => window.print();

  // ── loading / error states ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500">{error}</div>
    );
  }
  if (!dc) {
    return (
      <div className="h-screen flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  const { totalTaxable, totalGST, shipping, adjustment, grandTotal } = computeTotals(dc);
  const companyName = org.displayName || org.companyName || "Nido Tech Pvt. Ltd.";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* ── Toolbar ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm px-5 py-3 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="text-gray-300">|</span>
          <h1 className="text-sm font-bold text-gray-900 truncate">
            Delivery Challan — {dc.challanNo}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download PDF
          </button>
        </div>
      </div>

      {/* ── Scrollable document area ── */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        <div
          id="dc-print-area"
          className="bg-white mx-auto shadow-lg rounded-xl overflow-hidden"
          style={{ maxWidth: 860, fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          {/* ── Header band ── */}
          <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-500 mb-1">
                {org.industry || "Corporate Essentials"}
              </p>
              <h2 className="text-2xl font-bold leading-tight text-gray-900">{companyName}</h2>
              {org.registeredAddress && (
                <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                  {org.registeredAddress}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2">
                {org.gstNumber && <p className="text-xs text-gray-500">GSTIN: {org.gstNumber}</p>}
                {org.phone && <p className="text-xs text-gray-500">Ph: {org.phone}</p>}
                {org.email && <p className="text-xs text-gray-500">{org.email}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-5 py-3">
                <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-0.5">Document</p>
                <p className="text-lg font-bold text-gray-800">DELIVERY CHALLAN</p>
              </div>
            </div>
          </div>

          {/* ── Challan meta row ── */}
          <div className="bg-blue-50 border-b border-blue-100 px-8 py-3 flex flex-wrap gap-x-8 gap-y-1">
            <InfoRow label="Challan No" value={dc.challanNo} />
            <InfoRow label="Date" value={dc.challanDate} />
            {dc.invoiceRef && <InfoRow label="Invoice Ref" value={dc.invoiceRef} />}
            {dc.poReference && <InfoRow label="PO Reference" value={dc.poReference} />}
            {dc.placeOfSupply && <InfoRow label="Place of Supply" value={dc.placeOfSupply} />}
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* ── Address cards ── */}
            <div className="flex gap-4">
              <AddressCard
                title="Consignee (Billed To)"
                name={dc.consigneeName}
                address={dc.consigneeAddress}
                extras={[
                  ...(dc.consigneeGstin ? [`GSTIN: ${dc.consigneeGstin}`] : []),
                  ...(dc.consigneeContact ? [dc.consigneeContact] : []),
                ]}
              />
              <AddressCard
                title="Shipped To (Delivery Address)"
                name={dc.shippedToName}
                address={dc.shippedToAddress}
                extras={[
                  ...(dc.shippedToStateCode ? [`State Code: ${dc.shippedToStateCode}`] : []),
                  ...(dc.shippedToAttn ? [`Attn: ${dc.shippedToAttn}`] : []),
                ]}
              />
            </div>

            {/* ── Line items ── */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <LineItemsTable items={dc.lineItems} />
              {/* totals */}
              <div className="border-t border-gray-200 flex justify-end bg-white">
                <div className="w-72">
                  {[
                    ["Total Taxable Value", `₹${fmt(totalTaxable)}`],
                    ["Total GST", `₹${fmt(totalGST)}`],
                    ...(shipping ? [["Shipping & Handling", `₹${fmt(shipping)}`]] : []),
                    ...(adjustment ? [["Round Off", `${adjustment < 0 ? "-" : ""}₹${fmt(Math.abs(adjustment))}`]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between px-4 py-2 text-xs text-gray-600 border-b border-gray-100">
                      <span>{label}</span>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-blue-50 text-gray-900 text-sm font-bold border-t border-blue-100">
                    <span>Grand Total</span>
                    <span className="tabular-nums">₹{fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Transport ── */}
            {(dc.modeOfTransport || dc.vehicleLrNo || dc.eWayBillNo || dc.transportationNote) && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Transport &amp; Logistics</p>
                </div>
                <div className="px-4 py-4">
                  <div className="flex flex-wrap gap-x-8 gap-y-1 mb-3">
                    <InfoRow label="Mode of Transport" value={dc.modeOfTransport} />
                    <InfoRow label="Vehicle / LR No" value={dc.vehicleLrNo} />
                    <InfoRow label="E-Way Bill No" value={dc.eWayBillNo} />
                  </div>
                  {dc.transportationNote && (
                    <p className="text-xs text-gray-500 italic leading-relaxed">{dc.transportationNote}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Declaration ── */}
            {dc.declaration && dc.declaration.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-blue-600 rounded-full" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Declaration</p>
                </div>
                <ul className="px-4 py-4 space-y-1.5 list-none">
                  {dc.declaration.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="text-blue-600 font-bold shrink-0">{i + 1}.</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Signatures ── */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6">Receiver's Acknowledgement</p>
                <div className="border-b border-gray-300 mb-1" />
                <p className="text-[10px] text-gray-400">Signature &amp; Stamp</p>
                <p className="text-[10px] text-gray-400 mt-3">Date: _____ / _____ / _____</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4 text-right">
                <p className="text-xs font-semibold text-gray-700">For {companyName}</p>
                <div className="border-b border-gray-300 mt-8 mb-1" />
                <p className="text-[10px] text-gray-400">Authorized Signatory</p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-gray-200 pt-4 text-center">
              <p className="text-xs text-blue-600 font-semibold">
                {dc.footerNote || `Thank you for choosing ${companyName} as your corporate essentials partner!`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
