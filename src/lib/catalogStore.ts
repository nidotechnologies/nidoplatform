import { getPrefix } from './configService';

export interface CatalogSpec {
  id: string;
  specification: string;
  value: string;
  unit: string;
}

export interface GeneralSpec {
  id: string;
  category: string;
  attributeValue: string;
}

export interface CatalogVariationOption {
  id: string;
  label: string;
  priceAdjustment: number;
}

export interface CatalogVariation {
  id: string;
  name: string;
  options: CatalogVariationOption[];
}

export interface CatalogProduct {
  id: string;
  masterProductCode: string;
  skuCode: string;
  productName: string;
  productType: string;
  physicalType: string;
  category: string;
  subcategory: string;
  brand: string;
  tags: string[];
  description: string;
  specifications: CatalogSpec[];
  generalSpecs: GeneralSpec[];
  /** Cloud/service variation fields configured by an administrator. */
  variations?: CatalogVariation[];
  productNotes: string;
  videoUrl: string;
  images: string[];
  publishStatus: 'draft' | 'published' | 'pending' | 'archived';
  price: number;
  moq: number;
  leadTime: string;
  warranty: string;
}

/** Product names are unique in the master catalog, regardless of case or extra spacing. */
export function normalizeCatalogProductName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function findCatalogProductByName(productName: string, excludeId?: string): CatalogProduct | undefined {
  const normalizedName = normalizeCatalogProductName(productName);
  if (!normalizedName) return undefined;
  return getCatalogProducts().find(product =>
    (excludeId === undefined || String(product.id) !== String(excludeId)) &&
    normalizeCatalogProductName(product.productName) === normalizedName
  );
}

const STORE_KEY = 'nido_catalog_products';
const COUNTER_KEY = 'nido_mpc_counter';
const SEED_KEY = 'nido_catalog_seeded';

