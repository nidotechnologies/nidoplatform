import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Send,
  FileText,
  Edit,
  Paperclip,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getQuoteById, type StoredQuote } from "@/lib/quoteStore";
import { downloadReferenceQuotePdf } from "@/lib/referenceQuotePdf";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency, getCurrencySymbol } from "@/lib/formatters";

function statusBadge(status: StoredQuote["status"]) {
  const map: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600",
    "Sent to Client": "bg-blue-100 text-blue-700",
    Accepted: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function fmt(n: number) {
  return formatCurrency(n);
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function downloadDoc(doc: { name: string; data: string }) {
  const link = document.createElement("a");
  link.href = doc.data;
  link.download = doc.name;
  link.click();
}

export default function SalesQuoteDetailPage() {
  useI18n();
  const { currencySymbol } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("details");
  const [quote, setQuote] = useState<StoredQuote | null>(null);

  useEffect(() => {
    if (!id) return;
    const q = getQuoteById(id);
    setQuote(q || null);
  }, [id]);

  if (!quote) {
    return (
      <div className="space-y-6 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sales/quotes")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Quote not found
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          This quote may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate("/sales/quotes")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {quote.quoteNumber}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(quote.status)}`}
              >
                {quote.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Customer: {quote.clientName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total: {formatCurrency(quote.grandTotal)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <button
            onClick={() => navigate(`/sales/quotes/${quote.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Edit size={16} /> Edit
          </button>
          <button
            onClick={() => {
              void downloadReferenceQuotePdf(quote);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <FileText size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {["details", "documents"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 font-medium transition-colors capitalize ${
              activeTab === tab
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
            }`}
          >
            {tab === "documents"
              ? `Supporting Documents${quote.supportingDocs.length ? ` (${quote.supportingDocs.length})` : ""}`
              : "Quote Details"}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">
                CUSTOMER
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {quote.clientName}
              </p>
              {quote.contactPerson && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {quote.contactPerson}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">
                DOCUMENT WINDOW
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {quote.quoteDate}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Valid till {quote.validTill}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">
                LINE ITEMS
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {quote.lineItems.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatCurrency(quote.grandTotal)} total
              </p>
            </div>
          </div>

          {/* Email Recipients */}
          {quote.emails.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Email Recipients
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {quote.emails.map((e, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bill To / Ship To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">
                BILL TO
              </p>
              <p className="font-bold text-gray-900 dark:text-white mb-1">
                {quote.clientName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {quote.billingAddress}
              </p>
              {quote.clientGstin && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  GSTIN: {quote.clientGstin}
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">
                SHIP TO
              </p>
              <p className="font-bold text-gray-900 dark:text-white mb-1">
                {quote.clientName}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {quote.shippingAddress}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    {[
                      "Sl.No",
                      "ITEM / DESCRIPTION",
                      "HSN/SAC",
                      "QTY",
                      `RATE (${currencySymbol})`,
                      `DISC (${currencySymbol})`,
                      `TAXABLE (${currencySymbol})`,
                      "GST RATE",
                      `GST (${currencySymbol})`,
                      `AMOUNT (${currencySymbol})`,
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, idx) => {
                    const taxable = Math.max(
                      0,
                      item.qty * item.rate - item.discount,
                    );
                    const gst = taxable * (item.taxPercent / 100);
                    const amt = taxable + gst;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                          {item.hsnSac}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-center">
                          {item.qty}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">
                          {fmt(item.rate)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">
                          {fmt(item.discount)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">
                          {fmt(taxable)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-center">
                          {item.taxPercent}%
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">
                          {fmt(gst)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white text-right">
                          {fmt(amt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals — matches Create New Quote summary panel */}
          {(() => {
            const grossSubtotal = quote.lineItems.reduce(
              (s, i) => s + i.qty * i.rate,
              0,
            );
            const totalDiscount = quote.lineItems.reduce(
              (s, i) => s + i.discount,
              0,
            );
            const totalTaxableValue = quote.lineItems.reduce(
              (s, i) => s + Math.max(0, i.qty * i.rate - i.discount),
              0,
            );
            const totalGst = quote.totalTax;
            const shippingCharges = quote.shippingCharges ?? 0;
            const roundOff = quote.adjustment;
            const gstRateLabels = [
              ...new Set(quote.lineItems.map((i) => i.taxPercent)),
            ]
              .sort((a, b) => a - b)
              .map((r) => `${r}%`)
              .join(", ");
            return (
              <div className="flex justify-end">
                <div className="w-full sm:w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          Gross Subtotal
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                          {formatCurrency(grossSubtotal)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                          Item Level Discounts (-)
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                          − {formatCurrency(totalDiscount)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                          Total Taxable Value
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(totalTaxableValue)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          Total GST{gstRateLabels ? ` (${gstRateLabels})` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                          {formatCurrency(totalGst)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          Shipping &amp; Handling Charges
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                          {formatCurrency(shippingCharges)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                          Round Off Adjustment
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                          {roundOff >= 0 ? "" : "-"}
                          {formatCurrency(Math.abs(roundOff))}
                        </td>
                      </tr>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                          Total Payable
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(quote.grandTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Terms / Notes */}
          {(quote.termsConditions || quote.customerNotes) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {quote.termsConditions && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">
                    TERMS & CONDITIONS
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                    {quote.termsConditions}
                  </p>
                </div>
              )}
              {quote.customerNotes && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">
                    CUSTOMER NOTES
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                    {quote.customerNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-4">
          {quote.supportingDocs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Paperclip
                size={32}
                className="mx-auto text-gray-300 dark:text-gray-600 mb-3"
              />
              <p className="text-gray-500 dark:text-gray-400">
                No supporting documents attached to this quote.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                You can add documents when editing the quote.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
              {quote.supportingDocs.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Paperclip
                        size={18}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fmtSize(doc.size)} · {doc.type || "File"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadDoc(doc)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium flex-shrink-0 ml-4"
                  >
                    <Download size={15} /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
