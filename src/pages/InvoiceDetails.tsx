import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Edit, MoreVertical, Receipt, Send, ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  convertProformaToInvoice,
  getInvoiceById,
  isProformaInvoiceEligible,
  saveInvoice,
  type StoredInvoice,
} from '@/lib/invoiceStore';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { sendInvoiceEmail } from '@/lib/invoiceEmailService';
import { getActiveReceipts, type PaymentReceipt } from '@/lib/paymentReceiptStore';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/formatters';
import { getAvailabilityLabel } from '@/lib/productCommercialTerms';
import { DIGITAL_PRODUCT_HEADERS, getDocumentProductPresentation, isDigitalDocumentProduct } from '@/lib/productDocumentRules';
import { toast } from 'sonner';

function fmt(value: number) {
  return formatCurrency(value);
}

const statusStyles: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  'Proforma Invoice': 'bg-purple-100 text-purple-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500',
};

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-2">{label}</p>
      {children}
    </div>
  );
}

function isProformaInvoice(invoice: StoredInvoice) {
  return invoice.status === 'Proforma Invoice';
}

function invoiceStatusLabel(invoice: StoredInvoice) {
  if (invoice.status === 'Proforma Invoice' && invoice.sentAt) return 'Sent Proforma Invoice';
  if (invoice.status === 'Sent') return 'Sent Invoice';
  return invoice.status;
}

