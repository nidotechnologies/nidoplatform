import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreHorizontal, Plus, Archive, Pencil, Download, X, FileText,
  CreditCard, Calendar, Hash, Building2, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getActiveReceipts,
  getArchivedReceipts,
  archiveReceipt,
  downloadReceiptAttachment,
  formatAttachmentSize,
  type PaymentReceipt,
} from "@/lib/paymentReceiptStore";
import { downloadReceiptPdf } from "@/lib/paymentReceiptPdf";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";

function fmt(n: number) {
  return formatCurrency(n);
}

function fmtDate(v: string) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : v;
}

const STATUS_STYLES: Record<string, string> = {
  paid:  "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
};

// ── Receipt Preview Drawer ────────────────────────────────────────────────────
function ReceiptPreviewDrawer({
  receipt,
  onClose,
  onEdit,
  onDownload,
  downloading,
}: {
  receipt: PaymentReceipt;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* panel */}
      <div className="relative z-10 w-full max-w-xl bg-white h-full flex flex-col shadow-2xl border-l border-gray-200">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Receipt size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{receipt.paymentNumber}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{receipt.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={onDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              {downloading ? "…" : "PDF"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Amount hero */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">Amount Received</p>
              <p className="text-3xl font-bold text-blue-700 tabular-nums">{fmt(receipt.amountReceived)}</p>
              {Number(receipt.bankCharges ?? 0) > 0 && (
                <p className="text-xs text-blue-400 mt-1">+ {fmt(Number(receipt.bankCharges))} bank charges</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLES[receipt.status] ?? "bg-gray-100 text-gray-600"}`}>
              {receipt.status}
            </span>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Calendar, label: "Payment Date", value: fmtDate(receipt.paymentDate) },
              { icon: CreditCard, label: "Payment Mode", value: receipt.paymentMode || "—" },
              { icon: Hash, label: "Payment #", value: receipt.paymentNumber },
              { icon: FileText, label: "Invoice Ref", value: receipt.invoiceNumber || "—" },
              { icon: Building2, label: "Deposit To", value: receipt.depositTo || "—" },
              { icon: Hash, label: "Reference / Txn ID", value: receipt.reference || "—" },
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

          {/* Supply details */}
          {(receipt.placeOfSupply || receipt.descriptionOfSupply) && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Supply Details</p>
              {receipt.placeOfSupply && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Place: </span>{receipt.placeOfSupply}
                </p>
              )}
              {receipt.descriptionOfSupply && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">Description: </span>{receipt.descriptionOfSupply}
                </p>
              )}
            </div>
          )}

          {/* Tax */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Tax Deducted</p>
            <p className="text-sm font-semibold text-gray-800">
              {receipt.taxDeducted === "tds" ? "Yes — TDS (Income Tax)" : "No Tax Deducted"}
            </p>
          </div>

          {/* Notes */}
          {receipt.note && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{receipt.note}</p>
            </div>
          )}

          {/* Attachments */}
          {receipt.attachments && receipt.attachments.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Attachments ({receipt.attachments.length})
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {receipt.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={14} className="shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-700">{attachment.name}</p>
                        <p className="text-xs text-gray-400">{formatAttachmentSize(attachment.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadReceiptAttachment(attachment)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals summary */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Summary</p>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-600">Amount Received</span>
                <span className="text-sm font-semibold text-gray-800 tabular-nums">{fmt(receipt.amountReceived)}</span>
              </div>
              {Number(receipt.bankCharges ?? 0) > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-600">Bank Charges</span>
                  <span className="text-sm font-semibold text-gray-800 tabular-nums">{fmt(Number(receipt.bankCharges))}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50/60">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-base font-bold text-blue-700 tabular-nums">
                  {fmt(receipt.amountReceived + Number(receipt.bankCharges ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-400 text-center">
            Receipt created · {fmtDate(receipt.paymentDate)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Archived slide-over ───────────────────────────────────────────────────────
function ArchivedDrawer({ onClose }: { onClose: () => void }) {
  const archived = getArchivedReceipts();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl border-l border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <Archive size={18} className="text-gray-500" />
            <div>
              <h2 className="text-base font-bold text-gray-900">Archived Receipts</h2>
              <p className="text-xs text-gray-500 mt-0.5">Read-only view · {archived.length} record{archived.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {archived.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Archive size={40} strokeWidth={1.5} />
              <p className="text-sm">No archived receipts yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {["Date", "Payment #", "Customer", "Invoice #", "Mode", "Amount"].map((h, i) => (
                      <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 ${i === 5 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {archived.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-4 py-3 text-gray-500">{r.paymentDate}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{r.paymentNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{r.customerName}</td>
                      <td className="px-4 py-3 text-gray-500">{r.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{r.paymentMode}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums">{fmt(r.amountReceived)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-400 text-center">Archived receipts are read-only and cannot be edited.</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PaymentReceiptsPage() {
  useI18n();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<PaymentReceipt | null>(null);

  useEffect(() => {
    setReceipts(getActiveReceipts());
  }, []);

  const totalPaid = receipts
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amountReceived, 0);

  const handleArchive = (id: string) => {
    archiveReceipt(id);
    setReceipts(getActiveReceipts());
    if (previewReceipt?.id === id) setPreviewReceipt(null);
    toast.success("Receipt archived");
  };

  const handleDownload = async (r: PaymentReceipt) => {
    setDownloadingId(r.id);
    try {
      await downloadReceiptPdf(r, `${r.paymentNumber}.pdf`);
      toast.success(`${r.paymentNumber}.pdf downloaded`);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="border-b border-gray-200/70">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payment Receipts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Capture payment receipts and maintain a stable customer payment trail.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={() => navigate("/sales/payment-receipts/create")}
              >
                <Plus size={14} /> New Receipt
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={() => setShowArchived(true)}
              >
                <Archive size={14} /> Archived
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm text-gray-500">
          Total Paid:{" "}
          <span className="text-lg font-bold text-gray-900">{fmt(totalPaid)}</span>
        </p>
      </div>

      {/* ── Table ── */}
      <div className="px-6 py-6">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Date", "Payment #", "Customer", "Invoice #", "Mode", "Status", "Amount", "Actions"].map((h, i) => (
                  <th
                    key={h}
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
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-sm text-gray-400">
                    No payment records found.{" "}
                    <button
                      onClick={() => navigate("/sales/payment-receipts/create")}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      + Create one
                    </button>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => {
                  const isLoading = downloadingId === r.id;
                  const isActive = previewReceipt?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setPreviewReceipt(isActive ? null : r)}
                      className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                        isActive ? "bg-blue-50/60" : "hover:bg-gray-50/60"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600">{r.paymentDate}</td>
                      <td className="px-4 py-3 font-medium text-blue-600">{r.paymentNumber}</td>
                      <td className="px-4 py-3 text-gray-700">{r.customerName}</td>
                      <td className="px-4 py-3 text-gray-500">{r.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{r.paymentMode}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        {fmt(r.amountReceived)}
                      </td>
                      {/* Actions — stop row-click propagation */}
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
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => navigate(`/sales/payment-receipts/${r.id}`)}
                            >
                              <Pencil size={14} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onSelect={() => handleDownload(r)}
                            >
                              <Download size={14} /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                              onSelect={() => handleArchive(r.id)}
                            >
                              <Archive size={14} /> Archive
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

      {/* Receipt Preview drawer */}
      {previewReceipt && (
        <ReceiptPreviewDrawer
          receipt={previewReceipt}
          onClose={() => setPreviewReceipt(null)}
          onEdit={() => {
            setPreviewReceipt(null);
            navigate(`/sales/payment-receipts/${previewReceipt.id}`);
          }}
          onDownload={() => handleDownload(previewReceipt)}
          downloading={downloadingId === previewReceipt.id}
        />
      )}

      {/* Archived slide-over */}
      {showArchived && <ArchivedDrawer onClose={() => setShowArchived(false)} />}
    </div>
  );
}
