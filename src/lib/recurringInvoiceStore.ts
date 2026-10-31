// ── Recurring Invoice Store (localStorage) ────────────────────────────────────

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringStatus = 'active' | 'paused' | 'completed' | 'expired';
export type GeneratedStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface GeneratedInvoiceEntry {
  id: string;
  invoiceNumber: string;
  date: string;        // YYYY-MM-DD
  dueDate: string;
  grandTotal: number;
  status: GeneratedStatus;
}

export interface RecurringInvoice {
  id: string;
  profileName: string;
  clientName: string;
  clientGstin?: string;
  billingAddress?: string;
  // amounts
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  // schedule
  frequency: RecurringFrequency;
  status: RecurringStatus;
  startDate: string;    // YYYY-MM-DD
  endDate?: string;
  nextInvoiceDate: string;
  lastInvoiceDate?: string;
  // payment
  paymentTerms: string;
  notes?: string;
  // generated
  invoicesSent: number;
  generatedInvoices: GeneratedInvoiceEntry[];
  // meta
  createdAt: string;
  updatedAt: string;
}

const STORE_KEY = 'nido_recurring_invoices';

// ─── helpers ──────────────────────────────────────────────────────────────────
function nextDate(from: string, freq: RecurringFrequency): string {
  const d = new Date(from);
  switch (freq) {
    case 'daily':     d.setDate(d.getDate() + 1); break;
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────
export function getAllRecurring(): RecurringInvoice[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}

export function saveRecurring(rec: RecurringInvoice): void {
  const all = getAllRecurring();
  const idx = all.findIndex(r => r.id === rec.id);
  if (idx >= 0) all[idx] = rec; else all.unshift(rec);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('recurringInvoicesUpdated'));
}

export function deleteRecurring(id: string): void {
  const all = getAllRecurring().filter(r => r.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('recurringInvoicesUpdated'));
}

export function toggleStatus(id: string): void {
  const all = getAllRecurring();
  const idx = all.findIndex(r => r.id === id);
  if (idx < 0) return;
  const rec = all[idx];
  rec.status = rec.status === 'active' ? 'paused' : 'active';
  rec.updatedAt = new Date().toISOString();
  all[idx] = rec;
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('recurringInvoicesUpdated'));
}

