// Price Engine — fully automatic pricing pipeline.
// Reads real data from the Master Catalog, Vendor Product Lists and Vendor
// Master data, computes the winning vendor + landed cost per product, then
// computes the client selling price from per-client charge settings, and
// syncs the result into every client catalog that carries the product.
//
// Tax calculations are delegated to the centralised Tax Engine (taxEngine.ts).
// Never hardcode tax rates here — always read from the Tax Engine so that
// changes in Tax Settings flow through immediately to all price calculations.

import { getCatalogProducts } from './catalogStore';
import type { CatalogVariation } from './catalogStore';
import { getAllVendorProducts, updateVendorProduct, getAvailableStock } from './vendorStore';
import { getVendors } from './vendorDataStore';
import { getClients } from './clientStore';
import { getClientCatalog, saveClientCatalog, updateClientCatalogProductPrice } from './clientCatalogStore';
import { getEffectiveVendorTaxPct, getEffectiveTaxPctForCategory } from './taxEngine';

// ─── Per-vendor / per-client settings ──────────────────────────────────────
// Charges/margins aren't captured anywhere else in the real data sources
// (vendor product listings, master catalog, client catalog), so they're
// configured individually per vendor / per client and stored keyed by id.

const VENDOR_SETTINGS_KEY = 'nido_price_engine_vendor_settings';
const CLIENT_SETTINGS_KEY = 'nido_price_engine_client_settings';

export interface ChargeItem {
  id: string;
  name: string;
  value: number;
}

export interface VendorCommonSettings {
  logisticsPct: number;
  handlingPct: number;
  extraCharges: ChargeItem[];
}

const DEFAULT_VENDOR_SETTINGS: VendorCommonSettings = { logisticsPct: 0, handlingPct: 0, extraCharges: [] };

