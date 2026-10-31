import { getPrefix } from './configService';
import type { ProductCommercialTerms } from './productCommercialTerms';
import { isPhysicalOrHybridProduct } from './productTypeRules';

export type InvoiceStatus = 'Draft' | 'Proforma Invoice' | 'Sent' | 'Paid' | 'Pending' | 'Overdue' | 'Cancelled';

export interface InvoiceLineItem {
  id: string;
  description: string;      // item name (bold in PDF)
  itemDetails?: string;     // sub-description (lighter text below name)
  subOrderId?: string;      // originating order sub-order identifier
  hsnSac?: string;
  quantity: number;
  rate: number;
  discount?: number;        // item-level discount amount
  taxPercent: number;
  taxType?: string;         // e.g. 'IGST' or 'CGST+SGST'
  productType?: string;
  physicalType?: string;
  fulfillmentType?: string;
  category?: string;
  commercialTerms?: ProductCommercialTerms;
}

export interface InvoicePayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

export interface InvoiceActivity {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface StoredInvoice {
  id: string;
  invoiceNumber: string;
  /** Set only on a regular invoice created from a proforma invoice. */
  sourceProformaId?: string;
  archived?: boolean;
  archiveReason?: string;
  archivedAt?: string;
  // client
  clientId?: string;
  clientName: string;
  contactPerson: string;
  clientGstin?: string;
  clientContact?: string;
  /** All recipients for invoice delivery; clientContact remains the primary/backward-compatible value. */
  clientContacts?: string[];
  // addresses
  billingAddress: string;
  shippingAddress: string;
  shippingStateCode?: string;
  shippingAttn?: string;
  // dates & refs
  invoiceDate: string;
  dueDate: string;
  poReference?: string;
  /** Main client-portal order used to create this invoice, when applicable. */
  originatingOrderId?: string;
  placeOfSupply?: string;
  // status
  status: InvoiceStatus;
  /** Set when a document has been sent; proformas retain their document status. */
  sentAt?: string;
  lastReminderAt?: string;
  // line items
  lineItems: InvoiceLineItem[];
  // totals
  grossSubtotal: number;    // sum of (qty * rate)
  totalDiscount: number;    // sum of item discounts
  subtotal: number;         // taxable value = grossSubtotal - totalDiscount
  totalTax: number;
  shippingCharges: number;
  adjustment: number;       // round-off
  grandTotal: number;
  // text sections
  notes: string;
  termsConditions?: string;
  // bank remittance
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  // meta
  payments: InvoicePayment[];
  activity: InvoiceActivity[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Proforma invoices are valid only when every populated line item is a
 * physical or hybrid product. Empty invoice rows are ignored while editing,
 * but at least one populated line item is required.
 */
export function isProformaInvoiceEligible(invoice: Pick<StoredInvoice, 'lineItems'>): boolean {
  const populatedItems = invoice.lineItems.filter((item) => item.description.trim());
  return populatedItems.length > 0
    && populatedItems.every((item) => isPhysicalOrHybridProduct({
      productType: item.productType,
      physicalType: item.physicalType,
      fulfillmentType: item.fulfillmentType,
      category: item.category,
      commercialTerms: item.commercialTerms,
    }));
}

const STORE_KEY = 'nido_sales_invoices';

const SEED_INVOICES: StoredInvoice[] = [
  {
    id: 'inv_001',
    invoiceNumber: 'INV-2026-0092',
    clientName: 'Express IT Solutions Pvt Ltd',
    contactPerson: 'Accounts Team',
    clientGstin: '36AAACE9876B1ZS',
    clientContact: 'accounts@expressit.com',
    billingAddress: '321 Cyber Towers, HITEC City\nHyderabad, Telangana - 500081',
    shippingAddress: '321 Cyber Towers, HITEC City\nHyderabad, Telangana - 500081',
    shippingStateCode: '36 (Telangana)',
    shippingAttn: 'Operations Team',
    invoiceDate: '2026-07-24',
    dueDate: '2026-08-08',
    poReference: 'PO-99482',
    placeOfSupply: 'Telangana (36)',
    status: 'Sent',
    lineItems: [
      {
        id: 'inv-001-1',
        description: 'Enterprise Cloud Workstation Setup',
        itemDetails: 'Hardware procurement & corporate installation.',
        hsnSac: '84713010',
        quantity: 2,
        rate: 65000,
        discount: 5000,
        taxPercent: 18,
        taxType: 'IGST',
      },
      {
        id: 'inv-001-2',
        description: 'Network Infrastructure Consulting',
        itemDetails: 'IT architecture advisory and setup support.',
        hsnSac: '998313',
        quantity: 1,
        rate: 40000,
        discount: 2000,
        taxPercent: 18,
        taxType: 'IGST',
      },
      {
        id: 'inv-001-3',
        description: 'Commercial Computer Manuals & Printware',
        itemDetails: 'Printed documentation and operating guides.',
        hsnSac: '49011010',
        quantity: 10,
        rate: 1200,
        discount: 1000,
        taxPercent: 12,
        taxType: 'IGST',
      },
      {
        id: 'inv-001-4',
        description: 'Logitech Corporate Desktop Bundles',
        itemDetails: 'High-grade mouse and keyboard accessories.',
        hsnSac: '84716040',
        quantity: 5,
        rate: 5000,
        discount: 2000,
        taxPercent: 28,
        taxType: 'IGST',
      },
    ],
    grossSubtotal: 207000,
    totalDiscount: 10000,
    subtotal: 197000,
    totalTax: 37100,
    shippingCharges: 2500,
    adjustment: 0,
    grandTotal: 236600,
    notes: '',
    termsConditions: 'Payment is due within 15 days of invoice issue date.\nOverdue balances are subject to interest charges of 1.5% per month.\nPlease quote invoice number #INV-2026-0092 in wire transfer notes.',
    bankName: 'HDFC Bank Ltd',
    bankAccountName: 'Nido-Tech Corporate Essentials',
    bankAccountNo: '50200012345678',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Guindy Branch, Chennai',
    payments: [],
    activity: [
      { id: 'act-001-1', date: '2026-07-24', title: 'Invoice created', description: 'Invoice was created and issued to the client.' },
    ],
    createdAt: '2026-07-24T09:00:00.000Z',
    updatedAt: '2026-07-24T09:00:00.000Z',
  },
  {
    id: 'inv_002',
    invoiceNumber: 'INV-002',
    clientName: 'Marketing Pro Agency',
    contactPerson: 'Maya Shah',
    billingAddress: '22 Linking Road, Mumbai, Maharashtra',
    shippingAddress: '22 Linking Road, Mumbai, Maharashtra',
    invoiceDate: '2024-01-15',
    dueDate: '2024-02-15',
    status: 'Pending',
    lineItems: [
      { id: 'inv-002-1', description: 'Corporate procurement services', quantity: 1, rate: 8500, discount: 0, taxPercent: 18, taxType: 'IGST' },
    ],
    grossSubtotal: 8500,
    totalDiscount: 0,
    subtotal: 8500,
    totalTax: 1530,
    shippingCharges: 0,
    adjustment: 0,
    grandTotal: 10030,
    notes: 'Payment is due within 30 days.',
    payments: [],
    activity: [
      { id: 'act-002-1', date: '2024-01-15', title: 'Invoice created', description: 'Invoice was created and issued to the client.' },
      { id: 'act-002-2', date: '2024-01-15', title: 'Invoice sent', description: 'Invoice email was sent to the client.' },
    ],
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 'inv_003',
    invoiceNumber: 'INV-003',
    clientName: 'Finance Corp',
    contactPerson: 'Rohan Kapoor',
    billingAddress: '8 Connaught Place, New Delhi',
    shippingAddress: '8 Connaught Place, New Delhi',
    invoiceDate: '2023-12-20',
    dueDate: '2024-01-20',
    status: 'Overdue',
    lineItems: [
      { id: 'inv-003-1', description: 'Annual procurement support plan', quantity: 1, rate: 22000, discount: 0, taxPercent: 18, taxType: 'IGST' },
    ],
    grossSubtotal: 22000,
    totalDiscount: 0,
    subtotal: 22000,
    totalTax: 3960,
    shippingCharges: 0,
    adjustment: 0,
    grandTotal: 25960,
    notes: 'Please contact accounts for payment queries.',
    payments: [],
    activity: [
      { id: 'act-003-1', date: '2023-12-20', title: 'Invoice created', description: 'Invoice was created and issued to the client.' },
      { id: 'act-003-2', date: '2024-01-21', title: 'Payment overdue', description: 'The payment due date has passed.' },
    ],
    createdAt: '2023-12-20T09:00:00.000Z',
    updatedAt: '2024-01-21T09:00:00.000Z',
  },
];

function seedInvoices(): StoredInvoice[] {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredInvoice[];
      // migrate old invoices that lack new fields
      return parsed.map((inv) => ({
        grossSubtotal: inv.grossSubtotal ?? inv.subtotal,
        totalDiscount: inv.totalDiscount ?? 0,
        shippingCharges: inv.shippingCharges ?? 0,
        adjustment: inv.adjustment ?? 0,
        ...inv,
      }));
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(SEED_INVOICES));
  } catch {
    // The app also renders in environments without localStorage.
  }
  return [...SEED_INVOICES];
}

export function getInvoices(): StoredInvoice[] {
  return seedInvoices().filter((inv) => !inv.archived);
}

export function getArchivedInvoices(): StoredInvoice[] {
  return seedInvoices().filter((inv) => inv.archived);
}

export function getInvoiceById(id: string): StoredInvoice | undefined {
  return getInvoices().find((invoice) => invoice.id === id);
}

export function saveInvoice(invoice: StoredInvoice): boolean {
  if (invoice.status === 'Proforma Invoice' && !isProformaInvoiceEligible(invoice)) {
    return false;
  }

  // Save against the full collection so updating an active invoice never
  // drops invoices that were intentionally archived.
  const invoices = seedInvoices();
  const index = invoices.findIndex((item) => item.id === invoice.id);
  if (index >= 0) invoices[index] = invoice;
  else invoices.unshift(invoice);
  localStorage.setItem(STORE_KEY, JSON.stringify(invoices));
  window.dispatchEvent(new Event('nidoInvoicesUpdated'));
  return true;
}

export function archiveInvoice(id: string, reason: string): void {
  const all = seedInvoices();
  const idx = all.findIndex((inv) => inv.id === id);
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      archived: true,
      archiveReason: reason.trim(),
      archivedAt: new Date().toISOString(),
    };
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('nidoInvoicesUpdated'));
}