// Remove any previously seeded mock products so the catalog starts clean.
function clearSeedData(): void {
  try {
    if (localStorage.getItem(SEED_KEY)) {
      const existing: CatalogProduct[] = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      const cleaned = existing.filter((p) => !p.id.startsWith('seed-'));
      localStorage.setItem(STORE_KEY, JSON.stringify(cleaned));
      localStorage.removeItem(SEED_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

clearSeedData();

export function getCatalogProducts(): CatalogProduct[] {
  try {
    const products = JSON.parse(localStorage.getItem(STORE_KEY) || '[]') as CatalogProduct[];
    return products.map(product => ({
      ...product,
      physicalType: product.physicalType?.trim() || 'Physical Product',
      variations: Array.isArray(product.variations) ? product.variations : [],
    }));
  } catch {
    return [];
  }
}

/** Returns sorted unique category names from the master catalog. */
export function getMasterCatalogCategories(): string[] {
  const products = getCatalogProducts();
  const seen = new Set<string>();
  for (const p of products) {
    if (p.category && p.category.trim()) seen.add(p.category.trim());
  }
  return Array.from(seen).sort();
}

export function saveCatalogProduct(
  product: CatalogProduct,
  options: { skipDuplicateCheck?: boolean } = {},
): boolean {
  const products = getCatalogProducts();
  const idx = products.findIndex(p => String(p.id) === String(product.id));
  if (!options.skipDuplicateCheck) {
    const duplicate = products.find(p =>
      String(p.id) !== String(product.id) &&
      normalizeCatalogProductName(p.productName) === normalizeCatalogProductName(product.productName)
    );
    if (duplicate) return false;
  }

  if (idx >= 0) {
    products[idx] = product;
  } else if (!options.skipDuplicateCheck) {
    products.push(product);
  } else {
    return false;
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event('catalogUpdated'));

  // ── Propagate master catalog changes downstream ──────────────────────────
  // We use raw localStorage reads here (no imports from other stores) to avoid
  // circular-dependency issues. Only the snapshot fields that originate from
  // the master catalog are overwritten; vendor-specific / client-specific fields
  // (price, moq, leadTime, stock, roles, preference, etc.) are left untouched.

  // 1. Vendor products — matched by id (= catalog product id)
  try {
    const VENDOR_KEY = 'nido_vendor_products';
    const vendorStore: Record<string, Record<string, unknown>[]> =
      JSON.parse(localStorage.getItem(VENDOR_KEY) || '{}');
    let vendorChanged = false;
    for (const vendorId of Object.keys(vendorStore)) {
      vendorStore[vendorId] = vendorStore[vendorId].map((p) => {
        if (p.id !== product.id) return p;
        vendorChanged = true;
        return {
          ...p,
          masterProductCode: product.masterProductCode,
          skuCode:           product.skuCode,
          productName:       product.productName,
          category:          product.category,
          brand:             product.brand,
           physicalType:      product.physicalType,
          images:            product.images,
        };
      });
    }
    if (vendorChanged) {
      localStorage.setItem(VENDOR_KEY, JSON.stringify(vendorStore));
      window.dispatchEvent(new Event('vendorProductsUpdated'));
    }
  } catch { /* never block the save */ }

  // 2. Client catalogs — matched by productCode (= masterProductCode)
  try {
    const CLIENT_KEY = 'nido_client_catalogs';
    const clientStore: Record<string, Record<string, unknown>[]> =
      JSON.parse(localStorage.getItem(CLIENT_KEY) || '{}');

    // Pre-format specs so we don't repeat the work per client
    const specs: string[] = (product.specifications ?? []).map(
      (s) => `${s.specification}: ${s.value}${s.unit ? ' ' + s.unit : ''}`.trim()
    );
    const generalSpecs: { label: string; value: string }[] = (product.generalSpecs ?? []).map(
      (s) => ({ label: s.category, value: s.attributeValue })
    );

    let clientChanged = false;
    for (const clientId of Object.keys(clientStore)) {
      clientStore[clientId] = clientStore[clientId].map((e) => {
        if (e.productCode !== product.masterProductCode) return e;
        clientChanged = true;
        return {
          ...e,
          productCode:  product.masterProductCode,
          sku:          product.skuCode,
          name:         product.productName,
          category:     product.category,
          subcategory:  product.subcategory,
          brand:        product.brand,
          tags:         product.tags ?? [],
          productType:  product.productType,
          physicalType: product.physicalType,
          img:          product.images?.[0] ?? (e.img as string) ?? '',
          images:       product.images ?? [],
          description:  product.description,
          specs,
          generalSpecs,
          productNotes: product.productNotes,
          videoUrl:     product.videoUrl,
          warranty:     product.warranty,
          variations:   product.variations ?? [],
        };
      });
    }
    if (clientChanged) {
      localStorage.setItem(CLIENT_KEY, JSON.stringify(clientStore));
      window.dispatchEvent(new Event('clientCatalogUpdated'));
    }
  } catch { /* never block the save */ }

  return true;
}

export function deleteCatalogProduct(id: string): void {
  const products = getCatalogProducts().filter(p => p.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event('catalogUpdated'));
}

/**
 * Removes a master-catalog product from all downstream stores
 * (vendor product lists + client catalogs) when it is archived.
 * Matched by catalog product id in vendor store, and by masterProductCode in client store.
 */
export function removeArchivedProductFromDownstream(id: string, masterProductCode: string): void {
  // 1. Vendor products — remove entries whose id matches the catalog product id
  try {
    const VENDOR_KEY = 'nido_vendor_products';
    const vendorStore: Record<string, Record<string, unknown>[]> =
      JSON.parse(localStorage.getItem(VENDOR_KEY) || '{}');
    let vendorChanged = false;
    for (const vendorId of Object.keys(vendorStore)) {
      const before = vendorStore[vendorId].length;
      vendorStore[vendorId] = vendorStore[vendorId].filter((p) => p.id !== id);
      if (vendorStore[vendorId].length !== before) vendorChanged = true;
    }
    if (vendorChanged) {
      localStorage.setItem(VENDOR_KEY, JSON.stringify(vendorStore));
      window.dispatchEvent(new Event('vendorProductsUpdated'));
    }
  } catch { /* never block */ }

  // 2. Client catalogs — remove entries whose productCode matches masterProductCode
  try {
    const CLIENT_KEY = 'nido_client_catalogs';
    const clientStore: Record<string, Record<string, unknown>[]> =
      JSON.parse(localStorage.getItem(CLIENT_KEY) || '{}');
    let clientChanged = false;
    for (const clientId of Object.keys(clientStore)) {
      const before = clientStore[clientId].length;
      clientStore[clientId] = clientStore[clientId].filter((e) => e.productCode !== masterProductCode);
      if (clientStore[clientId].length !== before) clientChanged = true;
    }
    if (clientChanged) {
      localStorage.setItem(CLIENT_KEY, JSON.stringify(clientStore));
      window.dispatchEvent(new Event('clientCatalogUpdated'));
    }
  } catch { /* never block */ }

  return true;
}

export function generateMasterProductCode(): string {
  const prefix = getPrefix('masterProductCode') || 'MPC-';
  const year = new Date().getFullYear();
  const counter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return `${prefix}${year}-${String(counter).padStart(6, '0')}`;
}
