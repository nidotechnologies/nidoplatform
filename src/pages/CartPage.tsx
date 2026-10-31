import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Minus, Plus, ChevronLeft, ChevronRight,
  ShoppingCart, Lock, X, Phone, Mail, MessageCircle,
  CheckCircle2, RotateCcw, Headphones, BadgeCheck, ZoomIn, ImageOff,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { CartItem } from "@/contexts/CartContext";
import { releaseVendorReservation } from "@/lib/vendorStore";
import {
  getSlabDiscountPct,
  getClientCartPricingSettings,
  getAllProductPricing,
  getRecommendedVendor,
  type VendorStockAllocation,
} from "@/lib/priceEngineStore";
import { calculateCartPricing } from "@/lib/cartPricing";
import { getClientCatalog, type ClientCatalogEntry } from "@/lib/clientCatalogStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getEffectiveTaxPctForCategory, getProductCategoryTaxMap, getHsnCodes } from "@/lib/taxEngine";
import { getCartTaxRate, getCartUnitPriceExclGst, getCartUnitPriceInclusive } from "@/lib/vendorCartPricing";
import { useOrgConfig } from "@/contexts/ConfigContext";
import { useI18n } from "@/i18n/I18nProvider";

function CartProductImage({
  src,
  name,
  onPreview,
}: {
  src: string;
  name: string;
  onPreview: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const frameClass = "h-32 w-32 shrink-0 sm:h-36 sm:w-36";

  if (!src || failed) {
    return (
      <div
        className={`flex ${frameClass} items-center justify-center rounded-xl border border-gray-200 bg-slate-50`}
        role="img"
        aria-label={`No product image available for ${name}`}
      >
        <ImageOff size={28} className="text-gray-300" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPreview}
      aria-label={`View larger image of ${name}`}
      title="View larger image"
      className={`group relative flex ${frameClass} items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-slate-50 p-2 transition-shadow hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
      />
      <span className="absolute bottom-2 right-2 flex h-7 items-center gap-1 rounded-full bg-gray-900/80 px-2 text-[10px] font-medium text-white shadow-sm">
        <ZoomIn size={13} aria-hidden="true" />
        Enlarge
      </span>
    </button>
  );
}
import { formatCurrency } from "@/lib/formatters";
import ProductConfigurationSummary from "@/components/shared/ProductConfigurationSummary";
import { getProductSpecLines } from "@/lib/productConfiguration";
import {
  getProductType,
  getTenureBilling,
  isDigitalOnlyType,
  isHybridType,
} from "@/lib/productTypeRules";

function formatPrice(n: number) {
  return formatCurrency(n);
}

type CartProductTab = "physical" | "digital";

function getCartProductType(item: Pick<CartItem, "physicalType" | "productType" | "fulfillmentType">): string {
  return getProductType(
    item.physicalType
      || item.productType
      || (
        item.fulfillmentType === "digital"
          ? "Digital License"
          : item.fulfillmentType === "hybrid"
            ? "Hybrid Product"
            : "Physical Product"
      ),
  );
}

function cartTypeBadgeClasses(type: string): string {
  if (isDigitalOnlyType(type)) return "bg-violet-50 text-violet-700";
  if (isHybridType(type)) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

/** Pick up to 6 client-catalog products relevant to what's in the cart. */
function getSuggested(cartItems: CartItem[]): ClientCatalogEntry[] {
  const clientId = cartItems.find(i => i.clientId)?.clientId;
  if (!clientId) return [];
  const all = getClientCatalog(clientId);
  const cartCodes = new Set(cartItems.map(i => i.productCode).filter(Boolean));
  const cartCategories = new Set(cartItems.map(i => i.category).filter(Boolean));
  const notInCart = (p: ClientCatalogEntry) => !cartCodes.has(p.productCode);
  const sameCategory = all.filter(p => notInCart(p) && cartCategories.has(p.category));
  const others      = all.filter(p => notInCart(p) && !cartCategories.has(p.category));
  return [...sameCategory, ...others].slice(0, 6);
}

function QtyInput({
  value, moq, max, onChange, compact = false,
}: {
  value: number; moq: number; max?: number; onChange: (qty: number) => void; compact?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const min = Math.max(1, moq);
  const atMax = max !== undefined && max > 0 && value >= max;
  const commit = () => {
    const parsed = parseInt(draft, 10);
    let clamped = isNaN(parsed) || parsed < min ? min : parsed;
    if (max !== undefined && max > 0) clamped = Math.min(max, clamped);
    setDraft(String(clamped));
    onChange(clamped);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className={`${compact ? "w-6 h-7" : "w-8 h-8"} flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-r border-gray-300`}
        >
          <Minus size={12} />
        </button>
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === "Enter" && commit()}
          className={`${compact ? "w-9 text-xs py-1" : "w-14 text-sm py-1.5"} text-center font-semibold text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <button
          onClick={() => { if (!atMax) onChange(value + 1); }}
          disabled={atMax}
          className={`${compact ? "w-6 h-7" : "w-8 h-8"} flex items-center justify-center transition-colors border-l border-gray-300 ${atMax ? "bg-gray-50 text-gray-300 cursor-not-allowed" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}
        >
          <Plus size={12} />
        </button>
      </div>
      <p className="text-[10px] text-gray-400">Min. order {moq > 0 ? moq : 1}</p>
    </div>
  );
}

function SuggestedCard({
  product, clientId, productBasePath,
}: {
  product: ClientCatalogEntry;
  clientId?: string;
  productBasePath: string;
}) {
  const navigate = useNavigate();
  const image = product.img ?? "";
  const priceNum = product.priceNum ?? parseFloat(product.price) ?? 0;

  return (
    <div className="min-w-[190px] max-w-[190px] border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
      {image ? (
        <img src={image} alt={product.name} className="w-full h-28 object-cover bg-gray-100" />
      ) : (
        <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-300">
          <ShoppingCart size={28} />
        </div>
      )}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{product.category}</p>
        <p className="text-xs font-semibold text-gray-800 mb-1 line-clamp-2 leading-snug">{product.name}</p>
        <p className="text-sm font-bold text-gray-900 mb-2">
          {formatPrice(priceNum)}
          {priceNum > 0 && <span className="text-[11px] font-normal text-gray-500"> / each</span>}
        </p>
        <button
          onClick={() => navigate(`${productBasePath}/${product.productCode}`, { state: { product: { id: product.productCode, productCode: product.productCode, name: product.name, category: product.category, image: product.img || "", specs: product.specs || [], leadTime: product.leadTime || "", moq: product.moq ?? 1, priceNum, inStock: (product as any).totalStock !== 0 }, clientId } })}
          className="mt-auto flex items-center justify-center gap-1 text-xs font-semibold rounded-lg py-1.5 transition-colors bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
        >
          <ShoppingCart size={12} />
          View &amp; Select Vendor →
        </button>
      </div>
    </div>
  );
}

export default function CartPage() {
  useI18n();
  const { items: cart, updateQuantity: onUpdateQuantity, removeItem: onRemove, clearCart: onClear } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const isPortalFlow = location.pathname.startsWith("/portal/");
  const catalogPath = isPortalFlow ? "/portal/catalog" : "/shop";
  const productPath = isPortalFlow ? "/portal/shop/product" : "/shop/product";
  const checkoutPath = isPortalFlow ? "/portal/shop/checkout" : "/shop/checkout";
  const org = useOrgConfig();
  const [scrollIdx, setScrollIdx] = useState(0);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!imagePreview) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImagePreview(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [imagePreview]);

  type VendorInfo = {
    leadTime: string;
    moq: number;
    totalStock: number;
    allocations: VendorStockAllocation[];
    recommendedVendorId?: string;
  };
  const buildVendorMatchMap = (): Map<string, VendorInfo> => {
    const map = new Map<string, VendorInfo>();
    getAllProductPricing().forEach(p => {
      const days = p.winningVendor?.leadTime ?? 0;
      const displayDays = days > 0 ? days * 2 : 0;
      const allocations: VendorStockAllocation[] = p.vendorComparisons
        // Keep zero-stock vendors in the map so a selected vendor reaching
        // zero cannot fall back to its stale add-to-cart stock snapshot.
        .map(r => ({
          vendorId: r.vendorId,
          vendorName: r.vendorName,
          stock: r.stock,
          landedCostPerUnit: r.landedCostPerUnit,
          basePrice: r.basePrice,
          moq: r.moq,
        }));
      const totalStock = allocations.reduce((s, a) => s + a.stock, 0);
      map.set(p.masterProductCode, {
        leadTime: displayDays > 0 ? `${displayDays} Day${displayDays !== 1 ? "s" : ""}` : "",
        moq: p.winningVendor?.moq ?? 0,
        totalStock,
        allocations,
        recommendedVendorId: getRecommendedVendor(p.vendorComparisons)?.vendorId,
      });
    });
    return map;
  };

  const [vendorMatchMap, setVendorMatchMap] = useState<Map<string, VendorInfo>>(buildVendorMatchMap);

  useEffect(() => {
    const refresh = () => setVendorMatchMap(buildVendorMatchMap());
    window.addEventListener("vendorProductsUpdated", refresh);
    return () => window.removeEventListener("vendorProductsUpdated", refresh);
  }, []);

  const catalogMap = useMemo(() => {
    const map = new Map<string, { brand: string; sku: string }>();
    getCatalogProducts().forEach(p => {
      map.set(p.masterProductCode || p.skuCode || "", {
        brand: p.brand || "",
        sku: p.skuCode || "",
      });
    });
    return map;
  }, []);

  const enrich = (entries: ClientCatalogEntry[]): ClientCatalogEntry[] =>
    entries.map(e => {
      const vendor = vendorMatchMap.get(e.productCode);
      const moq        = vendor?.moq && vendor.moq > 0 ? vendor.moq : (e.moq && e.moq > 0 ? e.moq : 1);
      const leadTime   = vendor?.leadTime || e.leadTime || "";
      const totalStock = vendor?.totalStock ?? 0;
      return { ...e, moq, leadTime, totalStock };
    });

  const [suggested, setSuggested] = useState<ClientCatalogEntry[]>(() => enrich(getSuggested(cart)));

  useEffect(() => {
    setSuggested(enrich(getSuggested(cart)));
    const handler = () => setSuggested(enrich(getSuggested(cart)));
    window.addEventListener("clientCatalogUpdated", handler);
    return () => window.removeEventListener("clientCatalogUpdated", handler);
  }, [cart, vendorMatchMap]);

  const hsnByCategory = useMemo(() => {
    const map = new Map<string, string>();
    getHsnCodes().forEach(h => {
      if (h.status === "Active" && h.productCategory) map.set(h.productCategory.toLowerCase(), h.code);
    });
    getProductCategoryTaxMap().forEach(m => {
      if (m.defaultHsnCode && m.productCategory) map.set(m.productCategory.toLowerCase(), m.defaultHsnCode);
    });
    return map;
  }, []);

  const totalItems = cart.length;
  const physicalCartItems = useMemo(
    () => cart.filter((item) => !isDigitalOnlyType(getCartProductType(item))),
    [cart],
  );
  const digitalCartItems = useMemo(
    () => cart.filter((item) => isDigitalOnlyType(getCartProductType(item))),
    [cart],
  );
  const [productTab, setProductTab] = useState<CartProductTab>("physical");
  const visibleCart = productTab === "digital" ? digitalCartItems : physicalCartItems;

  useEffect(() => {
    if (productTab === "physical" && physicalCartItems.length === 0 && digitalCartItems.length > 0) {
      setProductTab("digital");
    } else if (productTab === "digital" && digitalCartItems.length === 0 && physicalCartItems.length > 0) {
      setProductTab("physical");
    }
  }, [digitalCartItems.length, physicalCartItems.length, productTab]);

  const cartPricing = calculateCartPricing(cart);
  const {
    slabs: gstSlabs,
    totalGst,
    preTaxSubtotal,
    clientDiscountAmount,
    platformFee,
    shippingDeliveryFee,
    preClientDiscountSubtotal: subtotal,
    grandTotal,
  } = cartPricing;

  const visibleCount = 4;
  const maxScroll = Math.max(0, suggested.length - visibleCount);

  // Parse spec string into label + value (e.g. "Display: 6.2\"" → { key: "Display", val: "6.2\"" })
  function parseSpec(s: string): { key: string; val: string } {
    const idx = s.indexOf(": ");
    return idx > -1 ? { key: s.slice(0, idx), val: s.slice(idx + 2) } : { key: s, val: "" };
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <p className="text-sm text-gray-500">Review your items before checkout</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-49px)]">

        {/* ── Left: Products + Trust badges + Suggestions ─ */}
        <div className="flex-1 min-w-0 p-3 sm:p-5 space-y-4">

          {/* ── Table ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {cart.length === 0 ? (
              <div className="py-20 text-center text-gray-400">
                <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium text-base">Your cart is empty</p>
                <button onClick={() => navigate(catalogPath)} className="mt-3 text-blue-600 text-sm hover:underline">
                  Continue shopping →
                </button>
              </div>
            ) : (
              <>
                {/* Product type tabs */}
                <div className="flex items-end gap-5 border-b border-gray-200 bg-white px-5 pt-3">
                  {([
                    ["physical", "Physical Products", physicalCartItems.length],
                    ["digital", "Digital Products", digitalCartItems.length],
                  ] as const).map(([tab, label, count]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setProductTab(tab)}
                      className={`border-b-2 pb-2.5 text-xs font-semibold transition-colors ${
                        productTab === tab
                          ? "border-blue-600 text-blue-700"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {label} <span className="ml-1 text-[10px] font-medium text-gray-400">({count})</span>
                    </button>
                  ))}
                </div>

                {visibleCart.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 text-sm">
                    No {productTab} products in your cart.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className={productTab === "digital" ? "min-w-[1180px]" : "min-w-[1040px]"}>
                      {/* Header mirrors Vendor Products for each product type. */}
                      <div
                        className={`grid border-b border-gray-200 bg-gray-50 py-3 ${productTab === "digital" ? "px-2 gap-1" : "px-5 gap-3"}`}
                        style={{
                          gridTemplateColumns: productTab === "digital"
                            ? "minmax(0, 2.55fr) minmax(0, .7fr) minmax(0, .9fr) minmax(0, 1.15fr) minmax(0, 1.1fr) minmax(0, .5fr) minmax(0, .9fr) minmax(0, .65fr)"
                            : "minmax(300px,1fr) 115px 125px 145px 80px 120px 72px",
                        }}
                      >
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight">Product</span>
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-tight">Type</span>
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center leading-tight">Price / Unit</span>
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center leading-tight">
                          {productTab === "digital" ? "Users / Licenses" : "Units / MOQ"}
                        </span>
                        {productTab === "digital" && (
                          <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center leading-tight">Tenure / Billing</span>
                        )}
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center leading-tight">GST</span>
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right leading-tight">Total</span>
                        <span className="min-w-0 break-words text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center leading-tight">Actions</span>
                      </div>

                      {visibleCart.map((item, idx) => {
                  const discountPct    = item.clientId ? getSlabDiscountPct(item.clientId, item.category || "", item.quantity) : 0;
                  const clientDiscountPct = item.clientId ? getClientCartPricingSettings(item.clientId).discountPct : 0;
                  const taxRate        = getCartTaxRate(item) ?? getEffectiveTaxPctForCategory(item.category || "");
                  const unitPriceExcl   = getCartUnitPriceExclGst(item, taxRate);
                  const vendorInclusivePrice = getCartUnitPriceInclusive(item, taxRate);
                  const slabPrice = discountPct > 0 ? vendorInclusivePrice * (1 - discountPct / 100) : vendorInclusivePrice;
                  const effectivePrice = clientDiscountPct > 0 ? slabPrice * (1 - clientDiscountPct / 100) : slabPrice;
                   const hasDiscount = discountPct > 0 || clientDiscountPct > 0;
                  const inclusiveTotal = effectivePrice * item.quantity;
                  const gstRate        = taxRate;
                  const preTaxUnit     = effectivePrice * 100 / (100 + gstRate);
                   const gstAmount      = inclusiveTotal - preTaxUnit * item.quantity;
                   // Keep the Shop selling price as the reference price. The
                   // discounted unit price is calculated separately below.
                   const originalUnit   = unitPriceExcl;
                  const catalog        = catalogMap.get(item.productCode || "");
                   const productType    = getCartProductType(item);
                   const isDigital      = isDigitalOnlyType(productType);
                   const stockInfo      = vendorMatchMap.get(item.productCode || "");
                   const selectedAllocation = item.selectedVendorId
                     ? stockInfo?.allocations.find(a => a.vendorId === item.selectedVendorId)
                     : undefined;
                   const liveRemaining  = item.selectedVendorId
                     ? (selectedAllocation?.stock ?? item.totalStock ?? 0)
                     : (stockInfo?.totalStock ?? item.totalStock ?? 0);
                   const stockDataKnown = item.selectedVendorId
                     ? selectedAllocation !== undefined || item.totalStock !== undefined
                     : stockInfo !== undefined;
                  const maxQty         = stockDataKnown ? item.quantity + liveRemaining : undefined;

                   const itemMoq = selectedAllocation?.moq && selectedAllocation.moq > 0
                     ? selectedAllocation.moq
                     : (item.moq > 0 ? item.moq : 1);
                   const tenureBilling = getTenureBilling(productType);

                  const specChips = getProductSpecLines(item.specs, item.configuration).slice(0, 5).map(parseSpec);

                   return (
                     <div key={item.id} className={`border-b border-gray-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-white"}`}>
                       <div
                          className={`grid py-5 items-start ${isDigital ? "px-2 gap-1" : "px-5 gap-3"}`}
                          style={{
                            gridTemplateColumns: isDigital
                              ? "minmax(0, 2.55fr) minmax(0, .7fr) minmax(0, .9fr) minmax(0, 1.15fr) minmax(0, 1.1fr) minmax(0, .5fr) minmax(0, .9fr) minmax(0, .65fr)"
                              : "minmax(300px,1fr) 115px 125px 145px 80px 120px 72px",
                          }}
                       >

                        {/* ── Product info ────────────────────────────── */}
                        <div className="flex gap-4 min-w-0 pr-2">
                          {/* Larger, contain-fitted images keep the full product visible. */}
                          <CartProductImage
                            key={item.image}
                            src={item.image}
                            name={item.name}
                            onPreview={() => setImagePreview({ src: item.image, alt: item.name })}
                          />

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                             {/* Name */}
                             <div className="flex items-start gap-2 mb-1">
                              <p className="font-bold text-gray-900 text-sm leading-snug">{item.name}</p>
                            </div>

                            {/* Vendor row */}
                            {item.selectedVendorName && (
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs text-gray-500">Vendor:</span>
                                <span className="text-xs font-semibold text-gray-800">{item.selectedVendorName}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  item.selectedVendorId && item.selectedVendorId === stockInfo?.recommendedVendorId
                                    ? "text-green-700 bg-green-100 border border-green-200"
                                    : "text-blue-700 bg-blue-100 border border-blue-200"
                                }`}>
                                  {item.selectedVendorId && item.selectedVendorId === stockInfo?.recommendedVendorId ? "Recommended" : "Selected"}
                                </span>
                              </div>
                            )}

                            {/* SKU + Category */}
                            <div className="flex items-center gap-3 mb-2">
                              {(catalog?.sku || item.productCode) && (
                                <span className="text-[11px] text-gray-500">
                                  <span className="font-medium text-gray-600">SKU:</span> {catalog?.sku || item.productCode}
                                </span>
                              )}
                              {item.category && (
                                <span className="text-[11px] text-gray-500">
                                  <span className="font-medium text-gray-600">Category:</span> {item.category}
                                </span>
                              )}
                            </div>
                            <ProductConfigurationSummary
                              configuration={item.configuration}
                              priceAdjustment={item.configurationPriceAdjustment}
                            />

                            {/* Spec chips */}
                            {specChips.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2.5">
                                {specChips.map((chip, ci) => (
                                  <div key={ci} className="flex flex-col items-center border border-gray-200 rounded-md px-2 py-1 bg-gray-50 min-w-[48px]">
                                    <span className="text-[11px] font-semibold text-gray-800 leading-tight">{chip.val || chip.key}</span>
                                    {chip.val && <span className="text-[9px] text-gray-400 leading-tight mt-0.5">{chip.key}</span>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Slab discount badge */}
                            {(discountPct > 0 || clientDiscountPct > 0) && (
                              <div className="mt-1.5">
                                <span className="text-[10px] font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5">
                                  {discountPct + clientDiscountPct}% discount applied
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                         {/* ── Product type ────────────────────────────── */}
                         <div className="pt-1">
                           <span className={`inline-flex max-w-[105px] rounded-md px-2 py-1.5 text-[10px] font-semibold leading-snug ${cartTypeBadgeClasses(productType)}`}>
                             {productType}
                           </span>
                         </div>

                        {/* ── Unit Price ──────────────────────────────── */}
                        <div className="flex flex-col items-center justify-start pt-1">
                            {hasDiscount && (
                            <p className="text-xs text-gray-400 line-through leading-tight">{formatPrice(originalUnit)}</p>
                          )}
                          <p className="text-sm font-bold text-gray-900">{formatPrice(preTaxUnit)}</p>
                          <p className="text-[10px] text-gray-400">/ Unit</p>
                        </div>

                         {/* ── Quantity / MOQ ──────────────────────────── */}
                        <div className="flex flex-col items-center justify-start pt-1">
                          <QtyInput
                            value={item.quantity}
                            moq={itemMoq}
                            max={maxQty}
                             compact={isDigital}
                            onChange={qty => onUpdateQuantity(item.id, qty)}
                          />
                        </div>

                         {/* ── Tenure / Billing ───────────────────────── */}
                         {isDigital && (
                           <div className="pt-1 space-y-1 text-xs">
                             <div className="font-semibold text-gray-800">{tenureBilling.tenure}</div>
                             <div className="text-gray-500">{tenureBilling.billing}</div>
                           </div>
                         )}

                        {/* ── GST % ───────────────────────────────────── */}
                        <div className="flex items-start justify-center pt-2">
                          <div className="text-center">
                            <span className="text-sm font-semibold text-gray-700">{gstRate}%</span>
                            <span className="block text-[10px] text-gray-400">{formatPrice(gstAmount)}</span>
                          </div>
                        </div>

                        {/* ── Total ───────────────────────────────────── */}
                        <div className="flex items-start justify-end pt-2">
                          <span className="text-sm font-bold text-gray-900">{formatPrice(inclusiveTotal)}</span>
                        </div>

                         {/* ── Actions ────────────────────────────────── */}
                         <div className="flex items-start justify-center pt-1">
                           <button
                             onClick={() => {
                               if (item.selectedVendorId && item.productCode) {
                                 releaseVendorReservation(item.selectedVendorId, item.productCode, item.quantity);
                               }
                               onRemove(item.id);
                             }}
                             aria-label={`Remove ${item.name}`}
                             className="shrink-0 w-7 h-7 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                           >
                             <X size={12} />
                           </button>
                         </div>
                      </div>
                    </div>
                  );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Trust Badges ───────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", title: "Secure Checkout", sub: "100% secure payments" },
                { icon: RotateCcw,    color: "text-orange-500", bg: "bg-orange-50", title: "Easy Returns",   sub: "Hassle-free returns" },
                { icon: Headphones,  color: "text-blue-600",  bg: "bg-blue-50",   title: "24/7 Support",   sub: "Always here to help" },
                { icon: BadgeCheck,  color: "text-blue-500",  bg: "bg-blue-50",   title: "Best Price Guarantee", sub: "Quality at best prices" },
              ].map(({ icon: Icon, color, bg, title, sub }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{title}</p>
                    <p className="text-[11px] text-gray-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── You may also like ──────────────────────────────────────── */}
          {suggested.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-4">You may also like</h2>
              <div className="relative">
                {scrollIdx > 0 && (
                  <button
                    onClick={() => setScrollIdx(i => Math.max(0, i - 1))}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <div className="overflow-hidden">
                  <div
                    className="flex gap-3 transition-transform duration-300"
                    style={{ transform: `translateX(-${scrollIdx * 186}px)` }}
                  >
                    {suggested.map(p => (
                      <SuggestedCard key={p.productCode} product={p} clientId={cart[0]?.clientId} productBasePath={productPath} />
                    ))}
                  </div>
                </div>
                {scrollIdx < maxScroll && (
                  <button
                    onClick={() => setScrollIdx(i => Math.min(maxScroll, i + 1))}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Order Summary ──────────────────────────────────────── */}
        <div className="w-full lg:w-80 lg:shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white p-5 space-y-5 lg:sticky lg:top-0 lg:h-fit min-h-0 lg:min-h-screen">

          {/* Order Summary */}
          <div>
            <h2 className="font-bold text-gray-900 text-lg mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal ({totalItems} Item{totalItems !== 1 ? "s" : ""})</span>
                <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              {clientDiscountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Client Discount</span>
                  <span className="font-semibold text-green-600">-{formatPrice(clientDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Total GST</span>
                <span className="font-semibold text-gray-900">{formatPrice(totalGst)}</span>
              </div>
              {shippingDeliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping / Delivery Fee</span>
                  <span className="font-semibold text-gray-900">{formatPrice(shippingDeliveryFee)}</span>
                </div>
              )}
              {platformFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform Fee</span>
                  <span className="font-semibold text-gray-900">{formatPrice(platformFee)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 mt-4 pt-4 mb-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 text-base">Grand Total</span>
                <span className="font-bold text-blue-600 text-xl">{formatPrice(grandTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Inclusive of all taxes</p>
            </div>
          </div>

          {/* Proceed to Checkout */}
          <button
            onClick={() => {
              if (totalItems > 0) navigate(checkoutPath);
            }}
            disabled={totalItems === 0}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:hover:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            <Lock size={14} />
            Proceed to Checkout
          </button>

          {/* We Accept */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2.5">We Accept</p>
            <div className="flex items-center gap-2">
              {/* VISA */}
              <div className="h-7 px-2 border border-gray-200 rounded flex items-center justify-center bg-white">
                <span className="text-[13px] font-black text-blue-800 tracking-tight italic">VISA</span>
              </div>
              {/* Mastercard */}
              <div className="h-7 px-1.5 border border-gray-200 rounded flex items-center justify-center bg-white gap-0.5">
                <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
                <div className="w-4 h-4 rounded-full bg-yellow-400 -ml-2" />
              </div>
              {/* RuPay */}
              <div className="h-7 px-2 border border-gray-200 rounded flex items-center justify-center bg-white">
                <span className="text-[11px] font-black text-blue-700 tracking-tight">RuPay</span>
              </div>
              {/* UPI */}
              <div className="h-7 px-2 border border-gray-200 rounded flex items-center justify-center bg-white">
                <span className="text-[11px] font-black tracking-tight">
                  <span className="text-green-600">U</span><span className="text-blue-600">P</span><span className="text-red-500">I</span>
                </span>
              </div>
            </div>
          </div>

          {/* Need Help */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-bold text-gray-900 mb-1">Need Help?</p>
            <p className="text-xs text-gray-500 mb-3">Our support team is here to help you.</p>
            <div className="space-y-2.5">
              <a href="tel:+918012345678" className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors">
                <Phone size={13} className="text-gray-400 shrink-0" />
                +91 80 1234 5678
              </a>
              <a href="mailto:support@nido-tech.com" className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 transition-colors">
                <Mail size={13} className="text-gray-400 shrink-0" />
                support@nido-tech.com
              </a>
              <button className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-blue-600 transition-colors">
                <span className="flex items-center gap-2">
                  <MessageCircle size={13} className="text-gray-400 shrink-0" />
                  Live Chat
                </span>
                <ChevronRight size={13} className="text-gray-400" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Product image: ${imagePreview.alt}`}
          onClick={() => setImagePreview(null)}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-6xl flex-col rounded-2xl bg-white p-2 shadow-2xl sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              aria-label="Close image preview"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow hover:bg-gray-100"
            >
              <X size={18} />
            </button>
            <img
              src={imagePreview.src}
              alt={imagePreview.alt}
              className="min-h-0 w-full flex-1 object-contain"
            />
            <p className="pt-3 text-center text-sm font-medium text-gray-700">{imagePreview.alt}</p>
          </div>
        </div>
      )}
    </div>
  );
}
