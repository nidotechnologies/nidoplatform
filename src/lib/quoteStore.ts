// ── Sales Quote Store ─────────────────────────────────────────────────────────
// Persists quotes to localStorage. Fires a DOM event on every change.

const STORE_KEY = 'nido_sales_quotes';
const COUNTER_KEY = 'nido_quote_counter';
import { getPrefix } from './configService';
import type { ProductCommercialTerms } from './productCommercialTerms';

export interface QuoteLineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  hsnSac: string;
  qty: number;
  rate: number;
  discount: number;
  taxPercent: number;
  productType?: string;
  physicalType?: string;
  fulfillmentType?: string;
  commercialTerms?: ProductCommercialTerms;
}

export interface QuoteGstSlab {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
}

export interface SupportingDoc {
  name: string;
  type: string;
  size: number;
  data: string; // base64 data URL
}

export type QuoteStatus = 'Draft' | 'Sent to Client' | 'Accepted' | 'Rejected';

export interface StoredQuote {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  validTill: string;
  clientName: string;
  contactPerson: string;
  billingAddress: string;
  shippingAddress: string;
  emails: string[];
  lineItems: QuoteLineItem[];
  subtotal: number;
  gstSlabs: QuoteGstSlab[];
  totalTax: number;
  adjustment: number;
  shippingCharges?: number;
  /** False for quotes created without GST on shipping; undefined is a legacy quote. */
  shippingGstIncluded?: boolean;
  grandTotal: number;
  termsConditions: string;
  customerNotes: string;
  supportingDocs: SupportingDoc[];
  status: QuoteStatus;
  clientGstin?: string;
  placeOfSupply?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedAt?: string;
}

export function getQuotes(): StoredQuote[] {
  try {
    const quotes = JSON.parse(localStorage.getItem(STORE_KEY) || '[]') as StoredQuote[];
    let normalizedLegacyQuote = false;
    const normalizedQuotes = quotes.map((quote) => {
      if (quote.shippingGstIncluded !== undefined) return quote;

      normalizedLegacyQuote = true;
      const shippingCharges = quote.shippingCharges ?? 0;
      return {
        ...quote,
        shippingGstIncluded: false,
        grandTotal: quote.grandTotal - shippingCharges * 0.18,
      };
    });

    if (normalizedLegacyQuote) {
      localStorage.setItem(STORE_KEY, JSON.stringify(normalizedQuotes));
    }
    return normalizedQuotes;
  } catch {
    return [];
  }
}

export function getActiveQuotes(): StoredQuote[] {
  return getQuotes().filter(quote => !quote.archived);
}

export function getArchivedQuotes(): StoredQuote[] {
  return getQuotes().filter(quote => quote.archived === true);
}

export function getQuoteById(id: string): StoredQuote | undefined {
  return getQuotes().find(q => q.id === id);
}

export function saveQuote(quote: StoredQuote): void {
  const quotes = getQuotes();
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) {
    quotes[idx] = quote;
  } else {
    quotes.unshift(quote);
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(quotes));
  window.dispatchEvent(new Event('nidoQuotesUpdated'));
}

export function archiveQuote(id: string): void {
  const quotes = getQuotes().map(quote =>
    quote.id === id
      ? { ...quote, archived: true, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : quote,
  );
  localStorage.setItem(STORE_KEY, JSON.stringify(quotes));
  window.dispatchEvent(new Event('nidoQuotesUpdated'));
}

export function restoreQuote(id: string): void {
  const quotes = getQuotes().map(quote =>
    quote.id === id
      ? { ...quote, archived: false, archivedAt: undefined, updatedAt: new Date().toISOString() }
      : quote,
  );
  localStorage.setItem(STORE_KEY, JSON.stringify(quotes));
  window.dispatchEvent(new Event('nidoQuotesUpdated'));
}

export function generateQuoteNumber(): string {
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `${getPrefix('salesQuote') || 'QT-'}${String(counter).padStart(6, '0')}`;
}
