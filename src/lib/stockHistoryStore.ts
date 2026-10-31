// ─── Stock History & Threshold Store ─────────────────────────────────────────
// Centralized audit trail for every stock movement on the NIDO platform.
// Consumed exclusively by the Stock Management module (Configuration Hub).
// All stock mutations in vendorStore.ts write here before returning.

const HISTORY_KEY = 'nido_stock_history';
const THRESHOLDS_KEY = 'nido_stock_thresholds';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StockAction =
  | 'Order Reserved'
  | 'Reservation Released'
  | 'PO Raised'
  | 'PO Cancelled'
  | 'Stock In'
  | 'Stock Out'
  | 'Stock Correction'
  | 'Vendor Stock Updated';

export interface StockHistoryEntry {
  id: string;
  timestamp: string;
  masterProductCode: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  action: StockAction;
  /** Which stock field was affected */
  field: 'physicalStock' | 'reservedStock' | 'both';
  qtyBefore: number;
  /** Signed: positive = stock increased, negative = stock decreased */
  qtyChanged: number;
  qtyAfter: number;
  /** Order ID / PO number / 'Manual' / 'Admin Edit' */
  reference: string;
  user: string;
}

export interface StockThresholds {
  low: number;
  outOfStock: number;
}

// ─── History read / write ─────────────────────────────────────────────────────

function readHistory(): StockHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function writeHistory(entries: StockHistoryEntry[]): void {
  // Cap at 5 000 entries so localStorage never bloats
  const trimmed = entries.length > 5000 ? entries.slice(entries.length - 5000) : entries;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new Event('stockHistoryUpdated'));
}

/**
 * Append one stock event to the history log.
 * Called by vendorStore.ts after every mutation.
 */
export function recordStockEvent(entry: Omit<StockHistoryEntry, 'id' | 'timestamp'>): void {
  const history = readHistory();
  history.push({
    id: `SH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  writeHistory(history);
}

/** Return full history, newest entry first. */
export function getStockHistory(): StockHistoryEntry[] {
  return [...readHistory()].reverse();
}

// ─── Per-product low-stock thresholds ────────────────────────────────────────

function readThresholds(): Record<string, StockThresholds> {
  try { return JSON.parse(localStorage.getItem(THRESHOLDS_KEY) || '{}'); }
  catch { return {}; }
}

export function getThresholds(masterProductCode: string): StockThresholds {
  return readThresholds()[masterProductCode] ?? { low: 10, outOfStock: 0 };
}

export function saveThresholds(masterProductCode: string, t: StockThresholds): void {
  const all = readThresholds();
  all[masterProductCode] = t;
  localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('stockThresholdsUpdated'));
}

export function getAllThresholds(): Record<string, StockThresholds> {
  return readThresholds();
}
