import { generateReferenceQuotePdfBase64 } from './referenceQuotePdfGenerator';
import type { StoredQuote } from './quoteStore';
import type { StoredSalesOrder } from './salesOrderStore';

function asQuoteDocument(order: StoredSalesOrder): StoredQuote {
  return {
    id: order.id,
    quoteNumber: order.orderNumber,
    quoteDate: order.orderDate,
    validTill: order.deliveryDate,
    clientName: order.clientName,
    contactPerson: order.contactPerson,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    emails: order.emails,
    lineItems: order.lineItems,
    subtotal: order.subtotal,
    gstSlabs: order.gstSlabs,
    totalTax: order.totalTax,
    adjustment: order.adjustment,
    shippingCharges: order.shippingCharges,
    grandTotal: order.grandTotal,
    termsConditions: order.termsConditions,
    customerNotes: order.customerNotes,
    supportingDocs: [],
    status: 'Draft',
    clientGstin: order.clientGstin,
    placeOfSupply: order.placeOfSupply,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Sales orders intentionally use the same renderer as the quote PDF.
 * Only the document title and the two date labels change.
 */
export async function generateSalesOrderPdfBase64(order: StoredSalesOrder): Promise<string> {
  return generateReferenceQuotePdfBase64(asQuoteDocument(order), {
    title: 'SALES ORDER',
    firstDateLabel: 'Order Date',
    secondDateLabel: 'Delivery Date',
    includeShippingGst: true,
  });
}

export async function downloadSalesOrderPdf(order: StoredSalesOrder): Promise<void> {
  const dataUri = await generateSalesOrderPdfBase64(order);
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = `${order.orderNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}