export default function InvoiceDetails() {
  const { currencySymbol } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<StoredInvoice | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'payments' | 'activity'>('overview');
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [sending, setSending] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const storedInvoice = getInvoiceById(id);
    if (
      storedInvoice?.status === 'Proforma Invoice'
      && !isProformaInvoiceEligible(storedInvoice)
    ) {
      toast.error('This proforma invoice is not available because it contains non-physical products.');
      navigate('/sales/invoices');
      return;
    }
    setInvoice(storedInvoice || null);
  }, [id, navigate]);

  useEffect(() => {
    if (!invoice) return;
    const refresh = () => {
      setPaymentReceipts(
        getActiveReceipts().filter((receipt) => receipt.invoiceNumber === invoice.invoiceNumber),
      );
    };
    refresh();
    window.addEventListener('nidoPaymentReceiptsUpdated', refresh);
    return () => window.removeEventListener('nidoPaymentReceiptsUpdated', refresh);
  }, [invoice?.invoiceNumber]);

  if (!invoice) return (
    <div className="space-y-6">
      <button onClick={() => navigate('/sales/invoices')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={16} /> Back to Invoices
      </button>
      <h1 className="text-xl font-bold text-gray-900">Invoice not found</h1>
    </div>
  );

  const tabs = [
    ['overview', 'Overview'],
    ['items', `Line Items (${invoice.lineItems.length})`],
    ...(!isProformaInvoice(invoice) ? [['payments', `Payments (${invoice.payments.length + paymentReceipts.length})`]] : []),
    ['activity', 'Activity'],
  ] as ['overview' | 'items' | 'payments' | 'activity', string][];

  const physicalLineItems = invoice.lineItems.filter((item) => !isDigitalDocumentProduct(item));
  const digitalLineItems = invoice.lineItems.filter((item) => isDigitalDocumentProduct(item));
  const renderLineItemsTable = (items: StoredInvoice['lineItems'], digital: boolean) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {(digital
                ? ['#', 'ITEM / DESCRIPTION', 'HSN/SAC', DIGITAL_PRODUCT_HEADERS.quantity, DIGITAL_PRODUCT_HEADERS.tenure, DIGITAL_PRODUCT_HEADERS.provisioning, `TAXABLE (${currencySymbol})`, 'GST RATE', `GST (${currencySymbol})`, `AMOUNT (${currencySymbol})`]
                : ['#', 'ITEM / DESCRIPTION', 'HSN/SAC', 'QTY', `RATE (${currencySymbol})`, `DISC (${currencySymbol})`, `TAXABLE (${currencySymbol})`, 'GST RATE', `GST (${currencySymbol})`, `AMOUNT (${currencySymbol})`]
              ).map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const disc = item.discount ?? 0;
              const taxable = Math.max(0, item.quantity * item.rate - disc);
              const tax = taxable * (item.taxPercent / 100);
              const presentation = getDocumentProductPresentation(item, { quantity: item.quantity });
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-3 text-gray-400 text-center">{index + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-gray-900">{item.description}</p>
                    {item.subOrderId && <p className="text-xs font-medium text-blue-700 mt-0.5">Sub Order ID: {item.subOrderId}</p>}
                    {item.itemDetails && <p className="text-xs text-gray-500 mt-0.5">{item.itemDetails}</p>}
                    {item.commercialTerms && (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500 leading-tight">
                        <span>Pricing Model: <strong className="text-gray-700">{item.commercialTerms.pricingModel}</strong></span>
                        <span>{digital ? `${DIGITAL_PRODUCT_HEADERS.tenure}:` : 'MOQ / Min Qty:'} <strong className="text-gray-700">{digital ? presentation.tenureBilling : item.commercialTerms.moqLabel}</strong></span>
                        <span>{digital ? `${DIGITAL_PRODUCT_HEADERS.provisioning}:` : 'Lead Time / SLA:'} <strong className="text-gray-700">{digital ? presentation.provisioningTime : `${item.commercialTerms.leadTimePrimary}${item.commercialTerms.leadTimeSecondary ? ` · ${item.commercialTerms.leadTimeSecondary}` : ""}`}</strong></span>
                        <span>Availability: <strong className={item.commercialTerms.availabilityStatus === "Out of Stock" ? "text-red-600" : "text-emerald-600"}>{getAvailabilityLabel(item.commercialTerms)}</strong></span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-600">{item.hsnSac || '—'}</td>
                  <td className="px-3 py-3 text-center">{item.quantity}</td>
                  {digital ? (
                    <>
                      <td className="px-3 py-3 text-center text-gray-600">{presentation.tenureBilling}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{presentation.provisioningTime}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-right">{fmt(item.rate)}</td>
                      <td className="px-3 py-3 text-right text-gray-500">{fmt(disc)}</td>
                    </>
                  )}
                  <td className="px-3 py-3 text-right">{fmt(taxable)}</td>
                  <td className="px-3 py-3 text-center"><span className="text-gray-900">{item.taxPercent}%</span>{item.taxType && <span className="block text-xs text-gray-400">{item.taxType}</span>}</td>
                  <td className="px-3 py-3 text-right">{fmt(tax)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmt(taxable + tax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const markSentAndEmail = async () => {
    if (sending) return;
    setSending(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const result = await sendInvoiceEmail(invoice, 'invoice');
      if (result.sentCount === 0) {
        toast.error(result.error || 'The invoice could not be sent.');
        return;
      }
      const documentLabel = isProformaInvoice(invoice) ? 'Proforma invoice' : 'Invoice';

      const updated: StoredInvoice = {
        ...invoice,
        status: isProformaInvoice(invoice) ? 'Proforma Invoice' : 'Sent',
        sentAt: new Date().toISOString(),
        activity: [
          ...invoice.activity,
          {
            id: `${Date.now()}-activity`,
            date: today,
            title: `${documentLabel} sent`,
            description: `${documentLabel} emailed to ${result.recipients.join(', ')}.`,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      saveInvoice(updated);
      setInvoice(updated);
      const partial = result.sentCount < result.recipients.length;
      (partial ? toast.warning : toast.success)(
        `${documentLabel} sent to ${result.recipients.join(', ')}${partial ? ` (${result.sentCount}/${result.recipients.length} accepted)` : ''}.`,
      );
    } catch {
      toast.error('The invoice was not emailed. Check the email service and try again.');
    } finally {
      setSending(false);
    }
  };

  const sendReminder = async () => {
    if (sending || invoice.status !== 'Sent') {
      if (invoice.status !== 'Sent') {
        toast.error('Reminders can only be sent for sent invoices.');
      }
      return;
    }
    setSending(true);
    const result = await sendInvoiceEmail(invoice, 'reminder');
    if (result.sentCount === 0) {
      toast.error(result.error || 'The reminder could not be sent.');
      setSending(false);
      return;
    }
    const documentLabel = isProformaInvoice(invoice) ? 'Proforma invoice' : 'Invoice';
    const today = new Date().toISOString().split('T')[0];
    const updated = {
      ...invoice,
      lastReminderAt: new Date().toISOString(),
      activity: [
        ...invoice.activity,
        {
          id: `${Date.now()}-activity`,
          date: today,
          title: `${documentLabel} reminder sent`,
          description: `Reminder emailed to ${result.recipients.join(', ')}.`,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    saveInvoice(updated);
    setInvoice(updated);
    toast.success(`Reminder mail sent to ${result.recipients.join(', ')}.`);
    setSending(false);
  };

  const closeActions = () => setActionsOpen(false);
  const handleConvertToInvoice = () => {
    const converted = convertProformaToInvoice(invoice.id);
    closeActions();
    if (converted) navigate(`/sales/invoices/${converted.id}`);
  };

  const grossSubtotal = invoice.grossSubtotal ?? invoice.subtotal;
  const totalDiscount = invoice.totalDiscount ?? 0;
  const shippingCharges = invoice.shippingCharges ?? 0;
  const adjustment = invoice.adjustment ?? 0;

  return (
    <div className="space-y-5 pb-6">
      {/* Header card */}
      <div className="flex items-start justify-between gap-3 bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/sales/invoices')} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
               <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[invoice.status]}`}>{invoiceStatusLabel(invoice)}</span>
            </div>
            <p className="text-sm text-gray-600">Customer: <span className="font-medium text-gray-900">{invoice.clientName}</span></p>
            {invoice.poReference && <p className="text-sm text-gray-500">PO Reference: {invoice.poReference}</p>}
            <p className="text-sm text-gray-600 mt-0.5">Total: <span className="font-semibold text-gray-900">{fmt(invoice.grandTotal)}</span></p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setActionsOpen((open) => !open)}
            aria-label="Invoice actions"
            aria-expanded={actionsOpen}
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <MoreVertical size={20} />
          </button>
          {actionsOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => { closeActions(); navigate(`/sales/invoices/${invoice.id}/edit`); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit size={15} /> Edit
              </button>
              <button
                type="button"
                onClick={() => { closeActions(); downloadInvoicePdf(invoice); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download size={15} /> Download PDF
              </button>
               <button
                type="button"
                onClick={() => { closeActions(); markSentAndEmail(); }}
                disabled={sending}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={15} /> {sending ? 'Sending…' : invoice.status === 'Proforma Invoice' ? 'Send Proforma Invoice' : 'Send Invoice'}
              </button>
               {invoice.status === 'Sent' && (
                 <button
                   type="button"
                   onClick={() => { closeActions(); sendReminder(); }}
                   disabled={sending}
                   className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                 >
                   <Send size={15} /> Send Reminder
                 </button>
               )}
              {invoice.status === 'Proforma Invoice' && (
                <button
                  type="button"
                  onClick={handleConvertToInvoice}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-blue-700 hover:bg-blue-50"
                >
                  <ArrowRight size={15} /> Convert to Invoice
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-5 border-b border-gray-200 overflow-x-auto">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`pb-3 px-1 font-medium text-sm whitespace-nowrap ${activeTab === value ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoCard label="Customer">
              <p className="text-base font-bold text-gray-900 leading-tight">{invoice.clientName}</p>
              {invoice.contactPerson && <p className="text-sm text-gray-500 mt-1">{invoice.contactPerson}</p>}
            </InfoCard>
            <InfoCard label="Invoice Window">
              <p className="text-base font-bold text-gray-900">{invoice.invoiceDate}</p>
              <p className="text-sm text-gray-500 mt-1">Due {invoice.dueDate}</p>
            </InfoCard>
            <InfoCard label="Amount">
              <p className="text-base font-bold text-gray-900">{fmt(invoice.grandTotal)}</p>
              <p className="text-sm text-gray-500 mt-1">{invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? 's' : ''}</p>
            </InfoCard>
            <InfoCard label="References">
              {invoice.poReference && <p className="text-sm font-medium text-gray-900">PO: {invoice.poReference}</p>}
              {invoice.placeOfSupply && <p className="text-sm text-gray-500 mt-1">{invoice.placeOfSupply}</p>}
              {!invoice.poReference && !invoice.placeOfSupply && <p className="text-sm text-gray-400">—</p>}
            </InfoCard>
          </div>

          {/* Bill To / Ship To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">BILLED TO</p>
              <p className="font-bold text-gray-900 mb-1">{invoice.clientName}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.billingAddress || 'No billing address'}</p>
              {invoice.clientGstin && <p className="text-sm text-gray-600 mt-1">GSTIN: <span className="font-medium">{invoice.clientGstin}</span></p>}
              {invoice.clientContact && <p className="text-sm text-gray-600 mt-0.5">Contact: {invoice.clientContact}</p>}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">SHIPPED TO</p>
              <p className="font-bold text-gray-900 mb-1">{invoice.clientName}</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.shippingAddress || invoice.billingAddress || 'No shipping address'}</p>
              {invoice.shippingStateCode && <p className="text-sm text-gray-600 mt-1">State Code: {invoice.shippingStateCode}</p>}
              {invoice.shippingAttn && <p className="text-sm text-gray-600 mt-0.5">Attn: {invoice.shippingAttn}</p>}
            </div>
          </div>

          {/* Terms & Bank side by side */}
          {(invoice.termsConditions || invoice.bankName || invoice.bankAccountNo) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {invoice.termsConditions && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">TERMS & CONDITIONS</p>
                  <ol className="space-y-1">
                    {invoice.termsConditions.split('\n').filter(Boolean).map((term, i) => (
                      <li key={i} className="text-sm text-gray-600">{i + 1}. {term}</li>
                    ))}
                  </ol>
                </div>
              )}
              {(invoice.bankName || invoice.bankAccountNo) && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">BANK REMITTANCE DETAILS</p>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    {invoice.bankName && <p><span className="font-medium text-gray-700">Bank:</span> {invoice.bankName}</p>}
                    {invoice.bankAccountName && <p><span className="font-medium text-gray-700">Account Name:</span> {invoice.bankAccountName}</p>}
                    {invoice.bankAccountNo && <p><span className="font-medium text-gray-700">Account No:</span> {invoice.bankAccountNo}</p>}
                    {invoice.bankIfsc && <p><span className="font-medium text-gray-700">IFSC:</span> {invoice.bankIfsc}</p>}
                    {invoice.bankBranch && <p><span className="font-medium text-gray-700">Branch:</span> {invoice.bankBranch}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {invoice.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-xs uppercase text-gray-400 tracking-wide font-semibold mb-3">NOTES</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Line Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {physicalLineItems.length > 0 && renderLineItemsTable(physicalLineItems, false)}
            {digitalLineItems.length > 0 && (
              <div className={physicalLineItems.length > 0 ? "border-t border-gray-200" : ""}>
                {renderLineItemsTable(digitalLineItems, true)}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-96 bg-white rounded-lg border border-gray-200 overflow-hidden text-sm">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500">Gross Subtotal</td>
                    <td className="px-4 py-2.5 text-right">{fmt(grossSubtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500">Item Level Discounts (−)</td>
                    <td className="px-4 py-2.5 text-right">−{fmt(totalDiscount)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 font-medium text-gray-800">Total Taxable Value</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(invoice.subtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-500">Total GST</td>
                    <td className="px-4 py-2.5 text-right">{fmt(invoice.totalTax)}</td>
                  </tr>
                  {shippingCharges > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500">Shipping & Handling</td>
                      <td className="px-4 py-2.5 text-right">{fmt(shippingCharges)}</td>
                    </tr>
                  )}
                  {adjustment !== 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500">Round Off Adjustment</td>
                    <td className="px-4 py-2.5 text-right">{adjustment < 0 ? '−' : ''}{fmt(Math.abs(adjustment))}</td>
                    </tr>
                  )}
                  <tr className="bg-blue-50">
                    <td className="px-4 py-3 font-bold text-gray-900">Total Payable</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(invoice.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

       {/* Payments Tab: payment receipts for this invoice only */}
       {activeTab === 'payments' && !isProformaInvoice(invoice) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
               <p className="text-sm text-gray-500">Payment receipts recorded against this invoice.</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
             {invoice.payments.length === 0 && paymentReceipts.length === 0 ? (
              <div className="py-14 text-center text-gray-500">
                <Receipt size={28} className="mx-auto mb-2 text-gray-300" />
                 No payment receipts recorded yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                     <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">RECEIPT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">DATE</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">METHOD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">REFERENCE</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                   {invoice.payments.map((p) => (
                     <tr key={p.id} className="border-b border-gray-100">
                       <td className="px-4 py-3 text-gray-500">Payment</td>
                       <td className="px-4 py-3 text-gray-600">{p.date}</td>
                       <td className="px-4 py-3 text-gray-900">{p.method}</td>
                       <td className="px-4 py-3 text-gray-600">{p.reference}</td>
                       <td className="px-4 py-3 text-right font-medium">{fmt(p.amount)}</td>
                     </tr>
                   ))}
                   {paymentReceipts.map((receipt) => (
                     <tr key={receipt.id} className="border-b border-gray-100">
                       <td className="px-4 py-3 font-medium text-blue-700">{receipt.paymentNumber}</td>
                       <td className="px-4 py-3 text-gray-600">{receipt.paymentDate}</td>
                       <td className="px-4 py-3 text-gray-900">{receipt.paymentMode}</td>
                       <td className="px-4 py-3 text-gray-600">{receipt.reference || '—'}</td>
                       <td className="px-4 py-3 text-right font-medium">{fmt(receipt.amountReceived)}</td>
                     </tr>
                   ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {invoice.activity.length === 0 ? (
            <div className="py-14 text-center text-gray-500">No activity recorded yet.</div>
          ) : (
            invoice.activity.slice().reverse().map((event) => (
              <div key={event.id} className="px-6 py-4 flex gap-4">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Receipt size={16} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{event.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{event.date}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
