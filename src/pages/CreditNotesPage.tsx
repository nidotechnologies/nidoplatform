import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Calendar,
  Download,
  FileText,
  Filter,
  Hash,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ReceiptIndianRupee,
  Search,
  Tag,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getPrefix, loadConfig } from "@/lib/configService";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { safeReadJson } from "@/lib/utils";
import { downloadCreditNotePdf } from "@/lib/creditNotePdf";

// ── Types ─────────────────────────────────────────────────────────────────────
type Reason =
  | "Sales Return"
  | "Post Sale Discount"
  | "Deficiency in service"
  | "Correction in invoice"
  | "Change in POS"
  | "Finalization of Provisional assessment"
  | "Others";

type CreditStatus = "draft" | "open";

interface CreditItem {
  itemName: string;
  account: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  discount: number;
  taxRate: number;
}

interface CreditNoteEntry {
  id: string;
  creditNoteNumber: string;
  referenceNumber: string;
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  invoiceNumber: string;
  invoiceDate: string;
  issueDate: string;
  reason: Reason;
  placeOfSupply: string;
  status: CreditStatus;
  item: CreditItem;
  shippingCharges: number;
  adjustment: number;
  subtotal: number;
  total: number;
  creditsRemaining: number;
  totalInWords: string;
  notes: string;
  terms: string;
  taxMode: "tds" | "tcs";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nido_credit_notes_v3";

const reasons: Reason[] = [
  "Sales Return",
  "Post Sale Discount",
  "Deficiency in service",
  "Correction in invoice",
  "Change in POS",
  "Finalization of Provisional assessment",
  "Others",
];

const today = () => new Date().toISOString().slice(0, 10);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const numberToWordsLocal = (value: number) => {
  const units = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (num: number): string => {
    if (num < 20) return units[num];
    if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${units[num % 10]}` : ""}`;
    if (num < 1000) { const rem = num % 100; return `${units[Math.floor(num / 100)]} Hundred${rem ? ` ${convert(rem)}` : ""}`; }
    if (num < 100000) { const rem = num % 1000; return `${convert(Math.floor(num / 1000))} Thousand${rem ? ` ${convert(rem)}` : ""}`; }
    return String(num);
  };
  return `Indian Rupee ${convert(Math.max(0, Math.round(value)))} Only`;
};

const computeTotals = (item: CreditItem, shippingCharges: number, adjustment: number) => {
  const base = Math.max(0, item.quantity * item.rate - item.discount);
  const total = Math.round((base + shippingCharges + adjustment) * 100) / 100;
  return {
    subtotal: Math.round(base * 100) / 100,
    total,
    creditsRemaining: total,
    totalInWords: numberToWordsLocal(total),
  };
};

function nextCode(prefix: string, existing: string[], pad = 5): string {
  const nums = existing
    .map((s) => { const m = s.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

const defaultNotes: CreditNoteEntry[] = [
  {
    id: "cn-1",
    creditNoteNumber: "CN-God-00002",
    referenceNumber: "142012681",
    customerName: "Godrej & Boyce",
    customerAddress: "Godrej & Boyce Mfg. Co. Ltd.\nMADKAI\nD6 MADKAI INDUSTRIAL ESTATE\nPonda\n403404 Goa\nIndia",
    customerGstin: "30AAACG1395D1Z7",
    invoiceNumber: "18/GB/050715",
    invoiceDate: "2018-12-02",
    issueDate: "2019-11-07",
    reason: "Sales Return",
    placeOfSupply: "Goa (30)",
    status: "draft",
    item: { itemName: "MRT-113-24-G1", account: "Sales", description: "Gauge Manufacturing & Inspection", hsnSac: "90173021", quantity: 1, rate: 3380, discount: 0, taxRate: 0 },
    shippingCharges: 0,
    adjustment: 0,
    subtotal: 3380,
    total: 3380,
    creditsRemaining: 3380,
    totalInWords: "Indian Rupee Three Thousand Three Hundred Eighty Only",
    notes: "1. Clarification will be made on the post quality check mutually.",
    terms: "1. As per the debit note, credit note raised for the correction of the product.\n2. Quality check will be made as on F2F on the dated supply, post confirmation by mutual understanding.\n3. Price mentioned are excluding Taxes.",
    taxMode: "tds",
  },
  {
    id: "cn-2",
    creditNoteNumber: "CN-God-00006",
    referenceNumber: "142012684",
    customerName: "Godrej & Boyce",
    customerAddress: "Godrej & Boyce Mfg. Co. Ltd.\nMADKAI\nD6 MADKAI INDUSTRIAL ESTATE\nPonda\n403404 Goa\nIndia",
    customerGstin: "30AAACG1395D1Z7",
    invoiceNumber: "INV-18/GB/050761",
    invoiceDate: "2019-11-07",
    issueDate: "2019-11-07",
    reason: "Sales Return",
    placeOfSupply: "Goa (30)",
    status: "open",
    item: { itemName: "MRT-113-24-G1", account: "Sales", description: "Gauge Manufacturing & Inspection", hsnSac: "90173021", quantity: 1, rate: 3380, discount: 0, taxRate: 0 },
    shippingCharges: 0,
    adjustment: 0,
    subtotal: 3380,
    total: 3380,
    creditsRemaining: 3380,
    totalInWords: "Indian Rupee Three Thousand Three Hundred Eighty Only",
    notes: "1. Clarification will be made on the post quality check mutually.",
    terms: "1. As per the debit note, credit note raised for the correction of the product.\n2. Quality check will be made as on F2F on the dated supply, post confirmation by mutual understanding.\n3. Price mentioned are excluding Taxes.",
    taxMode: "tds",
  },
];

const normalize = (entry: Partial<CreditNoteEntry>): CreditNoteEntry => {
  const item: CreditItem = {
    itemName: entry.item?.itemName || "",
    account: entry.item?.account || "Sales",
    description: entry.item?.description || "",
    hsnSac: entry.item?.hsnSac || "",
    quantity: toNumber(entry.item?.quantity, 1),
    rate: toNumber(entry.item?.rate, 0),
    discount: toNumber(entry.item?.discount, 0),
    taxRate: toNumber(entry.item?.taxRate, 0),
  };
  const shippingCharges = toNumber(entry.shippingCharges, 0);
  const adjustment = toNumber(entry.adjustment, 0);
  const computed = computeTotals(item, shippingCharges, adjustment);
  return {
    ...defaultNotes[0],
    ...entry,
    item,
    shippingCharges,
    adjustment,
    subtotal: toNumber(entry.subtotal, computed.subtotal),
    total: toNumber(entry.total, computed.total),
    creditsRemaining: toNumber(entry.creditsRemaining, computed.creditsRemaining),
    totalInWords: entry.totalInWords || computed.totalInWords,
    status: entry.status === "open" ? "open" : "draft",
    taxMode: entry.taxMode === "tcs" ? "tcs" : "tds",
  };
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
}

const STATUS_STYLES: Record<CreditStatus, string> = {
  open: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
};

// ── Credit Note Document (light-color HTML preview) ────────────────────────────
function CreditNoteDocument({
  note,
  companyLogoUrl,
}: {
  note: CreditNoteEntry;
  companyLogoUrl?: string;
}) {
  return (
    <div className="relative mx-auto bg-white border border-blue-100 rounded-xl p-6 text-gray-800 text-[12px]">
      {/* Draft watermark */}
      {note.status === "draft" && (
        <div className="pointer-events-none absolute right-5 top-5 rotate-12 border-2 border-yellow-400 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase opacity-60">
          Draft
        </div>
      )}

      {/* Header: logo + company left, CREDIT NOTE + number right */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-blue-100">
        <div className="flex items-start gap-3">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="Logo" className="h-12 w-12 object-contain rounded-lg border border-gray-100" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-lg font-extrabold">N</span>
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900 text-[13px]">Nido Technologies</p>
            <p className="text-gray-500 text-[11px] leading-5">
              No. 41/1, 2nd Floor, 10th Cross,<br />
              11th Main, Wilsongarden,<br />
              Bangalore Karnataka 560027, India<br />
              GSTIN 29BPAPP1867G1ZN
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[18px] font-bold text-blue-700 tracking-tight">Credit Note</p>
          <p className="text-[11px] font-semibold text-gray-700 mt-1">#{note.creditNoteNumber}</p>
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Credits Remaining</p>
            <p className="text-[15px] font-bold text-blue-700 tabular-nums">₹{fmt(note.creditsRemaining)}</p>
          </div>
        </div>
      </div>

      {/* Bill To + Dates row */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">Bill To</p>
          <p className="font-bold text-blue-600 text-[12px]">{note.customerName}</p>
          <p className="whitespace-pre-wrap text-gray-600 mt-1 text-[11px] leading-5">{note.customerAddress}</p>
          {note.customerGstin && <p className="text-gray-500 mt-1 text-[11px]">GSTIN {note.customerGstin}</p>}
          {note.placeOfSupply && <p className="text-gray-500 mt-0.5 text-[11px]">Place of Supply: {note.placeOfSupply}</p>}
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Credit Date</span>
            <span className="text-gray-800">{fmtDate(note.issueDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Reference #</span>
            <span className="text-gray-800">{note.referenceNumber || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Invoice #</span>
            <span className="text-gray-800">{note.invoiceNumber || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Invoice Date</span>
            <span className="text-gray-800">{fmtDate(note.invoiceDate) || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Reason</span>
            <span className="text-gray-800">{note.reason}</span>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="mt-4 rounded-xl border border-blue-100 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2 text-left font-semibold w-6">#</th>
              <th className="px-3 py-2 text-left font-semibold">Item & Description</th>
              <th className="px-3 py-2 text-center font-semibold">HSN/SAC</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-blue-50">
              <td className="px-3 py-3 text-gray-500">1</td>
              <td className="px-3 py-3">
                <p className="font-semibold text-gray-800">{note.item.itemName}</p>
                {note.item.description && (
                  <p className="text-gray-500 text-[10px] mt-0.5">{note.item.description}</p>
                )}
              </td>
              <td className="px-3 py-3 text-center text-gray-600">{note.item.hsnSac || "—"}</td>
              <td className="px-3 py-3 text-right text-gray-700">{note.item.quantity.toFixed(2)}</td>
              <td className="px-3 py-3 text-right text-gray-700">{note.item.rate.toFixed(2)}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-800">{note.subtotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-3 flex justify-end">
        <div className="w-60 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-gray-600">
            <span>Sub Total</span>
            <span className="tabular-nums">{note.subtotal.toFixed(2)}</span>
          </div>
          {note.shippingCharges > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Shipping Charges</span>
              <span className="tabular-nums">{note.shippingCharges.toFixed(2)}</span>
            </div>
          )}
          {note.adjustment !== 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Adjustment</span>
              <span className="tabular-nums">{note.adjustment.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
            <span>Total</span>
            <span className="text-blue-700 tabular-nums">₹{fmt(note.total)}</span>
          </div>
          <div className="flex justify-between font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
            <span>Credits Remaining</span>
            <span className="tabular-nums">₹{fmt(note.creditsRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Total in Words */}
      <div className="mt-3 text-[11px] text-right">
        <span className="text-gray-500">Total In Words: </span>
        <span className="italic font-semibold text-gray-700">{note.totalInWords}</span>
      </div>

      {/* Notes & Terms */}
      {note.notes && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1">Notes</p>
          <p className="whitespace-pre-wrap text-gray-700 text-[11px] leading-5">{note.notes}</p>
        </div>
      )}
      {note.terms && (
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Terms & Conditions</p>
          <p className="whitespace-pre-wrap text-gray-600 text-[11px] leading-5">{note.terms}</p>
        </div>
      )}

      {/* Signature */}
      <div className="mt-5 text-[11px] text-gray-600">
        <div className="inline-block w-48 border-b border-gray-400 mb-1" />
        <p>Authorized Signature</p>
      </div>
    </div>
  );
}

// ── Credit Note Preview Drawer ────────────────────────────────────────────────
function CreditNotePreviewDrawer({
  note,
  companyLogoUrl,
  onClose,
  onEdit,
  onDownload,
  onConvertToOpen,
  onSendEmail,
  downloading,
}: {
  note: CreditNoteEntry;
  companyLogoUrl?: string;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onConvertToOpen: () => void;
  onSendEmail: () => void;
  downloading: boolean;
}) {
  const [tab, setTab] = useState<"document" | "details">("document");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl border-l border-gray-200">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{note.creditNoteNumber}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{note.customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                {downloading ? "Generating…" : "Download PDF"}
              </button>
              <button
                onClick={onSendEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Mail size={12} /> Email
              </button>
              <button
                onClick={() => toast.info("Refund flow available")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ReceiptIndianRupee size={12} /> Refund
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {note.status === "draft" && (
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={onConvertToOpen}>
                      Convert to Open
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => toast.info("Credit note archived")}>
                    <Archive size={13} /> Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => toast.info("Activity log coming soon")}>
                    <MessageSquare size={13} /> Activity
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 mt-3 border border-gray-200 rounded-lg bg-gray-50 p-1 w-fit">
            {(["document", "details"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  tab === t
                    ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "document" ? "Document Preview" : "Details"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* What's Next banner — always visible */}
          {note.status === "draft" && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">WHAT'S NEXT?</p>
              <p className="text-sm text-blue-600 mb-3">
                Email this credit note to your customer or convert it to open.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onSendEmail}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Credit Note
                </button>
                <button
                  onClick={onConvertToOpen}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-300 bg-white rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Convert to Open
                </button>
              </div>
            </div>
          )}

          {/* ── Document Preview tab ── */}
          {tab === "document" && (
            <CreditNoteDocument note={note} companyLogoUrl={companyLogoUrl} />
          )}

          {/* ── Details tab ── */}
          {tab === "details" && (
            <>
              {/* Credits Remaining hero */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">Credits Remaining</p>
                  <p className="text-3xl font-bold text-blue-700 tabular-nums">₹{fmt(note.creditsRemaining)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLES[note.status]}`}>
                  {note.status}
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Calendar, label: "Credit Date", value: fmtDate(note.issueDate) },
                  { icon: Hash, label: "Credit Note #", value: note.creditNoteNumber },
                  { icon: Hash, label: "Reference #", value: note.referenceNumber || "—" },
                  { icon: FileText, label: "Invoice #", value: note.invoiceNumber || "—" },
                  { icon: Calendar, label: "Invoice Date", value: fmtDate(note.invoiceDate) },
                  { icon: Tag, label: "Reason", value: note.reason },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} className="text-gray-400" />
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bill To */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <User size={11} className="text-gray-400" />
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Bill To</p>
                </div>
                <p className="text-sm font-semibold text-blue-600">{note.customerName}</p>
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{note.customerAddress}</p>
                {note.customerGstin && <p className="text-xs text-gray-500 mt-1">GSTIN: {note.customerGstin}</p>}
                {note.placeOfSupply && <p className="text-xs text-gray-500 mt-0.5">Place of Supply: {note.placeOfSupply}</p>}
              </div>

              {/* Item table */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Items</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-blue-50/50">
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{note.item.itemName}</p>
                        {note.item.description && <p className="text-xs text-gray-500 mt-0.5">{note.item.description}</p>}
                        {note.item.hsnSac && <p className="text-xs text-gray-400 mt-0.5">HSN/SAC: {note.item.hsnSac}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{note.item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{fmt(note.item.rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{fmt(note.subtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals summary */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Summary</p>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-600">Sub Total</span>
                    <span className="text-sm font-semibold text-gray-800 tabular-nums">₹{fmt(note.subtotal)}</span>
                  </div>
                  {note.shippingCharges > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-gray-600">Shipping Charges</span>
                      <span className="text-sm font-semibold text-gray-800 tabular-nums">₹{fmt(note.shippingCharges)}</span>
                    </div>
                  )}
                  {note.adjustment !== 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-gray-600">Adjustment</span>
                      <span className="text-sm font-semibold text-gray-800 tabular-nums">₹{fmt(note.adjustment)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 bg-blue-50/60">
                    <span className="text-sm font-bold text-gray-800">Total</span>
                    <span className="text-base font-bold text-blue-700 tabular-nums">₹{fmt(note.total)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/40">
                    <span className="text-sm font-semibold text-blue-700">Credits Remaining</span>
                    <span className="text-sm font-bold text-blue-700 tabular-nums">₹{fmt(note.creditsRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Total in Words */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Total in Words</p>
                <p className="text-sm text-gray-700 italic">{note.totalInWords}</p>
              </div>

              {/* Notes */}
              {note.notes && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.notes}</p>
                </div>
              )}

              {/* Terms */}
              {note.terms && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Terms & Conditions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.terms}</p>
                </div>
              )}

              {/* More info */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">More Information</p>
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Associated Invoice: </span>{note.invoiceNumber || "—"}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-medium text-gray-700">Tax Mode: </span>{note.taxMode.toUpperCase()}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-400 text-center">
            Credit Note · {note.creditNoteNumber} · {fmtDate(note.issueDate)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreditNotesPage() {
  const navigate = useNavigate();
  const organization = loadConfig().organization;

  const [notes, setNotes] = useState<CreditNoteEntry[]>(() => {
    const stored = safeReadJson<CreditNoteEntry[]>(STORAGE_KEY, defaultNotes);
    const list = Array.isArray(stored) && stored.length ? stored : defaultNotes;
    return list.map((e) => normalize(e));
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CreditStatus>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<CreditNoteEntry | null>(null);

  const companyLogoUrl = organization.logoUrl;

  const persist = (next: CreditNoteEntry[]) => {
    setNotes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const convertToOpen = (note: CreditNoteEntry) => {
    const updated = notes.map((e) => e.id === note.id ? { ...e, status: "open" as CreditStatus } : e);
    persist(updated);
    // update preview note too so the "What's Next" banner disappears
    if (previewNote?.id === note.id) {
      setPreviewNote((prev) => prev ? { ...prev, status: "open" } : prev);
    }
    toast.success("Credit note converted to open");
  };

  const handleDownload = async (note: CreditNoteEntry) => {
    setDownloadingId(note.id);
    try {
      await downloadCreditNotePdf(note, `${note.creditNoteNumber}.pdf`);
      toast.success(`${note.creditNoteNumber}.pdf downloaded`);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendEmail = (note: CreditNoteEntry) => {
    toast.success(`Email queued for ${note.creditNoteNumber}`);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter((n) => {
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      if (q) return (
        n.creditNoteNumber.toLowerCase().includes(q) ||
        n.customerName.toLowerCase().includes(q) ||
        n.referenceNumber.toLowerCase().includes(q) ||
        n.invoiceNumber.toLowerCase().includes(q)
      );
      return true;
    });
  }, [notes, search, statusFilter]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalCredits = notes.reduce((s, n) => s + n.creditsRemaining, 0);
  const draftCount = notes.filter((n) => n.status === "draft").length;
  const openCount = notes.filter((n) => n.status === "open").length;
  const totalAmount = notes.reduce((s, n) => s + n.total, 0);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Header ── */}
      <div className="border-b border-gray-200/70">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Sales › Credit Notes</p>
            <h1 className="text-xl font-bold text-gray-900">Credit Notes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create, manage and track customer credit notes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              onClick={() => toast.info("Export coming soon")}
            >
              <Download size={15} /> Export
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              onClick={() => navigate("/sales/credit-notes/create")}
            >
              <Plus size={15} /> New Credit Note
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Credits", value: `₹${fmt(totalCredits)}`, color: "text-blue-700" },
            { label: "Total Credit Notes", value: String(notes.length), color: "text-gray-900" },
            { label: "Draft", value: String(draftCount), color: "text-yellow-600" },
            { label: "Open", value: String(openCount), color: "text-green-600" },
            { label: "Credit Value", value: `₹${fmt(totalAmount)}`, color: "text-gray-900" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="px-6 py-5">

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search credit notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-gray-50 p-1">
            {(["all", "draft", "open"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-white text-blue-700 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${s === "draft" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                    {s === "draft" ? draftCount : openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors ml-auto">
            <Filter size={14} /> Filter
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/70">
                {["Date", "Credit Note #", "Reference #", "Customer", "Invoice #", "Status", "Amount", ""].map((h, i) => (
                  <th
                    key={h + i}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-500 ${
                      i === 6 ? "text-right" : i === 7 ? "text-center" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-sm text-gray-400">
                    No credit notes found.{" "}
                    <button
                      onClick={() => navigate("/sales/credit-notes/create")}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      + Create one
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((note) => {
                  const isActive = previewNote?.id === note.id;
                  const isLoading = downloadingId === note.id;
                  return (
                    <tr
                      key={note.id}
                      onClick={() => setPreviewNote(isActive ? null : note)}
                      className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                        isActive ? "bg-blue-50/60" : "hover:bg-gray-50/60"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600">{fmtDate(note.issueDate)}</td>
                      <td className="px-4 py-3 font-medium text-blue-600">{note.creditNoteNumber}</td>
                      <td className="px-4 py-3 text-gray-500">{note.referenceNumber}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{note.customerName}</td>
                      <td className="px-4 py-3 text-gray-500">{note.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[note.status]}`}>
                          {note.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        ₹{fmt(note.total)}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={isLoading}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                            >
                              {isLoading ? (
                                <span className="block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                              ) : (
                                <MoreHorizontal size={16} />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => navigate(`/sales/credit-notes/${note.id}/edit`)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => handleDownload(note)}
                            >
                              <Download size={14} /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => handleSendEmail(note)}
                            >
                              <Mail size={14} /> Send Email
                            </DropdownMenuItem>
                            {note.status === "draft" && (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onSelect={() => convertToOpen(note)}
                              >
                                Convert to Open
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => toast.info("Refund flow available")}
                            >
                              <ReceiptIndianRupee size={14} /> Refund
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Preview Drawer ── */}
      {previewNote && (
        <CreditNotePreviewDrawer
          note={previewNote}
          companyLogoUrl={companyLogoUrl}
          onClose={() => setPreviewNote(null)}
          onEdit={() => {
            setPreviewNote(null);
            navigate(`/sales/credit-notes/${previewNote.id}/edit`);
          }}
          onDownload={() => handleDownload(previewNote)}
          onConvertToOpen={() => convertToOpen(previewNote)}
          onSendEmail={() => handleSendEmail(previewNote)}
          downloading={downloadingId === previewNote.id}
        />
      )}
    </div>
  );
}
