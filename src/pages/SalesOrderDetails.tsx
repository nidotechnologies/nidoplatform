import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getOrderById, type StoredSalesOrder } from '@/lib/salesOrderStore';
import { downloadSalesOrderPdf } from '@/lib/salesOrderPdfGenerator';
import { useI18n } from '@/i18n/I18nProvider';
import { formatCurrency } from '@/lib/formatters';
import { getAvailabilityLabel } from '@/lib/productCommercialTerms';

function statusBadge(status: StoredSalesOrder['status']) {
  const map: Record<string, string> = {
    'Draft':      'bg-gray-100 text-gray-600',
    'Confirmed':  'bg-blue-100 text-blue-700',
    'Processing': 'bg-yellow-100 text-yellow-700',
    'Completed':  'bg-green-100 text-green-700',
    'Cancelled':  'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function fmt(n: number) {
  return formatCurrency(n);
}

export default function SalesOrderDetails() {
  const { currencySymbol } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  const [order, setOrder] = useState<StoredSalesOrder | null>(null);

  useEffect(() => {
    if (!id) return;
    const o = getOrderById(id);
    setOrder(o || null);
    const refresh = () => setOrder(id ? (getOrderById(id) || null) : null);
    window.addEventListener('nidoSalesOrdersUpdated', refresh);
    return () => window.removeEventListener('nidoSalesOrdersUpdated', refresh);
  }, [id]);

  if (!order) {
    return (
      <div className="space-y-6 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/sales/orders')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Order not found</h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">This order may have been archived or deleted.</p>
      </div>
    );
  }

  const grossSubtotal = order.lineItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const totalDiscount = order.lineItems.reduce((s, i) => s + i.discount, 0);
  const totalTaxableValue = order.lineItems.reduce((s, i) => s + Math.max(0, i.qty * i.rate - i.discount), 0);
  const shippingGstRate = 18;
  const shippingGst = order.shippingCharges * shippingGstRate / 100;
  const gstRateLabels = [...new Set(order.lineItems.map(i => i.taxPercent))].sort((a, b) => a - b).map(r => `${r}%`).join(', ');

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/sales/orders')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors mt-1">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{order.orderNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                {order.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Customer: {order.clientName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total: {formatCurrency(order.grandTotal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <button
            onClick={() => navigate(`/sales/orders/${order.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Edit size={16} /> Edit
          </button>
          <button
            onClick={() => { void downloadSalesOrderPdf(order); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <FileText size={16} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['details'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}>
            Order Details
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">CUSTOMER</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.clientName}</p>
              {order.contactPerson && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{order.contactPerson}</p>}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">ORDER DATE</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.orderDate}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Delivery by {order.deliveryDate}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">LINE ITEMS</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{order.lineItems.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(order.grandTotal)} total</p>
            </div>
          </div>

          {/* Bill To / Ship To */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">BILL TO</p>
              <p className="font-bold text-gray-900 dark:text-white mb-1">{order.clientName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.billingAddress || '—'}</p>
              {order.clientGstin && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">GSTIN: {order.clientGstin}</p>}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">SHIP TO</p>
              <p className="font-bold text-gray-900 dark:text-white mb-1">{order.clientName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.shippingAddress || '—'}</p>
            </div>
          </div>

          {/* Line Items Table */}
          {order.lineItems.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <colgroup>
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {['Sl.No', 'ITEM / DESCRIPTION', 'HSN/SAC', 'QTY', `RATE (${currencySymbol})`, `DISC (${currencySymbol})`, `TAXABLE (${currencySymbol})`, 'GST RATE', `GST (${currencySymbol})`, `AMOUNT (${currencySymbol})`].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {order.lineItems.map((item, idx) => {
                      const taxable = Math.max(0, item.qty * item.rate - item.discount);
                      const gst = taxable * (item.taxPercent / 100);
                      const amt = taxable + gst;
                      return (
                        <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-center">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>}
                            {item.commercialTerms && (
                              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                <span>Pricing Model: <strong className="text-gray-700 dark:text-gray-300">{item.commercialTerms.pricingModel}</strong></span>
                                <span>MOQ / Min Qty: <strong className="text-gray-700 dark:text-gray-300">{item.commercialTerms.moqLabel}</strong></span>
                                <span>Lead Time / SLA: <strong className="text-gray-700 dark:text-gray-300">{item.commercialTerms.leadTimePrimary}{item.commercialTerms.leadTimeSecondary ? ` · ${item.commercialTerms.leadTimeSecondary}` : ""}</strong></span>
                                <span>Availability: <strong className={item.commercialTerms.availabilityStatus === "Out of Stock" ? "text-red-600" : "text-emerald-600"}>{getAvailabilityLabel(item.commercialTerms)}</strong></span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{item.hsnSac}</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-center">{item.qty}</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">{fmt(item.rate)}</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">{fmt(item.discount)}</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">{fmt(taxable)}</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-center">{item.taxPercent}%</td>
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white text-right">{fmt(gst)}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white text-right">{fmt(amt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Gross Subtotal</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{formatCurrency(grossSubtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Item Level Discounts (-)</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">− {formatCurrency(totalDiscount)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Total Taxable Value</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(totalTaxableValue)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      Total GST{gstRateLabels ? ` (${gstRateLabels})` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{formatCurrency(order.totalTax)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Shipping &amp; Handling Charges</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{formatCurrency(order.shippingCharges)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">GST on Shipping ({shippingGstRate}%)</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{formatCurrency(shippingGst)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Round Off Adjustment</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">
                      {order.adjustment >= 0 ? '' : '-'}{formatCurrency(Math.abs(order.adjustment))}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">Total Payable</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(order.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms / Notes */}
          {(order.termsConditions || order.customerNotes) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {order.termsConditions && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">TERMS & CONDITIONS</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.termsConditions}</p>
                </div>
              )}
              {order.customerNotes && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide font-semibold mb-3">CUSTOMER NOTES</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.customerNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
