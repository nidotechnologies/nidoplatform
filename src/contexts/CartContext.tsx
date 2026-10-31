import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ProductCommercialTerms } from '@/lib/productCommercialTerms';
import { formatConfigurationLabel } from '@/lib/productConfiguration';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface StockAllocation {
  vendorId: string;
  vendorProductId: string;
  vendorName: string;
  allocated: number;
}

export type CartItem = {
  id: number;
  name: string;
  image: string;
  specs: string[];
  moq: number;
  /** Combined stock across all vendors at add-to-cart time. */
  totalStock: number;
  priceNum: number;
  quantity: number;
  clientId?: string;
  category?: string;
  productCode?: string;
  productType?: string;
  physicalType?: string;
  commercialTerms?: ProductCommercialTerms;
  fulfillmentType?: "physical" | "digital" | "hybrid";
  leadTime?: string;
  // ── Vendor snapshot — locked at add-to-cart time by client selection ──────
  selectedVendorId?: string;
  selectedVendorName?: string;
  /** Vendor's raw base price per unit (excl. logistics/tax). */
  vendorPrice?: number;
  /** Final client selling price per unit before GST, snapshotted at add-to-cart. */
  clientSellingPriceExclGst?: number;
  /** Exact vendor-side product code for the selected vendor. */
  vendorProductCode?: string;
  /** Fully-loaded landed cost per unit (incl. logistics, handling, tax). */
  landedCost?: number;
  /** GST rate % captured at time of add. */
  gstSnapshot?: number;
  /** HSN code captured at time of add. */
  hsnSnapshot?: string;
  /** Vendor rating (0-5) captured at time of add. */
  vendorRating?: number;
  /** Cloud/service configuration selected on the Shop card. */
  configuration?: Record<string, string>;
  /** Configuration surcharge/discount captured at time of add. */
  configurationPriceAdjustment?: number;
  /** Single-entry allocation record — kept for order-cancellation stock-release path. */
  vendorAllocations: StockAllocation[];
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'vendorAllocations'>, quantity?: number) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  /** Like clearCart but does NOT restore vendor stock — call this after a confirmed order. */
  consumeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'nido_cart_v1';

function getConfigurationKey(configuration?: Record<string, string>): string {
  if (!configuration) return '';
  return Object.entries(configuration)
    .map(([key, value]) => [formatConfigurationLabel(key).toLowerCase(), value] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function getCartStorageKey(user: { id?: string } | null): string {
  return `${CART_STORAGE_KEY}:${encodeURIComponent(user?.id || 'guest')}`;
}

function isDigitalCartItem(item: Pick<CartItem, 'fulfillmentType' | 'physicalType' | 'productType'>): boolean {
  const fulfillmentType = item.fulfillmentType?.trim().toLowerCase();
  if (fulfillmentType === 'digital') return true;
  if (fulfillmentType === 'physical' || fulfillmentType === 'hybrid') return false;

  const productType = `${item.physicalType || ''} ${item.productType || ''}`.toLowerCase();
  return productType.includes('digital')
    || productType.includes('license')
    || productType.includes('licence')
    || productType.includes('subscription')
    || productType.includes('saas')
    || productType.includes('cloud');
}

function loadCart(storageKey: string): CartItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => item && typeof item === 'object')
      .map(item => ({
        ...item,
        vendorAllocations: Array.isArray(item.vendorAllocations) ? item.vendorAllocations : [],
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { effectiveUser } = useAuth();
  const storageKey = getCartStorageKey(effectiveUser);
  const [items, setItems] = useState<CartItem[]>(() => loadCart(storageKey));
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  // Auth and impersonation can change after the provider first mounts. Load
  // that identity's cart rather than carrying another user's in-memory cart.
  useEffect(() => {
    setItems(loadCart(storageKey));
    setHydratedStorageKey(storageKey);
  }, [storageKey]);

  // Persist every cart mutation so a browser refresh does not empty the cart.
  // The hydration guard prevents a user switch from saving the previous user's
  // in-memory items into the new user's storage key.
  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Keep cart interactions working if browser storage is unavailable/full.
    }
  }, [items, storageKey, hydratedStorageKey]);

  // Keep another open tab/window in sync with this cart.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setItems(loadCart(storageKey));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const addItem = (
    product: Omit<CartItem, 'quantity' | 'vendorAllocations'>,
    quantity: number = Math.max(1, product.moq),
  ) => {
    const productIsDigital = isDigitalCartItem(product);
    const cartHasPhysical = items.some(item => !isDigitalCartItem(item));
    const cartHasDigital = items.some(item => isDigitalCartItem(item));

    if ((productIsDigital && cartHasPhysical) || (!productIsDigital && cartHasDigital)) {
      if (productIsDigital) {
        toast.warning(
          'Digital products cannot be added to a cart with physical products.',
          { description: 'Please add only physical products to this cart.' },
        );
      } else {
        toast.warning(
          'Physical products cannot be added to a cart with digital products.',
          { description: 'Please add only digital products to this cart.' },
        );
      }
      return;
    }

    setItems((prev) => {
      // Match by productCode + vendorId so the same product from different vendors is a separate line.
      const lineKey = `${product.productCode || product.id}__${product.selectedVendorId || ''}__${getConfigurationKey(product.configuration)}`;
      const existing = prev.find(
        (i) => `${i.productCode || i.id}__${i.selectedVendorId || ''}__${getConfigurationKey(i.configuration)}` === lineKey,
      );

      if (existing) {
        const newQty = existing.quantity + Math.max(0, quantity);
        const newAlloc: StockAllocation[] = product.selectedVendorId
          ? [{ vendorId: product.selectedVendorId, vendorProductId: '', vendorName: product.selectedVendorName || '', allocated: newQty }]
          : existing.vendorAllocations;
        return prev.map((i) =>
          `${i.productCode || i.id}__${i.selectedVendorId || ''}__${getConfigurationKey(i.configuration)}` === lineKey
            ? { ...i, quantity: newQty, vendorAllocations: newAlloc }
            : i,
        );
      }

      // New line — create allocation record for the client-selected vendor.
      const allocations: StockAllocation[] = product.selectedVendorId
        ? [{ vendorId: product.selectedVendorId, vendorProductId: '', vendorName: product.selectedVendorName || '', allocated: quantity }]
        : [];
      return [...prev, { ...product, quantity, vendorAllocations: allocations }];
    });
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const moqFloor = i.moq > 0 ? i.moq : 1;
        const rawQty = Math.max(moqFloor, quantity);
        if (rawQty === i.quantity) return i;
        const newAlloc: StockAllocation[] = i.selectedVendorId
          ? [{ vendorId: i.selectedVendorId, vendorProductId: '', vendorName: i.selectedVendorName || '', allocated: rawQty }]
          : i.vendorAllocations;
        return { ...i, quantity: rawQty, vendorAllocations: newAlloc };
      }),
    );
  };

  const clearCart = () => setItems([]);

  /** Clears the cart without restoring stock — call after a confirmed order. */
  const consumeCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, consumeCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
