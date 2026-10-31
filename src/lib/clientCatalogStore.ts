// Client Catalog Store — persists each client's catalog products to localStorage
// keyed by clientId so ShopPage can read them per-client.

import type { CatalogVariation } from './catalogStore';

export interface ClientCatalogEntry {
  productCode: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  productType?: string;
  physicalType?: string;
  roles: string[];
  preference?: string;
  cpc?: string;
  price: string;
  availability: string;
  img: string;
  images?: string[];   // all product images from master catalog
  // enriched from master catalog for Shop display
  description?: string;
  specs?: string[];        // "Key: Value" formatted
  leadTime?: string;
  moq?: number;
  priceNum?: number;
  generalSpecs?: { label: string; value: string }[];
  variations?: CatalogVariation[];
  productNotes?: string;
  videoUrl?: string;
  warranty?: string;
}

const STORE_KEY = 'nido_client_catalogs';

type ClientStore = Record<string, ClientCatalogEntry[]>;

function read(): ClientStore {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function write(store: ClientStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event('clientCatalogUpdated'));
}

export function getClientCatalog(clientId: string): ClientCatalogEntry[] {
  return read()[clientId] || [];
}

export function saveClientCatalog(clientId: string, entries: ClientCatalogEntry[]): void {
  const store = read();
  store[clientId] = entries;
  write(store);
}

export function addToClientCatalog(clientId: string, newEntries: ClientCatalogEntry[]): void {
  const existing = getClientCatalog(clientId);
  const existingCodes = new Set(existing.map(e => e.productCode));
  const toAdd = newEntries.filter(e => !existingCodes.has(e.productCode));
  saveClientCatalog(clientId, [...existing, ...toAdd]);
}

export function removeFromClientCatalog(clientId: string, productCode: string): void {
  const entries = getClientCatalog(clientId).filter(e => e.productCode !== productCode);
  saveClientCatalog(clientId, entries);
}

// ─── Global CPC sequence counter ─────────────────────────────────────────────
// Mirrors the vendor-side VPC counter: a dedicated localStorage key stores the
// highest CPC number ever issued. Monotonic — never reused, even when entries
// are removed or edited. Bootstrapped from existing entries on first use.

const CPC_COUNTER_KEY = 'nido_cpc_counter';
import { getPrefix } from './configService';

function getClientProductPrefix(): string {
  return getPrefix('clientProductCode') || 'CPC-';
}

function getCpcRegex(): RegExp {
  const escaped = getClientProductPrefix().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(\\d+)$`, 'i');
}

function readCpcCounter(): number {
  try {
    const raw = localStorage.getItem(CPC_COUNTER_KEY);
    if (raw !== null) return Math.max(0, parseInt(raw, 10) || 0);
  } catch { /* ignore */ }
  // First run: bootstrap from existing entries
  const store = read();
  let max = 0;
  for (const entries of Object.values(store)) {
    for (const e of entries) {
      const m = getCpcRegex().exec(e.cpc?.trim() ?? '');
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
  }
  return max;
}

function writeCpcCounter(value: number): void {
  try { localStorage.setItem(CPC_COUNTER_KEY, String(value)); } catch { /* ignore */ }
}

/**
 * Peek at the current counter value without incrementing it.
 * Use this to compute preview CPC codes for display only —
 * the counter is not advanced, so cancelling wastes nothing.
 */
export function peekCpcCounter(): number {
  return readCpcCounter();
}

/**
 * Reserve `count` sequential CPC codes atomically.
 * The counter is incremented before returning so the same codes
 * are never issued twice, even across separate sessions.
 *
 * Returns an array of strings: ['CPC-00001', 'CPC-00002', …]
 */
export function reserveClientProductCodes(count: number): string[] {
  if (count <= 0) return [];
  const current = readCpcCounter();
  const codes = Array.from({ length: count }, (_, i) =>
    `${getClientProductPrefix()}${String(current + 1 + i).padStart(5, '0')}`
  );
  writeCpcCounter(current + count);
  return codes;
}

/** Convenience wrapper for a single CPC code. */
export function reserveClientProductCode(): string {
  return reserveClientProductCodes(1)[0];
}

/** CPC format regex — exported so the UI can validate user-edited codes. */
// Consumers call this at validation time so a prefix changed in General
// Settings is reflected without a page reload.
export function getClientProductCodeFormatRegex(): RegExp {
  return getCpcRegex();
}

export function updateClientCatalogProductPrice(
  clientId: string,
  productCode: string,
  price: string,
  priceNum: number
): boolean {
  const catalog = getClientCatalog(clientId);
  const idx = catalog.findIndex(e => e.productCode === productCode);
  if (idx === -1) return false;
  catalog[idx] = { ...catalog[idx], price, priceNum };
  saveClientCatalog(clientId, catalog);
  return true;
}