export function deleteInvoice(id: string): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(seedInvoices().filter((invoice) => invoice.id !== id)));
  window.dispatchEvent(new Event('nidoInvoicesUpdated'));
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const prefix = getPrefix('invoice') || 'INV-';
  const prefixEscaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${prefixEscaped}${year}(\\d+)$`);
  const serials = seedInvoices()
    .map((inv) => { const m = inv.invoiceNumber.match(re); return m ? parseInt(m[1], 10) : 0; })
    .filter((n) => n > 0);
  const next = serials.length > 0 ? Math.max(...serials) + 1 : 1;
  return `${prefix}${year}${String(next).padStart(5, '0')}`;
}

/**
 * Proforma numbers use their own visible prefix so they can never be
 * confused with regular invoice numbers. The sequence is intentionally
 * separate from the configurable invoice prefix.
 */
export function generateProformaInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const prefix = 'PRO INV - ';
  const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${year}(\\d+)$`);
  const serials = seedInvoices()
    .map((invoice) => {
      const match = invoice.invoiceNumber.match(regex);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((serial) => serial > 0);
  const next = serials.length > 0 ? Math.max(...serials) + 1 : 1;
  return `${prefix}${year}${String(next).padStart(6, '0')}`;
}

/**
 * Create a regular invoice from a proforma without changing the original
 * proforma record. Repeated conversion attempts return the existing invoice.
 */
export function convertProformaToInvoice(proformaId: string): StoredInvoice | null {
  const proforma = getInvoiceById(proformaId);
  if (
    !proforma
    || proforma.status !== 'Proforma Invoice'
    || !isProformaInvoiceEligible(proforma)
  ) return null;

  const existingConversion = getInvoices().find(
    (invoice) => invoice.sourceProformaId === proformaId,
  );
  if (existingConversion) return existingConversion;

  const now = new Date().toISOString();
  const {
    archived: _archived,
    archiveReason: _archiveReason,
    archivedAt: _archivedAt,
    ...proformaDetails
  } = proforma;

  const invoice: StoredInvoice = {
    ...proformaDetails,
    id: `invoice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    invoiceNumber: generateInvoiceNumber(),
    sourceProformaId: proformaId,
    status: 'Draft',
    payments: [],
    activity: [
      ...proforma.activity,
      {
        id: `${Date.now()}-conversion`,
        date: new Date().toISOString().split('T')[0],
        title: 'Invoice created from proforma invoice',
        description: `Regular invoice created from proforma invoice ${proforma.invoiceNumber}.`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  saveInvoice(invoice);
  return invoice;
}
