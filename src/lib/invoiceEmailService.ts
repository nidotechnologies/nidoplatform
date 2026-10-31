import type { StoredInvoice } from './invoiceStore';

export type InvoiceEmailKind = 'invoice' | 'reminder';

export interface InvoiceEmailResult {
  recipients: string[];
  sentCount: number;
  success: boolean;
  error?: string;
}

export interface InvoiceEmailOutboxItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  kind: InvoiceEmailKind;
  recipients: string[];
  subject: string;
  amount: number;
  dueDate: string;
  attachmentName: string;
  createdAt: string;
}

const OUTBOX_KEY = 'nido_invoice_email_outbox';

export function getInvoiceRecipients(invoice: StoredInvoice): string[] {
  return Array.from(new Set(
    (invoice.clientContacts?.length
      ? invoice.clientContacts
      : (invoice.clientContact || '').split(','))
      .map((email) => email.trim())
      .filter(Boolean),
  ));
}

/**
 * Frontend-only invoice delivery. Since this workspace is intentionally not
 * connected to a backend email provider, delivery is recorded in a local
 * outbox so the invoice pages can complete the full send/reminder flow
 * without making a network request.
 */
export async function sendInvoiceEmail(
  invoice: StoredInvoice,
  kind: InvoiceEmailKind,
): Promise<InvoiceEmailResult> {
  const recipients = getInvoiceRecipients(invoice);
  if (recipients.length === 0) {
    return {
      recipients,
      sentCount: 0,
      success: false,
      error: 'No recipient email is configured for this invoice.',
    };
  }

  const raw = localStorage.getItem(OUTBOX_KEY);
  let outbox: InvoiceEmailOutboxItem[] = [];
  try {
    outbox = raw ? JSON.parse(raw) as InvoiceEmailOutboxItem[] : [];
  } catch {
    outbox = [];
  }

  const documentLabel = invoice.status === 'Proforma Invoice' ? 'Proforma invoice' : 'Invoice';
  const subject = kind === 'reminder'
    ? `Payment reminder — ${invoice.invoiceNumber}`
    : `${documentLabel} ${invoice.invoiceNumber}`;
  const item: InvoiceEmailOutboxItem = {
    id: `${invoice.id}-${kind}-${Date.now()}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    kind,
    recipients,
    subject,
    amount: invoice.grandTotal,
    dueDate: invoice.dueDate,
    attachmentName: `${invoice.invoiceNumber}.pdf`,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(OUTBOX_KEY, JSON.stringify([item, ...outbox].slice(0, 100)));
  return { recipients, sentCount: recipients.length, success: true };
}

export function getInvoiceEmailOutbox(): InvoiceEmailOutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as InvoiceEmailOutboxItem[];
  } catch {
    return [];
  }
}