// ─── seeded demo data ──────────────────────────────────────────────────────────
const SEED: RecurringInvoice[] = [
  {
    id: 'ri_001',
    profileName: 'Monthly Retainer – Tech Solutions',
    clientName: 'Tech Solutions Inc',
    clientGstin: '29AABCT1234A1ZS',
    billingAddress: '12 MG Road, Bengaluru, Karnataka – 560001',
    subtotal: 42372.88,
    taxAmount: 7627.12,
    grandTotal: 50000,
    frequency: 'monthly',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    nextInvoiceDate: '2026-08-01',
    lastInvoiceDate: '2026-07-01',
    paymentTerms: 'Net 15',
    notes: 'Monthly software maintenance and support retainer.',
    invoicesSent: 7,
    generatedInvoices: [
      { id: 'gi_001a', invoiceNumber: 'INV-00041', date: '2026-07-01', dueDate: '2026-07-16', grandTotal: 50000, status: 'Paid' },
      { id: 'gi_001b', invoiceNumber: 'INV-00033', date: '2026-06-01', dueDate: '2026-06-16', grandTotal: 50000, status: 'Paid' },
      { id: 'gi_001c', invoiceNumber: 'INV-00024', date: '2026-05-01', dueDate: '2026-05-16', grandTotal: 50000, status: 'Paid' },
      { id: 'gi_001d', invoiceNumber: 'INV-00016', date: '2026-04-01', dueDate: '2026-04-16', grandTotal: 50000, status: 'Paid' },
    ],
    createdAt: '2025-12-28T09:00:00.000Z',
    updatedAt: '2026-07-01T06:00:00.000Z',
  },
  {
    id: 'ri_002',
    profileName: 'Quarterly SEO Package – Marketing Pro',
    clientName: 'Marketing Pro Agency',
    clientGstin: '27AADCM5678B1ZK',
    billingAddress: '45 Nariman Point, Mumbai, Maharashtra – 400021',
    subtotal: 21186.44,
    taxAmount: 3813.56,
    grandTotal: 25000,
    frequency: 'quarterly',
    status: 'active',
    startDate: '2026-01-15',
    endDate: '2026-12-15',
    nextInvoiceDate: '2026-10-15',
    lastInvoiceDate: '2026-07-15',
    paymentTerms: 'Net 30',
    notes: 'Quarterly SEO audit, content & reporting.',
    invoicesSent: 3,
    generatedInvoices: [
      { id: 'gi_002a', invoiceNumber: 'INV-00039', date: '2026-07-15', dueDate: '2026-08-14', grandTotal: 25000, status: 'Sent' },
      { id: 'gi_002b', invoiceNumber: 'INV-00021', date: '2026-04-15', dueDate: '2026-05-15', grandTotal: 25000, status: 'Paid' },
      { id: 'gi_002c', invoiceNumber: 'INV-00008', date: '2026-01-15', dueDate: '2026-02-14', grandTotal: 25000, status: 'Paid' },
    ],
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-07-15T06:00:00.000Z',
  },
  {
    id: 'ri_003',
    profileName: 'Annual AMC – Infinity Retail',
    clientName: 'Infinity Retail Ltd',
    clientGstin: '33AACFI9012C1ZQ',
    billingAddress: '78 Anna Salai, Chennai, Tamil Nadu – 600002',
    subtotal: 84745.76,
    taxAmount: 15254.24,
    grandTotal: 100000,
    frequency: 'yearly',
    status: 'active',
    startDate: '2026-04-01',
    endDate: '2029-03-31',
    nextInvoiceDate: '2027-04-01',
    lastInvoiceDate: '2026-04-01',
    paymentTerms: 'Net 45',
    notes: 'Annual maintenance contract for enterprise hardware fleet.',
    invoicesSent: 1,
    generatedInvoices: [
      { id: 'gi_003a', invoiceNumber: 'INV-00011', date: '2026-04-01', dueDate: '2026-05-16', grandTotal: 100000, status: 'Paid' },
    ],
    createdAt: '2026-03-25T08:00:00.000Z',
    updatedAt: '2026-04-01T06:00:00.000Z',
  },
  {
    id: 'ri_004',
    profileName: 'Weekly Courier Billing – FastMove',
    clientName: 'FastMove Logistics',
    billingAddress: 'Plot 22, Industrial Area, Gurugram, Haryana – 122001',
    subtotal: 3389.83,
    taxAmount: 610.17,
    grandTotal: 4000,
    frequency: 'weekly',
    status: 'paused',
    startDate: '2026-03-01',
    nextInvoiceDate: '2026-08-04',
    lastInvoiceDate: '2026-06-30',
    paymentTerms: 'Net 7',
    invoicesSent: 18,
    generatedInvoices: [
      { id: 'gi_004a', invoiceNumber: 'INV-00040', date: '2026-06-30', dueDate: '2026-07-07', grandTotal: 4000, status: 'Overdue' },
      { id: 'gi_004b', invoiceNumber: 'INV-00036', date: '2026-06-23', dueDate: '2026-06-30', grandTotal: 4000, status: 'Paid' },
    ],
    createdAt: '2026-02-22T11:00:00.000Z',
    updatedAt: '2026-07-01T06:00:00.000Z',
  },
];

export function seedIfEmpty(): void {
  if (getAllRecurring().length === 0) {
    localStorage.setItem(STORE_KEY, JSON.stringify(SEED));
  }
}

export function buildNewId(): string {
  return `ri_${Date.now()}`;
}

export { nextDate };