function getAllVendorSettings(): Record<string, VendorCommonSettings> {
  try {
    const raw = localStorage.getItem(VENDOR_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
}

export function getVendorCommonSettings(vendorId: string): VendorCommonSettings {
  const all = getAllVendorSettings();
  return { ...DEFAULT_VENDOR_SETTINGS, ...(all[vendorId] || {}) };
}

export function saveVendorCommonSettings(vendorId: string, settings: VendorCommonSettings): void {
  const all = getAllVendorSettings();
  all[vendorId] = settings;
  localStorage.setItem(VENDOR_SETTINGS_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

export interface ClientCommonSettings {
  perUnitCharges: ChargeItem[];
  overheadPct: number;
  profitPct: number;
  discountPct: number;
  shippingDeliveryFee: number;
  platformFeePct: number;
  roundOff: 'none' | 'nearest' | 'up' | 'down';
}

const DEFAULT_CLIENT_SETTINGS: ClientCommonSettings = {
  perUnitCharges: [],
  overheadPct: 0,
  profitPct: 0,
  discountPct: 0,
  shippingDeliveryFee: 0,
  platformFeePct: 0,
  roundOff: 'none',
};

function getAllClientSettings(): Record<string, ClientCommonSettings> {
  try {
    const raw = localStorage.getItem(CLIENT_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
}

export function getClientCommonSettings(clientId: string): ClientCommonSettings {
  const all = getAllClientSettings();
  return { ...DEFAULT_CLIENT_SETTINGS, ...(all[clientId] || {}) };
}

export function saveClientCommonSettings(clientId: string, settings: ClientCommonSettings): void {
  const all = getAllClientSettings();
  all[clientId] = settings;
  localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify(all));
  // Immediately push recomputed prices into the client catalog so every
  // part of the app that reads the catalog reflects the new charges without
  // requiring the user to visit the Price Engine tab first.
  syncClientPrices(clientId);
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

export interface ClientCartPricingSettings {
  discountPct: number;
  shippingDeliveryFee: number;
  platformFeePct: number;
}

/** Checkout-only adjustments configured for one client in Price Settings. */
export function getClientCartPricingSettings(clientId: string): ClientCartPricingSettings {
  const settings = getClientCommonSettings(clientId);
  return {
    discountPct: Math.max(0, settings.discountPct || 0),
    shippingDeliveryFee: Math.max(0, settings.shippingDeliveryFee || 0),
    platformFeePct: Math.max(0, settings.platformFeePct || 0),
  };
}

// ─── Client price slabs (volume-based discounts) ───────────────────────────
// Individually configured per client. Each slab defines a quantity range
// that applies an additional discount % on top of the client's standard
// pricing settings, either across all products or a specific category.

const CLIENT_SLABS_KEY = 'nido_price_engine_client_slabs';

export interface PriceSlab {
  id: string;
  name: string;
  minQty: number;
  maxQty: number;
  discountPct: number;
  applyTo: string; // "All Products" or a specific category name
  status: 'Active' | 'Inactive';
}

function getAllClientSlabs(): Record<string, PriceSlab[]> {
  try {
    const raw = localStorage.getItem(CLIENT_SLABS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
}

export function getClientPriceSlabs(clientId: string): PriceSlab[] {
  const all = getAllClientSlabs();
  if (all[clientId]) return all[clientId];
  return [];
}

export function saveClientPriceSlabs(clientId: string, slabs: PriceSlab[]): void {
  const all = getAllClientSlabs();
  all[clientId] = slabs;
  localStorage.setItem(CLIENT_SLABS_KEY, JSON.stringify(all));
  syncClientPrices(clientId);
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// Find the discount % that applies for a given client, product category and
// quantity. Category-specific slabs take priority over "All Products" slabs
// when both match the same quantity.
export function getSlabDiscountPct(clientId: string, category: string, qty: number): number {
  const slabs = getClientPriceSlabs(clientId).filter(s => s.status === 'Active' && qty >= s.minQty && qty <= s.maxQty);
  if (slabs.length === 0) return 0;
  const catMatch = slabs.find(s => s.applyTo !== 'All Products' && s.applyTo.toLowerCase() === (category || '').toLowerCase());
  if (catMatch) return catMatch.discountPct;
  const allMatch = slabs.find(s => s.applyTo === 'All Products');
  return allMatch ? allMatch.discountPct : 0;
}

// Apply a client's quantity-based price slab discount on top of an already
// computed final (per-unit) price for that client.
export function applySlabDiscount(finalPrice: number, clientId: string, category: string, qty: number): number {
  const discountPct = getSlabDiscountPct(clientId, category, qty);
  if (!discountPct) return finalPrice;
  return finalPrice * (1 - discountPct / 100);
}

// ─── Per-client extended profit settings ────────────────────────────────────
// Stores the extra guardrail/toggle fields that supplement the client's
// default profit %. The "Default Profit %" itself lives in
// ClientCommonSettings.profitPct for full backward compatibility.

const CLIENT_PROFIT_SETTINGS_KEY = 'nido_client_profit_settings';

export interface ClientProfitSettings {
  minProfitPct: number;
  minProfitAmount: number;
  maxDiscountAllowed: number;
  enableManualOverride: boolean;
  enableMarketPriceValidation: boolean;
  enableSmartPricing: boolean;
}

const DEFAULT_PROFIT_SETTINGS: ClientProfitSettings = {
  minProfitPct: 0,
  minProfitAmount: 0,
  maxDiscountAllowed: 0,
  enableManualOverride: false,
  enableMarketPriceValidation: false,
  enableSmartPricing: false,
};

function getAllClientProfitSettings(): Record<string, ClientProfitSettings> {
  try {
    const raw = localStorage.getItem(CLIENT_PROFIT_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function getClientProfitSettings(clientId: string): ClientProfitSettings {
  const all = getAllClientProfitSettings();
  return { ...DEFAULT_PROFIT_SETTINGS, ...(all[clientId] || {}) };
}

export function saveClientProfitSettings(clientId: string, settings: ClientProfitSettings): void {
  const all = getAllClientProfitSettings();
  all[clientId] = settings;
  localStorage.setItem(CLIENT_PROFIT_SETTINGS_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// ─── Centralized category profit rules ───────────────────────────────────────
// These rules are configured once in the Client Price Engine and apply to
// every client. They add margin and buffer on top of each client's own
// Profit Margin for matching product categories.

const GLOBAL_CATEGORY_RULES_KEY = 'nido_price_engine_global_category_rules';

export interface CategoryPricingRule {
  id: string;
  category: string;
  marginPct: number;
  bufferPct: number;
}

export function getGlobalCategoryRules(): CategoryPricingRule[] {
  try {
    const raw = localStorage.getItem(GLOBAL_CATEGORY_RULES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return [];
}

export function saveGlobalCategoryRules(rules: CategoryPricingRule[]): void {
  localStorage.setItem(GLOBAL_CATEGORY_RULES_KEY, JSON.stringify(rules));
  getClients().forEach(c => syncClientPrices(c.id));
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// ─── Per-client product-specific profit rules ────────────────────────────────
// Priority 1 in the profit resolution. Setting profitPct to null means
// "fall through to the centralized category rule or client default".

const CLIENT_PRODUCT_PROFIT_KEY = 'nido_client_product_profit';

export interface ClientProductProfitRule {
  masterProductCode: string;
  productName: string;
  profitPct: number | null;
}

function getAllClientProductProfitRules(): Record<string, ClientProductProfitRule[]> {
  try {
    const raw = localStorage.getItem(CLIENT_PRODUCT_PROFIT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function getClientProductProfitRules(clientId: string): ClientProductProfitRule[] {
  const all = getAllClientProductProfitRules();
  return all[clientId] || [];
}

export function saveClientProductProfitRules(clientId: string, rules: ClientProductProfitRule[]): void {
  const all = getAllClientProductProfitRules();
  all[clientId] = rules;
  localStorage.setItem(CLIENT_PRODUCT_PROFIT_KEY, JSON.stringify(all));
  syncClientPrices(clientId);
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// Resolve effective profit % for a given client + product using this hierarchy:
//   Priority 1 — product-specific profit % (if set and > 0)
//   Priority 2 — client default profit % plus centralized category rule
export function resolveClientProfitPct(
  clientId: string,
  masterProductCode: string,
  category: string,
): number {
  // Priority 1: product-specific
  const productRules = getClientProductProfitRules(clientId);
  const productRule = productRules.find(r => r.masterProductCode === masterProductCode);
  if (productRule && productRule.profitPct !== null && productRule.profitPct > 0) {
    return productRule.profitPct;
  }

  const clientDefaultProfitPct = getClientCommonSettings(clientId).profitPct;
  const categoryRule = getGlobalCategoryRules().find(
    rule => rule.category.toLowerCase() === (category || '').toLowerCase(),
  );

  return categoryRule
    ? clientDefaultProfitPct + categoryRule.marginPct + categoryRule.bufferPct
    : clientDefaultProfitPct;
}

// ─── Vendor-side computation ────────────────────────────────────────────────

const TERMS_MAP: Record<string, string> = {
  'NET 30': '30 Days Credit', 'NET 15': '15 Days Credit',
  'NET 45': '45 Days Credit', 'NET 60': '60 Days Credit', 'NET 7': '7 Days Credit',
};

export function getLandedCost(
  basePrice: number,
  settings: VendorCommonSettings,
  productCategory?: string,
): number {
  const extraPct = settings.extraCharges.reduce((sum, c) => sum + c.value, 0);
  const totalPct = settings.logisticsPct + settings.handlingPct + extraPct;
  const preTax = basePrice * (1 + totalPct / 100);
  // Use the Tax Engine when a product category is known; fall back to the
  // per-vendor override only when no category context is available.
  // Tax always comes from the Tax Settings engine — never a local override.
  const effectiveTaxPct = getEffectiveVendorTaxPct(productCategory || '');
  return preTax * (1 + effectiveTaxPct / 100);
}

export interface VendorComparisonRow {
  vendorId: string;
  vendorName: string;
  primaryContact: string;
  vendorProductCode: string;
  /** Variations configured by this vendor for digital products. */
  variations?: CatalogVariation[];
  basePrice: number;
  moq: number;
  leadTime: number;
  /** Available stock = currentStock − reservedStock. This is what clients see in the shop. */
  stock: number;
  /** Physical stock held by vendor (only reduced when a PO is raised). */
  currentStock: number;
  /** Units reserved by client orders not yet converted to a PO. */
  reservedStock: number;
  /** Incoming / on-order stock. */
  incomingStock: number;
  rating: number;
  paymentTerms: string;
  landedCostPerUnit: number;
  score: number;
}

/** A vendor is usable for Shop checkout only when it can satisfy its own MOQ. */
export function canVendorFulfillMoq(row: VendorComparisonRow): boolean {
  const moq = Math.max(1, row.moq || 0);
  return row.stock >= moq;
}

/**
 * The price engine's recommendation is the first vendor in its ranked list
 * that can actually fulfill the vendor's MOQ. Out-of-stock and below-MOQ
 * vendors remain visible for comparison, but can never be recommended.
 */
export function getRecommendedVendor(
  comparisons: VendorComparisonRow[],
): VendorComparisonRow | null {
  return comparisons.find(canVendorFulfillMoq) ?? null;
}

/**
 * Return the single comparison badge for a vendor. Recommendation is based on
 * the price-engine ranking; the other badges describe eligible alternatives.
 */
export function getVendorComparisonBadge(
  comparison: VendorComparisonRow,
  comparisons: VendorComparisonRow[],
  isEligible: (row: VendorComparisonRow) => boolean = canVendorFulfillMoq,
): "Recommended" | "Fastest" | "Best Price" | "Top Rated" | null {
  const eligible = comparisons.filter(isEligible);
  const recommended = eligible[0] ?? null;
  if (!recommended || !isEligible(comparison)) return null;
  if (comparison.vendorId === recommended.vendorId) return "Recommended";

  const fastest = eligible.reduce((best, row) =>
    row.leadTime > 0 && (best === null || row.leadTime < best.leadTime) ? row : best,
  null as VendorComparisonRow | null);
  if (fastest && comparison.vendorId === fastest.vendorId) return "Fastest";

  const bestPrice = eligible.reduce((best, row) =>
    best === null || row.landedCostPerUnit < best.landedCostPerUnit ? row : best,
  null as VendorComparisonRow | null);
  if (bestPrice && comparison.vendorId === bestPrice.vendorId) return "Best Price";

  const topRated = eligible.reduce((best, row) =>
    best === null || row.rating > best.rating ? row : best,
  null as VendorComparisonRow | null);
  if (topRated && topRated.rating > 0 && comparison.vendorId === topRated.vendorId) return "Top Rated";
  return null;
}

export function computeVendorComparisons(
  masterProductCode: string,
  productCategory?: string,
  /** When true, returns physicalStock (assigned qty) instead of availableStock
   *  (physicalStock − reservedStock).  Use this in the admin Vendor Selection
   *  popup so reservations made at checkout do not hide real vendor stock. */
  usePhysicalStock?: boolean,
): VendorComparisonRow[] {
  const storeMap = getAllVendorProducts();
  const allVendors = getVendors();
  const rows: VendorComparisonRow[] = [];

  Object.entries(storeMap).forEach(([vendorId, products]) => {
    const match = products.find(p => p.masterProductCode === masterProductCode && p.status === 'Active');
    if (!match) return;
    const info = allVendors.find(v => v.id === vendorId);
    const rawTerms = info?.paymentTerms || '';
    const basePrice = parseFloat(match.price) || 0;
    const vendorSettings = getVendorCommonSettings(vendorId);
    const currentStock = parseInt(match.stock || '0') || 0;
    const reservedStock = parseInt(match.reservedStock || '0') || 0;
    const stockValue = usePhysicalStock
      ? (parseInt(match.physicalStock ?? match.stock ?? '0') || 0)
      : getAvailableStock(match);
    const availableStock = getAvailableStock(match);
    rows.push({
      vendorId,
      vendorName: info?.name || vendorId,
      primaryContact: info?.primaryContact || info?.name || vendorId,
      vendorProductCode: match.vendorProductCode || '—',
      variations: Array.isArray(match.variations) ? match.variations : [],
      basePrice,
      moq: parseInt(match.moq) || 0,
      leadTime: parseInt(match.leadTime) || 0,
      /** stock = availableStock (what clients/shop see) */
      stock: usePhysicalStock ? stockValue : availableStock,
      currentStock,
      reservedStock,
      incomingStock: parseInt(match.incomingStock || '0') || 0,
      rating: info?.rating || 0,
      paymentTerms: TERMS_MAP[rawTerms] || rawTerms || '—',
      // Pass category to Tax Engine for accurate, category-specific vendor tax rates
      landedCostPerUnit: getLandedCost(basePrice, vendorSettings, productCategory),
      score: 0,
    });
  });

  if (!rows.length) return rows;

  const minL = Math.min(...rows.map(r => r.landedCostPerUnit));
  const maxR = Math.max(...rows.map(r => r.rating));
  const minLT = Math.min(...rows.map(r => r.leadTime));
  const maxLT = Math.max(...rows.map(r => r.leadTime));
  const maxS = Math.max(...rows.map(r => r.stock));

  rows.forEach(r => {
    r.score =
      (1 - (r.landedCostPerUnit - minL) / (minL || 1)) * 40 +
      (r.rating / (maxR || 1)) * 30 +
      (1 - (r.leadTime - minLT) / ((maxLT - minLT) || 1)) * 15 +
      (r.stock / (maxS || 1)) * 15;
  });

  // Primary sort: lowest landed cost first.
  // Secondary sort: composite score (rating, lead time, stock) breaks ties.
  return rows.sort((a, b) =>
    a.landedCostPerUnit !== b.landedCostPerUnit
      ? a.landedCostPerUnit - b.landedCostPerUnit
      : b.score - a.score,
  );
}

// Update the MOQ on the winning vendor's product listing for a given master
// product. This is the single source of truth for MOQ, so any consumer
// (Shop page, Client Catalog, etc.) that edits it here will automatically
// flow through to the Price Engine and trigger a price recalculation via the
// 'vendorProductsUpdated' event.
export function updateWinningVendorMoq(masterProductCode: string, newMoq: number): boolean {
  const comparisons = computeVendorComparisons(masterProductCode);
  const winner = comparisons[0];
  if (!winner) return false;

  const vendorProducts = getAllVendorProducts()[winner.vendorId] || [];
  const match = vendorProducts.find(p => p.masterProductCode === masterProductCode && p.status === 'Active');
  if (!match) return false;

  updateVendorProduct(winner.vendorId, match.id, { moq: String(newMoq) });
  return true;
}

export interface ProductPricing {
  masterProductCode: string;
  productName: string;
  sku: string;
  category: string;
  vendorComparisons: VendorComparisonRow[];
  winningVendor: VendorComparisonRow | null;
  landedCostPerUnit: number;
  moq: number;
}

// ─── Stock info helpers ─────────────────────────────────────────────────────
// Aggregates vendor-level stock into a single product-level view and supports
// the cheapest-vendor-first allocation model the cart and shop pages use.

export interface VendorStockAllocation {
  vendorId: string;
  vendorName: string;
  stock: number;
  landedCostPerUnit: number;
  basePrice: number;
  moq: number;
}

export interface ProductStockInfo {
  /** Sum of stock across every active vendor for this product. */
  totalStock: number;
  /** Vendors sorted cheapest landed-cost first (same order as computeVendorComparisons). */
  allocations: VendorStockAllocation[];
}

/** Return the total available stock and per-vendor breakdown for a product. */
export function getProductStockInfo(masterProductCode: string, productCategory?: string): ProductStockInfo {
  const comparisons = computeVendorComparisons(masterProductCode, productCategory);
  const allocations: VendorStockAllocation[] = comparisons
    .filter(r => r.stock > 0)
    .map(r => ({
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      stock: r.stock,
      landedCostPerUnit: r.landedCostPerUnit,
      basePrice: r.basePrice,
      moq: r.moq,
    }));
  return {
    totalStock: allocations.reduce((s, a) => s + a.stock, 0),
    allocations,
  };
}


export function getAllProductPricing(): ProductPricing[] {
  const catalog = getCatalogProducts();
  return catalog.map(p => {
    // Pass the product category so Tax Engine can apply category-specific vendor tax rates
    const comparisons = computeVendorComparisons(p.masterProductCode, p.category);
    const winner = comparisons[0] || null;
    return {
      masterProductCode: p.masterProductCode,
      productName: p.productName,
      sku: p.skuCode,
      category: p.category,
      vendorComparisons: comparisons,
      winningVendor: winner,
      landedCostPerUnit: winner ? winner.landedCostPerUnit : 0,
      moq: winner ? winner.moq : 0,
    };
  });
}

// ─── Client-side computation ────────────────────────────────────────────────

export interface ClientPriceCalc {
  perUnitTotal: number;
  subtotal: number;
  profit: number;
  discount: number;
  /** Final client selling price before GST. */
  preTaxFinalPrice: number;
  tax: number;
  finalPrice: number;
}

export function computeClientFinalPrice(
  landedCostPerUnit: number,
  settings: ClientCommonSettings,
  overrideProfitPct?: number,
  productCategory?: string,
): ClientPriceCalc {
  const s = settings;
  const effectiveProfitPct = overrideProfitPct ?? s.profitPct;
  const perUnitPct = s.perUnitCharges.reduce((sum, c) => sum + c.value, 0);
  const totalPct = s.overheadPct + perUnitPct;
  const perUnitTotal = (landedCostPerUnit * totalPct) / 100;
  const subtotal = landedCostPerUnit + perUnitTotal;
  const profit = (subtotal * effectiveProfitPct) / 100;
  // Profit margin is part of the Shop price. The client discount is applied
  // separately in Cart, alongside shipping/delivery and platform fees.
  const preDiscountFinalPrice = subtotal + profit;
  const discount = (preDiscountFinalPrice * s.discountPct) / 100;
  const preTaxFinalPrice = preDiscountFinalPrice;
  const taxBase = preTaxFinalPrice;
  // Tax always comes from the Tax Settings engine — never a local override.
  const effectiveTaxPct = getEffectiveTaxPctForCategory(productCategory || '');
  const tax = (taxBase * effectiveTaxPct) / 100;
  let finalPrice = preTaxFinalPrice + tax;
  if (s.roundOff === 'nearest') finalPrice = Math.round(finalPrice);
  else if (s.roundOff === 'up') finalPrice = Math.ceil(finalPrice);
  else if (s.roundOff === 'down') finalPrice = Math.floor(finalPrice);
  return { perUnitTotal, subtotal, profit, discount, preTaxFinalPrice, tax, finalPrice };
}

/** Compute the client-facing selling price before GST for a selected vendor. */
export function computeClientSellingPriceExclGst(
  clientId: string,
  masterProductCode: string,
  productCategory: string,
  landedCostPerUnit: number,
): number {
  const calc = computeClientFinalPrice(
    landedCostPerUnit,
    getClientCommonSettings(clientId),
    resolveClientProfitPct(clientId, masterProductCode, productCategory),
    productCategory,
  );
  return Math.max(0, calc.preTaxFinalPrice);
}

// Since pricing settings are now configured per-client, each row represents
// one (client, product-in-that-client's-catalog) pair with its own calc.
export interface ClientPricingRow {
  clientId: string;
  clientName: string;
  masterProductCode: string;
  productName: string;
  sku: string;
  category: string;
  clientProductCode: string;
  vendorComparisons: VendorComparisonRow[];
  winningVendor: VendorComparisonRow | null;
  landedCostPerUnit: number;
  calc: ClientPriceCalc | null;
}

export function getAllClientPricing(): ClientPricingRow[] {
  const clients = getClients();
  const productPricing = getAllProductPricing();
  const pricingByCode = new Map(productPricing.map(p => [p.masterProductCode, p]));
  const rows: ClientPricingRow[] = [];

  clients.forEach(c => {
    const catalog = getClientCatalog(c.id);
    const settings = getClientCommonSettings(c.id);
    catalog.forEach(entry => {
      const pp = pricingByCode.get(entry.productCode);
      if (!pp) return;
      const calc = pp.winningVendor
        ? computeClientFinalPrice(
            pp.landedCostPerUnit,
            settings,
            resolveClientProfitPct(c.id, pp.masterProductCode, pp.category),
            pp.category,
          )
        : null;
      rows.push({
        clientId: c.id,
        clientName: c.name,
        masterProductCode: pp.masterProductCode,
        productName: pp.productName,
        sku: pp.sku,
        category: pp.category,
        clientProductCode: entry.cpc || '—',
        vendorComparisons: pp.vendorComparisons,
        winningVendor: pp.winningVendor,
        landedCostPerUnit: pp.landedCostPerUnit,
        calc,
      });
    });
  });

  return rows;
}

// Push every computed final price into the corresponding client catalog
// entry. Returns the number of entries updated.
export function syncAllPricesToClientCatalogs(): number {
  const rows = getAllClientPricing();
  let updated = 0;

  rows.forEach(row => {
    if (!row.calc) return;
    const fmtPrice =
      '₹' + row.calc.finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const catalog = getClientCatalog(row.clientId);
    const entry = catalog.find(e => e.productCode === row.masterProductCode);
    if (entry && entry.priceNum !== row.calc.finalPrice) {
      updateClientCatalogProductPrice(row.clientId, row.masterProductCode, fmtPrice, row.calc.finalPrice);
      updated++;
    }
  });

  return updated;
}

// ─── Retail Market Prices ───────────────────────────────────────────────────
// Global per-product retail (market) prices used by Market Price Validation.
// Stored as a flat map: masterProductCode → retail price (number).

const RETAIL_MARKET_PRICES_KEY = 'nido_retail_market_prices';

export function getRetailMarketPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RETAIL_MARKET_PRICES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function saveRetailMarketPrices(prices: Record<string, number>): void {
  localStorage.setItem(RETAIL_MARKET_PRICES_KEY, JSON.stringify(prices));
  window.dispatchEvent(new Event('priceEngineSettingsUpdated'));
}

// Recompute and push selling prices for a single client only, using that
// client's own pricing settings. Called whenever a client's catalog is
// viewed or that client's Pricing Settings are changed, so the selling
// price shown always reflects the latest per-client charges — without
// touching any other client's catalog.
export function syncClientPrices(clientId: string): number {
  const productPricing = getAllProductPricing();
  const pricingByCode = new Map(productPricing.map(p => [p.masterProductCode, p]));
  const settings = getClientCommonSettings(clientId);
  const catalog = getClientCatalog(clientId);
  let updated = 0;

  // Mutate the catalog array in one pass, then write once to avoid firing
  // 'clientCatalogUpdated' for every individual product change.
  const updatedCatalog = catalog.map(entry => {
    const pp = pricingByCode.get(entry.productCode);
    if (!pp || !pp.winningVendor) return entry;
    const calc = computeClientFinalPrice(
      pp.landedCostPerUnit,
      settings,
      resolveClientProfitPct(clientId, pp.masterProductCode, pp.category),
      pp.category,
    );
    if (entry.priceNum === calc.finalPrice) return entry;
    updated++;
    const price =
      '₹' + calc.finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return { ...entry, price, priceNum: calc.finalPrice };
  });

  if (updated > 0) {
    // Write the whole catalog in one shot → single 'clientCatalogUpdated' event
    // instead of one event per changed product.
    saveClientCatalog(clientId, updatedCatalog);
  }

  return updated;
}
