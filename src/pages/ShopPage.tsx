import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, ShoppingCart, Check, ChevronDown, ChevronLeft, ChevronRight, X, Package, Shield, Clock, Printer, Wifi, FileText, Cpu, HardDrive, Monitor, Settings2, Timer, ZoomIn, Building2, Heart, Tag, Plus, Cloud, KeyRound, Repeat2, Layers3, LayoutGrid, List, ArrowDownAZ, UserRound } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import FloatingCartButton from "@/components/FloatingCartButton";
import { getClientCatalog, type ClientCatalogEntry } from "@/lib/clientCatalogStore";
import { getCatalogProducts, type CatalogVariation } from "@/lib/catalogStore";
import { getClients as getStoredClients } from "@/lib/clientStore";
import {
  getAllProductPricing,
  updateWinningVendorMoq,
  getSlabDiscountPct,
  getClientPriceSlabs,
  computeVendorComparisons,
  computeClientSellingPriceExclGst,
  getLandedCost,
  getVendorCommonSettings,
  canVendorFulfillMoq,
  getRecommendedVendor,
  getVendorComparisonBadge,
  type VendorComparisonRow,
} from "@/lib/priceEngineStore";
import { getProductTotalAvailableStock } from "@/lib/vendorStore";
import { getEffectiveTaxPctForCategory, getHsnCodes, getProductCategoryTaxMap } from "@/lib/taxEngine";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { formatConfigurationLabel } from "@/lib/productConfiguration";
import {
  formatLeadTimeByType,
  getAvailabilityByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  getTenureBilling,
} from "@/lib/productTypeRules";
import {
  getAvailabilityLabel,
  getProductCommercialTerms,
} from "@/lib/productCommercialTerms";
import {
  ORDER_REQUESTER_KEY,
  getOrderRequesterOptions,
  normalizeOrderRequester,
  type OrderRequesterValue,
} from "@/lib/orderRequester";
import { getPortalUsersByClient } from "@/lib/portalUserStore";

// ── Types ────────────────────────────────────────────────────────────────────

type Client = { id: string; name: string };

type Product = {
  id: string;
  productCode: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  productType?: string;
  physicalType?: string;
  image: string;
  images?: string[];
  specs: string[];
  leadTime: string;
  moq: number;
  /** Combined stock across all active vendors (0 = no vendor stock data). */
  totalStock: number;
  priceNum: number;
  inStock: boolean;
  fulfillmentType?: "physical" | "digital" | "hybrid";
  description?: string;
  generalSpecs?: { label: string; value: string }[];
  productNotes?: string;
  videoUrl?: string;
  warranty?: string;
  preference?: string;
  /** Active client-catalog roles allowed to order this product. */
  roles?: string[];
  variations?: CatalogVariation[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryColor(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("cloud") || c.includes("server")) return "text-blue-600";
  if (c.includes("it") || c.includes("hardware") || c.includes("tech")) return "text-blue-600";
  if (c.includes("office")) return "text-emerald-600";
  if (c.includes("pantry") || c.includes("food") || c.includes("beverage") || c.includes("consumable")) return "text-orange-600";
  if (c.includes("station") || c.includes("misc")) return "text-violet-600";
  if (c.includes("furniture")) return "text-amber-600";
  if (c.includes("network")) return "text-cyan-600";
  return "text-gray-600";
}

function getProductIcon(name: string, category: string) {
  const n = (name + category).toLowerCase();
  if (n.includes("server") || n.includes("rack") || n.includes("poweredge")) return <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"><HardDrive size={40} className="text-slate-400" /></div>;
  if (n.includes("laptop") || n.includes("latitude") || n.includes("notebook")) return <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"><Monitor size={40} className="text-blue-400" /></div>;
  if (n.includes("chair") || n.includes("office") || n.includes("ergonomic")) return <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"><Package size={40} className="text-gray-500" /></div>;
  if (n.includes("coffee") || n.includes("nescafe") || n.includes("pantry")) return <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center"><Package size={40} className="text-amber-500" /></div>;
  if (n.includes("print") || n.includes("laserjet") || n.includes("mfp")) return <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><Printer size={40} className="text-gray-500" /></div>;
  if (n.includes("water") || n.includes("bisleri") || n.includes("bottle")) return <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center"><Package size={40} className="text-cyan-400" /></div>;
  if (n.includes("storage")) return <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center"><HardDrive size={40} className="text-gray-500" /></div>;
  if (n.includes("notebook") || n.includes("station") || n.includes("book")) return <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center"><FileText size={40} className="text-zinc-400" /></div>;
  return <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center"><Package size={40} className="text-blue-400" /></div>;
}

function getSpecIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("print") || n.includes("scan") || n.includes("copy") || n.includes("function")) return <Printer size={18} className="text-blue-500" />;
  if (n.includes("speed") || n.includes("rate")) return <Timer size={18} className="text-blue-500" />;
  if (n.includes("connect") || n.includes("wifi") || n.includes("network")) return <Wifi size={18} className="text-blue-500" />;
  if (n.includes("paper") || n.includes("size") || n.includes("format")) return <FileText size={18} className="text-blue-500" />;
  if (n.includes("warrant") || n.includes("guarantee")) return <Shield size={18} className="text-blue-500" />;
  if (n.includes("processor") || n.includes("cpu") || n.includes("memory") || n.includes("ram")) return <Cpu size={18} className="text-blue-500" />;
  if (n.includes("storage") || n.includes("ssd") || n.includes("hdd")) return <HardDrive size={18} className="text-blue-500" />;
  if (n.includes("display") || n.includes("screen") || n.includes("resolution") || n.includes("monitor")) return <Monitor size={18} className="text-blue-500" />;
  return <Settings2 size={18} className="text-blue-500" />;
}

const PAGE_SIZE = 20;

function formatPrice(n: number) {
  if (!n || n === 0) return "Price on request";
  return formatCurrency(n, undefined, { decimals: 0 });
}
function formatLeadTime(t: string) { return t ? `${t} (Subject to Availability)` : "—"; }
function formatMoq(n: number) { return n > 0 ? String(n) : "—"; }

type VendorMatch = { leadTime: string; moq: number; totalStock: number; hasEligibleVendor: boolean };
type ShopTab = "all" | "physical" | "digital" | "subscription" | "cloud" | "hybrid";
type SortOption = "Popularity" | "Price: Low to High" | "Price: High to Low" | "Name";

const SHOP_TABS: { id: ShopTab; label: string; icon: typeof Package }[] = [
  { id: "all", label: "All Products", icon: Package },
  { id: "physical", label: "Physical Products", icon: Package },
  { id: "digital", label: "Digital Licenses", icon: KeyRound },
  { id: "subscription", label: "Subscriptions (SaaS)", icon: Repeat2 },
  { id: "cloud", label: "Cloud Services", icon: Cloud },
  { id: "hybrid", label: "Hybrid Products", icon: Layers3 },
];

function getShopProductKind(product: Pick<Product, "productType" | "physicalType" | "category" | "name">): Exclude<ShopTab, "all"> {
  const value = `${product.productType || ""} ${product.physicalType || ""} ${product.category || ""} ${product.name || ""}`.toLowerCase();
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("subscription") || value.includes("saas")) return "subscription";
  if (value.includes("cloud")) return "cloud";
  if (
    value.includes("digital") ||
    value.includes("license") ||
    value.includes("software") ||
    value.includes("service")
  ) return "digital";
  return "physical";
}

function isCloudServiceProduct(product: Pick<Product, "productType" | "physicalType">): boolean {
  return [product.productType, product.physicalType]
    .some(value => value?.trim().toLowerCase() === "cloud service");
}

function isConfigurableServiceProduct(product: Pick<Product, "productType" | "physicalType">): boolean {
  return [product.productType, product.physicalType].some(value => {
    const normalized = value?.trim().toLowerCase();
    return normalized === "cloud service"
      || normalized === "digital licence"
      || normalized === "digital license"
      || normalized === "subscription";
  });
}

function isDigitalProduct(product: Pick<Product, "productType" | "physicalType" | "category" | "name">): boolean {
  const kind = getShopProductKind(product);
  return kind === "digital" || kind === "subscription" || kind === "cloud";
}

function getShopProductLabel(kind: Exclude<ShopTab, "all">): string {
  const labels: Record<Exclude<ShopTab, "all">, string> = {
    physical: "Physical Product",
    digital: "Digital License",
    subscription: "Subscription",
    cloud: "Cloud Service",
    hybrid: "Hybrid Product",
  };
  return labels[kind];
}

function getShopProductIcon(kind: Exclude<ShopTab, "all">) {
  const Icon = SHOP_TABS.find(tab => tab.id === kind)?.icon || Package;
  return <Icon size={12} />;
}

type CloudDataField = {
  label: string;
  value: string;
  options: CloudOption[];
};

type CloudOption = {
  label: string;
  priceAdjustment: number;
};

function parseCloudOption(rawOption: string): CloudOption {
  const raw = rawOption.trim();
  if (!raw) return { label: "", priceAdjustment: 0 };

  // Catalogue variation prices are optional. Support common catalogue formats
  // such as "Mumbai (+₹500)", "Premium +500", and "Standard (₹0)".
  const pricedSuffix = raw.match(
    /(?:\(\s*)?([+-])?\s*(?:₹|INR|Rs\.?|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*(?:\))?\s*$/i,
  ) || raw.match(
    /(?:\(\s*|\s+)([+-])\s*(?:₹|INR|Rs\.?|USD|\$)?\s*([\d,]+(?:\.\d+)?)\s*(?:\))?\s*$/i,
  );

  if (!pricedSuffix) return { label: raw, priceAdjustment: 0 };

  const amount = Number(pricedSuffix[2].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return { label: raw, priceAdjustment: 0 };

  const label = raw
    .slice(0, pricedSuffix.index)
    .replace(/[\s([{:|–—-]+$/, "")
    .trim();

  return {
    label: label || raw,
    priceAdjustment: pricedSuffix[1] === "-" ? -amount : amount,
  };
}

function getCatalogVariationFields(product: Product): CloudDataField[] {
  const seen = new Set<string>();
  return (product.variations || []).flatMap(variation => {
    const options = (variation.options || []).map(option => ({
      label: option.label.trim(),
      priceAdjustment: Number(option.priceAdjustment) || 0,
    })).filter(option => option.label);
    const label = variation.name.trim();
    if (!label || !options.length || seen.has(label.toLowerCase())) return [];
    seen.add(label.toLowerCase());
    return [{
      label,
      value: options[0].label,
      options,
    }];
  });
}

function getCloudDataFields(product: Product): CloudDataField[] {
  const fields = getCatalogVariationFields(product);
  const seen = new Set(fields.map(field => field.label.toLowerCase()));

  const addField = (label: string, value: string) => {
    const cleanLabel = label.trim();
    const cleanValue = value.trim();
    if (!cleanLabel || !cleanValue) return;
    const key = cleanLabel.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const options = cleanValue
      .split(/\s*[|;]\s*/)
      .map(option => option.trim())
      .filter(Boolean)
      .map(parseCloudOption)
      .filter(option => option.label);
    fields.push({ label: cleanLabel, value: cleanValue, options });
  };

  (product.generalSpecs || []).forEach(spec => addField(spec.label, spec.value));
  (product.specs || []).forEach(spec => {
    const separator = spec.indexOf(":");
    if (separator > -1) {
      addField(spec.slice(0, separator), spec.slice(separator + 1));
    }
  });

  return fields;
}

function findCloudField(fields: CloudDataField[], terms: string[]): string {
  return fields.find(field => terms.some(term => field.label.toLowerCase().includes(term)))?.value || "";
}

function cloudFieldKey(field: CloudDataField, index: number): string {
  return `${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;
}

function getCloudConfigurationPriceAdjustment(
  fields: CloudDataField[],
  values: Record<string, string>,
): number {
  return fields.reduce((total, field, index) => {
    const selectedValue = values[cloudFieldKey(field, index)] ?? field.value;
    const selectedOption = field.options.find(option => option.label === selectedValue);
    return total + (selectedOption?.priceAdjustment || 0);
  }, 0);
}

function toStoredCloudConfiguration(
  fields: CloudDataField[],
  values: Record<string, string>,
): Record<string, string> {
  const configuration: Record<string, string> = {};
  fields.forEach((field, index) => {
    const baseLabel = field.label.trim() || `Option ${index + 1}`;
    const label = Object.prototype.hasOwnProperty.call(configuration, baseLabel)
      ? `${baseLabel} (${index + 1})`
      : baseLabel;
    configuration[label] = values[cloudFieldKey(field, index)] ?? field.options[0]?.label ?? field.value;
  });
  return configuration;
}

function haveSameCloudConfiguration(
  left: Record<string, string> | undefined,
  right: Record<string, string>,
): boolean {
  const normalize = (configuration: Record<string, string>) => Object.entries(configuration)
    .map(([label, value]) => [formatConfigurationLabel(label).toLowerCase(), value] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  const leftEntries = normalize(left || {});
  const rightEntries = normalize(right);
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

// getClientOrderedQtyMap and getPOdQtyMap removed — available stock is now
// calculated directly from physicalStock − reservedStock in vendorStore, so
// no manual order/PO scanning is needed here.

function getVendorMatchMap(): Map<string, VendorMatch> {
  const map = new Map<string, VendorMatch>();
  getAllProductPricing().forEach(p => {
    const winningVendor = getRecommendedVendor(p.vendorComparisons);
    const days = winningVendor?.leadTime ?? 0;
    const displayDays = days > 0 ? days * 2 : 0;
    // Use sum(physicalStock) − sum(reservedStock) across all vendors — the
    // same formula Stock Management uses — so the Shop always shows the
    // correct available qty even when one vendor's reservation exceeds its
    // physical stock (per-vendor clamping would over-report in that case).
    const totalStock = getProductTotalAvailableStock(p.masterProductCode);
    map.set(p.masterProductCode, {
      leadTime: displayDays > 0 ? `${displayDays} Day${displayDays !== 1 ? "s" : ""}` : "",
      moq: winningVendor?.moq ?? 0,
      totalStock,
      hasEligibleVendor: !!winningVendor,
    });
  });
  return map;
}

/** Returns a numeric sort key for a preference string.
 *  "Preference 1" → 1, "Preference 2" → 2, custom names → large number (alphabetical tiebreak),
 *  empty/undefined → Infinity (always last).
 */
function prefOrder(pref?: string): number {
  if (!pref || pref.trim() === "") return Infinity;
  const m = pref.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 10000 + pref.charCodeAt(0);
}

function entryToProduct(e: ClientCatalogEntry, vendorMatches: Map<string, VendorMatch>): Product {
  const match = vendorMatches.get(e.productCode);
  const master = getCatalogProducts().find(p => p.masterProductCode === e.productCode);
  const productType = master?.productType || e.productType;
  const physicalType = master?.physicalType || e.physicalType;
  const kind = getShopProductKind({
    productType,
    physicalType,
    category: master?.category || e.category,
    name: master?.productName || e.name,
  });
  const masterSpecs = master?.specifications
    ?.map(s => `${s.specification}: ${s.value}${s.unit && s.unit !== "-" ? ` ${s.unit}` : ""}`)
    .filter(Boolean);
  const masterGeneralSpecs = master?.generalSpecs
    ?.filter(s => s.category || s.attributeValue)
    .map(s => ({ label: s.category, value: s.attributeValue }));
  const totalStock = match?.totalStock ?? 0;
  // Build the images array: use stored array when available, else wrap single img
  const images = master?.images?.length
    ? master.images
    : e.images && e.images.length > 0
      ? e.images
      : e.img ? [e.img] : [];
  return {
    id: `client-${e.productCode}`,
    productCode: e.productCode,
    name: e.name,
    category: master?.category || e.category || "General",
    subcategory: master?.subcategory || e.subcategory,
    brand: master?.brand || e.brand,
    tags: master?.tags || e.tags || [],
    productType,
    physicalType,
    image: images[0] || "",
    images,
    specs: masterSpecs?.length ? masterSpecs : e.specs || [],
    leadTime: match?.leadTime || e.leadTime || "",
    moq: match?.moq ?? e.moq ?? 0,
    totalStock,
    priceNum: e.priceNum ?? 0,
    // Digital products are not constrained by physical stock or vendor MOQ.
    // They still require an active vendor relationship in the client catalog.
    inStock: kind !== "physical" && kind !== "hybrid"
      ? e.availability !== "Out of Stock" && match !== undefined
      : e.availability !== "Out of Stock" && (match === undefined || match.hasEligibleVendor),
    description: master?.description || e.description,
    generalSpecs: masterGeneralSpecs?.length ? masterGeneralSpecs : e.generalSpecs,
    productNotes: master?.productNotes || e.productNotes,
    videoUrl: master?.videoUrl || e.videoUrl,
    warranty: master?.warranty || e.warranty,
    preference: e.preference,
    roles: e.roles || [],
    // Digital variations are configured per vendor. Master-catalog variations
    // are intentionally not copied into Shop.
    variations: [],
  };
}

function loadClients(): Client[] {
  const stored = getStoredClients();
  return stored.map((c) => ({ id: c.id, name: c.name }));
}

// ── Product Detail Dialog ────────────────────────────────────────────────────

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoomStyle, setZoomStyle] = useState<{ backgroundPosition: string } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({ backgroundPosition: `${x}% ${y}%` });
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden cursor-zoom-in"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setZoomStyle(null)}
    >
      <img src={src} alt={alt} className={`w-full h-full object-contain transition-opacity duration-150 ${zoomStyle ? "opacity-0" : "opacity-100"}`} />
      {zoomStyle && (
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "220%",
            backgroundPosition: zoomStyle.backgroundPosition,
          }}
        />
      )}
    </div>
  );
}

function ProductDetailDialog({ product, open, onClose, onMoqChange, clientId, allProducts, onSelectProduct }: { product: Product | null; open: boolean; onClose: () => void; onMoqChange: (product: Product, newMoq: number) => void; clientId?: string; allProducts: Product[]; onSelectProduct: (p: Product) => void }) {
  const { items } = useCart();
  const { isImpersonating } = useAuth();
  const [qty, setQty] = useState(product?.moq ?? 1);
  const [qtyDraft, setQtyDraft] = useState(String(product?.moq ?? 1));
  const [editingMoq, setEditingMoq] = useState(false);
  const [moqDraft, setMoqDraft] = useState(String(product?.moq ?? 0));
  const [selectedImage, setSelectedImage] = useState<string>(product?.image ?? "");

  useEffect(() => { if (product) { const v = Math.max(1, product.moq); setQty(v); setQtyDraft(String(v)); } }, [product]);
  useEffect(() => { if (product) setMoqDraft(String(product.moq)); }, [product?.moq]);
  useEffect(() => { if (product) setSelectedImage(product.image ?? ""); }, [product?.id]);

  const dialogMaxQty = product ? (product.totalStock > 0 ? product.totalStock : undefined) : undefined;
  const isInCart = product
    ? items.some(item => item.productCode === product.productCode && item.clientId === clientId)
    : false;

  const commitDialogQty = () => {
    const min = Math.max(1, product?.moq ?? 1);
    const parsed = parseInt(qtyDraft, 10);
    let clamped = isNaN(parsed) || parsed < min ? min : parsed;
    if (dialogMaxQty !== undefined) clamped = Math.min(dialogMaxQty, clamped);
    setQty(clamped);
    setQtyDraft(String(clamped));
  };

  if (!product) return null;

  const dialogDiscountPct = clientId ? getSlabDiscountPct(clientId, product.category, qty) : 0;
  const dialogGstRate = getEffectiveTaxPctForCategory(product.category);
  // priceNum is GST-inclusive; convert to excl. GST for display
  const dialogBasePriceExcl = product.priceNum * 100 / (100 + dialogGstRate);
  const dialogEffectivePrice = dialogDiscountPct > 0
    ? dialogBasePriceExcl * (1 - dialogDiscountPct / 100)
    : dialogBasePriceExcl;

  const handleAdd = () => {
    // This legacy dialog must not bypass the vendor-selection requirement.
    // The live Shop flow opens ProductDetailPage, where the user selects one.
    if (isImpersonating || isInCart) return;
    onSelectProduct(product);
    onClose();
  };

  const specPairs = product.specs.map(s => {
    const idx = s.indexOf(': ');
    return idx > -1 ? { key: s.slice(0, idx), val: s.slice(idx + 2) } : { key: '', val: s };
  });

  const related = allProducts
    .filter(p => p.id !== product.id)
    .sort((a, b) => (a.category === product.category ? -1 : 0) - (b.category === product.category ? -1 : 0))
    .slice(0, 4);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* Breadcrumb header */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-blue-600 font-medium hover:underline shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Products
          </button>
          <ChevronRight size={14} className="text-gray-300 shrink-0" />
          <span className="text-gray-800 font-medium truncate">{product.name}</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="  px-2 py-2">

          {/* Top section: image + details + price */}
          <div className="flex gap-2">

            {/* Image column: thumbnail rail + main image */}
            <div className="w-[340px] shrink-0">
              <div className="flex gap-3">
                {/* Thumbnail rail */}
                {(product.images && product.images.length > 0) && (
                  <div className="flex flex-col gap-2 shrink-0">
                    {product.images.slice(0, 4).map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(img)}
                        className={`w-14 h-14 rounded-lg border-2 bg-gray-50 overflow-hidden flex items-center justify-center transition-all ${selectedImage === img ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-blue-300"}`}
                      >
                        <img src={img} alt={`${product.name} view ${i + 1}`} className="w-full h-full object-contain" />
                      </button>
                    ))}
                    {product.images.length > 4 && (
                      <button
                        onClick={() => setSelectedImage(product.images![4])}
                        className={`w-14 h-14 rounded-lg border-2 bg-gray-50 overflow-hidden flex items-center justify-center transition-all ${product.images.slice(4).includes(selectedImage) ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-blue-300"}`}
                      >
                        <span className="text-xs font-semibold text-gray-600">+{product.images.length - 4}</span>
                      </button>
                    )}
                  </div>
                )}
                {/* Main image */}
                <div className="flex-1 aspect-square rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
                  {selectedImage ? (
                    <ZoomableImage src={selectedImage} alt={product.name} />
                  ) : product.image ? (
                    <ZoomableImage src={product.image} alt={product.name} />
                  ) : (
                    getProductIcon(product.name, product.category)
                  )}
                </div>
              </div>
              {(selectedImage || product.image) && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 justify-center">
                  <ZoomIn size={12} /> Hover image to zoom
                </p>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 ${getCategoryColor(product.category)}`}>{product.category}</span>

              {product.description && (
                <p className="mt-4 text-sm text-gray-500 leading-relaxed ">{product.description}</p>
              )}

              {specPairs.length > 0 && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Specifications</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {specPairs.map((sp, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 border border-gray-200 rounded-xl bg-gray-50">
                        <div className="mt-0.5 shrink-0">{getSpecIcon(sp.key)}</div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-500 uppercase tracking-wide">{sp.key}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{sp.val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Price panel */}
            <div className="w-72 shrink-0">
              <div className="border border-gray-200 rounded-2xl p-2 sticky top-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Price (Excl. GST)</p>
                {dialogDiscountPct > 0 ? (
                  <>
                    <p className="text-sm text-gray-400 line-through mt-1">{formatPrice(dialogBasePriceExcl)}</p>
                    <p className="text-3xl font-bold text-green-600 mt-0.5">
                      {formatPrice(dialogEffectivePrice)}
                      {product.priceNum > 0 && <span className="text-sm font-normal text-gray-500"> / each</span>}
                    </p>
                    <p className="text-xs text-green-600 font-semibold mt-1">{dialogDiscountPct}% volume discount applied</p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {formatPrice(dialogBasePriceExcl)}
                    {product.priceNum > 0 && <span className="text-sm font-normal text-gray-500"> / each</span>}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">+ {dialogGstRate}% GST extra</p>

                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={() => { const v = Math.max(Math.max(1, product.moq), qty - 1); setQty(v); setQtyDraft(String(v)); }}
                    className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none shrink-0"
                  >−</button>
                  <input
                    type="number"
                    value={qtyDraft}
                    min={Math.max(1, product.moq)}
                    max={dialogMaxQty}
                    onChange={e => setQtyDraft(e.target.value)}
                    onBlur={commitDialogQty}
                    onKeyDown={e => e.key === "Enter" && commitDialogQty()}
                    className="flex-1 text-center font-bold text-base border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => { if (dialogMaxQty === undefined || qty < dialogMaxQty) { const v = qty + 1; setQty(v); setQtyDraft(String(v)); } }}
                    disabled={dialogMaxQty !== undefined && qty >= dialogMaxQty}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center text-lg leading-none shrink-0 ${dialogMaxQty !== undefined && qty >= dialogMaxQty ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                  >+</button>
                  <div className="flex flex-col text-xs text-gray-400 whitespace-nowrap">
                    <span>Min: {formatMoq(product.moq)}</span>
                    {dialogMaxQty !== undefined && <span>Max: {dialogMaxQty.toLocaleString("en-IN")}</span>}
                  </div>
                </div>
                {dialogMaxQty !== undefined && qty >= dialogMaxQty && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">
                    Maximum available stock reached ({dialogMaxQty.toLocaleString("en-IN")} units)
                  </p>
                )}

                <button
                  onClick={handleAdd}
                    disabled={!product.inStock || isInCart}
                    className={`w-full mt-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${!product.inStock ? "bg-gray-200 text-gray-400 cursor-not-allowed" : isInCart ? "bg-green-600 text-white cursor-default" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                >
                  {isInCart ? <Check size={16} /> : <ShoppingCart size={16} />}
                   {!product.inStock ? "Out of Stock" : isInCart ? "Added to Cart" : "Select a vendor first"}
                </button>

                <div className="mt-5 space-y-2.5 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package size={14} className="text-gray-400 shrink-0" />
                    {editingMoq ? (
                      <input
                        type="number"
                        min={1}
                        autoFocus
                        value={moqDraft}
                        onChange={e => setMoqDraft(e.target.value)}
                        onBlur={() => {
                          setEditingMoq(false);
                          const parsed = parseInt(moqDraft, 10);
                          if (!isNaN(parsed) && parsed > 0 && parsed !== product.moq) onMoqChange(product, parsed);
                          else setMoqDraft(String(product.moq));
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 h-6 text-sm border border-gray-300 rounded px-1"
                      />
                    ) : (
                      <button onClick={() => setEditingMoq(true)} className="hover:underline underline-offset-2 decoration-dotted">
                        MOQ: {product.moq > 0 ? `${product.moq} Units` : '—'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <span>Lead Time: {formatLeadTime(product.leadTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield size={14} className="text-gray-400 shrink-0" />
                    <span>Subject to Availability</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom section: General Specifications + Related Products */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-2 items-start">

            {/* General Specifications */}
            {product.generalSpecs && product.generalSpecs.length > 0 && (
              <div className="border border-gray-200 rounded-2xl p-2">
                <h3 className="text-base font-semibold text-gray-900 mb-4">General Specifications</h3>
                <div className="flex flex-col">
                  {product.generalSpecs.map((gs, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-100 last:border-0 py-2.5">
                      <span className="text-sm text-gray-500">{gs.label}</span>
                      <span className="text-sm font-medium text-gray-800">{gs.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Products */}
            {related.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Related Products</h3>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                  {related.map(rp => {
                    const rpDiscountPct = clientId ? getSlabDiscountPct(clientId, rp.category, Math.max(1, rp.moq)) : 0;
                    const rpGstRate = getEffectiveTaxPctForCategory(rp.category);
                    const rpBasePriceExcl = rp.priceNum * 100 / (100 + rpGstRate);
                    const rpPrice = rpDiscountPct > 0 ? rpBasePriceExcl * (1 - rpDiscountPct / 100) : rpBasePriceExcl;
                    const rpInCart = items.some(item => item.productCode === rp.productCode && item.clientId === clientId);
                    return (
                      <div
                        key={rp.id}
                        onClick={() => onSelectProduct(rp)}
                        className="border border-gray-200 rounded-xl p-2 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="w-full aspect-square rounded-lg bg-gray-50 overflow-hidden mb-2">
                          {rp.image ? (
                            <img src={rp.image} alt={rp.name} className="w-full h-full object-contain" />
                          ) : (
                            getProductIcon(rp.name, rp.category)
                          )}
                        </div>
                        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">{rp.name}</p>
                        <span className={`text-[11px] font-medium mt-1 ${getCategoryColor(rp.category)}`}>{rp.category}</span>
                        <p className="text-sm font-bold text-gray-900 mt-1.5">
                          {formatPrice(rpPrice)}
                          {rp.priceNum > 0 && <span className="text-[11px] font-normal text-gray-500"> / each</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">MOQ: {formatMoq(rp.moq)}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (rpInCart) return;
                            onSelectProduct(rp);
                          }}
                          disabled={rpInCart}
                          className={`mt-2 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                            rpInCart
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                              : "border-blue-200 text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          {rpInCart ? <Check size={12} /> : <ShoppingCart size={12} />}
                          {rpInCart ? "Added to Cart" : "View & Select Vendor"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function ServiceDetailsDialog({
  product,
  fields,
  configuration,
  open,
  onClose,
}: {
  product: Product;
  fields: CloudDataField[];
  configuration: Record<string, string>;
  open: boolean;
  onClose: () => void;
}) {
  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const [selectedImage, setSelectedImage] = useState(images[0] || "");

  useEffect(() => {
    if (open) setSelectedImage(images[0] || "");
  }, [open, product.productCode]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-end border-b border-gray-100 px-4 py-3">
          <button
            type="button"
            aria-label="Close service details"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid max-h-[78vh] grid-cols-1 gap-5 overflow-y-auto p-5 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0">
            <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                getProductIcon(product.name, product.category)
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    aria-label={`View product image ${index + 1}`}
                    onClick={() => setSelectedImage(image)}
                    className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white ${
                      selectedImage === image ? "border-blue-500" : "border-gray-200"
                    }`}
                  >
                    <img src={image} alt="" className="max-h-full max-w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">{product.name}</h2>
            {fields.length > 0 && (
              <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                {fields.map((field, index) => {
                  const value = configuration[cloudFieldKey(field, index)] ?? field.value;
                  return (
                    <div key={`${field.label}-${index}`} className="px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {field.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-800">{value || "—"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfiguredServiceProductCard({
  product,
  onPreview,
  clientId,
  isGrid,
}: {
  product: Product;
  onPreview: (p: Product) => void;
  clientId?: string;
  isGrid: boolean;
}) {
  const { addItem, items } = useCart();
  const { isImpersonating } = useAuth();
  const [vendorComps, setVendorComps] = useState<VendorComparisonRow[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorComparisonRow | null>(null);
  const [qty, setQty] = useState(1);
  const [configOpen, setConfigOpen] = useState(false);
  const [serviceDetailsOpen, setServiceDetailsOpen] = useState(false);
  const [configuration, setConfiguration] = useState<Record<string, string>>({});
  const [draftConfiguration, setDraftConfiguration] = useState<Record<string, string>>({});
  const serviceKind = getShopProductKind(product);
  const serviceLabel = getShopProductLabel(serviceKind);
  const ServiceIcon = serviceKind === "digital" ? KeyRound : serviceKind === "subscription" ? Repeat2 : Cloud;
  const providerLabel = serviceKind === "cloud"
    ? "Cloud Provider"
    : serviceKind === "digital"
      ? "License Provider"
      : "Subscription Provider";
  const vendorConfiguredProduct = selectedVendor
    ? { ...product, variations: selectedVendor.variations || [] }
    : { ...product, variations: [] };
  const dataFields = getCloudDataFields(vendorConfiguredProduct);
  const configurationFields = getCatalogVariationFields(vendorConfiguredProduct);
  const storedConfiguration = toStoredCloudConfiguration(configurationFields, configuration);
  const provider = product.brand || findCloudField(dataFields, ["cloud provider", "provider"]);
  const serviceType = product.subcategory || findCloudField(dataFields, ["service type", "service"]);
  const region = findCloudField(dataFields, ["region", "location"]);
  const deploymentModel = findCloudField(dataFields, ["deployment"]);
  const billingModel = findCloudField(dataFields, ["billing", "pricing model"]) || getPricingModel(product.physicalType || product.productType || serviceLabel);
  const pricingUnit = findCloudField(dataFields, ["pricing unit", "unit"]);
  const serviceStatus = findCloudField(dataFields, ["service status", "availability", "status"])
    || (product.inStock ? "Available" : "Unavailable");
  const configurationCount = configurationFields.length;
  const productType = getProductType(product.physicalType || product.productType);
  const gstRate = getEffectiveTaxPctForCategory(product.category);
  const hsnForCategory = (() => {
    const map = new Map<string, string>();
    getHsnCodes().forEach(h => {
      if (h.status === "Active" && h.productCategory) map.set(h.productCategory.toLowerCase(), h.code);
    });
    getProductCategoryTaxMap().forEach(m => {
      if (m.defaultHsnCode && m.productCategory) map.set(m.productCategory.toLowerCase(), m.defaultHsnCode);
    });
    return map.get((product.category || "").toLowerCase()) || "";
  })();

  useEffect(() => {
    const refreshVendors = () => {
      if (product.productCode) setVendorComps(computeVendorComparisons(product.productCode, product.category));
    };
    refreshVendors();
    window.addEventListener("vendorProductsUpdated", refreshVendors);
    return () => window.removeEventListener("vendorProductsUpdated", refreshVendors);
  }, [product.productCode, product.category]);

  useEffect(() => {
    setSelectedVendor(current => {
      if (!current) return current;
      return vendorComps.find(comp => comp.vendorId === current.vendorId) || null;
    });
  }, [vendorComps]);

  useEffect(() => {
    const initial = Object.fromEntries(
      configurationFields.map((field, index) => [
        cloudFieldKey(field, index),
        field.options[0]?.label || field.value,
      ]),
    );
    setConfiguration(initial);
    setDraftConfiguration(initial);
  }, [product.productCode, selectedVendor?.vendorId]);

  const isInCart = !!selectedVendor && items.some(item =>
    item.productCode === product.productCode
    && item.clientId === clientId
    && item.selectedVendorId === selectedVendor.vendorId
    && haveSameCloudConfiguration(item.configuration, storedConfiguration),
  );
  const configurationPriceAdjustment = getCloudConfigurationPriceAdjustment(configurationFields, configuration);
  const effectiveVendorPrice = selectedVendor
    ? Math.max(0, selectedVendor.basePrice + configurationPriceAdjustment)
    : 0;
  const effectiveVendorLandedCost = selectedVendor
    ? getLandedCost(
        effectiveVendorPrice,
        getVendorCommonSettings(selectedVendor.vendorId),
        product.category,
      )
    : 0;
  const effectiveBaseClientSellingPriceExclGst = selectedVendor && clientId
    ? computeClientSellingPriceExclGst(
        clientId,
        product.productCode,
        product.category,
        effectiveVendorLandedCost,
      )
    : 0;
  const clientSellingPriceExclGst = effectiveBaseClientSellingPriceExclGst;
  const draftConfigurationPriceAdjustment = getCloudConfigurationPriceAdjustment(configurationFields, draftConfiguration);
  const draftEffectiveVendorPrice = selectedVendor
    ? Math.max(0, selectedVendor.basePrice + draftConfigurationPriceAdjustment)
    : 0;
  const draftEffectiveVendorLandedCost = selectedVendor
    ? getLandedCost(
        draftEffectiveVendorPrice,
        getVendorCommonSettings(selectedVendor.vendorId),
        product.category,
      )
    : 0;
  const draftEstimatedPrice = selectedVendor && clientId
    ? computeClientSellingPriceExclGst(
        clientId,
        product.productCode,
        product.category,
        draftEffectiveVendorLandedCost,
      )
    : 0;
  const canUseVendor = (vendor: VendorComparisonRow) =>
    isDigitalProduct(product) || canVendorFulfillMoq(vendor);
  const canAdd = !isImpersonating && product.inStock && !!selectedVendor && canUseVendor(selectedVendor) && !isInCart;
  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canAdd || !selectedVendor) return;
    addItem(
      {
        id: Math.random() * 10000,
        name: product.name,
        image: product.image,
        specs: product.specs,
        moq: selectedVendor.moq,
        totalStock: selectedVendor.stock,
        priceNum: product.priceNum,
        clientId,
        category: product.category,
        productCode: product.productCode,
        productType: product.productType,
        physicalType: product.physicalType,
        commercialTerms: getProductCommercialTerms(productType, {
          moq: selectedVendor.moq,
          leadTime: selectedVendor.leadTime,
          stock: selectedVendor.stock,
        }),
        fulfillmentType: product.fulfillmentType,
        leadTime: formatLeadTimeByType(selectedVendor.leadTime, productType).primary,
        selectedVendorId: selectedVendor.vendorId,
        selectedVendorName: selectedVendor.vendorName,
        vendorProductCode: selectedVendor.vendorProductCode,
        vendorPrice: effectiveVendorPrice,
        clientSellingPriceExclGst,
        landedCost: effectiveVendorLandedCost,
        gstSnapshot: gstRate,
        hsnSnapshot: hsnForCategory,
        vendorRating: selectedVendor.rating,
        configuration: storedConfiguration,
        configurationPriceAdjustment,
      },
      Math.max(1, selectedVendor.moq, qty),
    );
  };

  const infoFields = [
    [providerLabel, provider],
    ["Product Category", product.category],
    ["Service Type", serviceType],
    ["Region Availability", region],
    ["Deployment Model", deploymentModel],
    ["Billing Model", billingModel],
    ["Pricing Unit", pricingUnit],
    ["Service Status", serviceStatus],
    ["Configurations", configurationCount > 0 ? `${configurationCount} available` : ""],
  ].filter(([, value]) => Boolean(value));

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition-shadow hover:shadow-md ${isGrid ? "min-h-[520px]" : "h-full"}`}
      onClick={() => onPreview(product)}
    >
      <div className="flex items-start justify-between gap-3 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ServiceIcon size={18} />
          </div>
          <div className="min-w-0">
            {provider && <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-blue-600">{provider}</p>}
            <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-gray-900">{product.name}</h3>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
          <ServiceIcon size={12} />
          {serviceLabel}
        </span>
      </div>

      <div className="mx-3 mt-3 flex h-[86px] items-center justify-center overflow-hidden rounded-xl border border-blue-50 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {product.image ? (
          <img src={product.image} alt={`${provider || serviceLabel} ${product.name}`} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
        ) : (
          <ServiceIcon size={38} className="text-blue-300" />
        )}
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold ${getCategoryColor(product.category)}`}>{product.category}</span>
          {serviceType && <span className="text-[10px] text-gray-400">· {serviceType}</span>}
        </div>
        {product.description && <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-gray-500">{product.description}</p>}
      </div>

      <div className="mx-3 mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-100 pt-3">
        {infoFields.slice(0, 8).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="truncate text-[9px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
            <p className={`mt-0.5 truncate text-[10px] font-semibold ${label === "Service Status" && value === "Unavailable" ? "text-red-600" : "text-gray-700"}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-gray-100 px-3 pt-3" onClick={event => event.stopPropagation()}>
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-gray-500">{providerLabel} / Vendor</label>
        <select
          value={selectedVendor?.vendorId || ""}
          onChange={event => {
            const vendor = vendorComps.find(comp => comp.vendorId === event.target.value) || null;
            setSelectedVendor(vendor && canUseVendor(vendor) ? vendor : null);
            if (vendor) setQty(Math.max(1, vendor.moq));
          }}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[11px] text-gray-700 outline-none transition-colors focus:border-blue-400"
        >
          <option value="">Select {providerLabel.toLowerCase()} / vendor</option>
          {vendorComps.map(vendor => (
            <option key={vendor.vendorId} value={vendor.vendorId} disabled={!canUseVendor(vendor)}>
              {vendor.vendorName}{!canUseVendor(vendor) ? " — unavailable" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 border-t border-gray-100 px-3 pt-3" onClick={event => event.stopPropagation()}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Price / Unit</p>
            <p className="mt-0.5 text-[16px] font-bold text-gray-900">
              {selectedVendor && clientSellingPriceExclGst > 0 ? formatCurrency(clientSellingPriceExclGst) : selectedVendor ? "Custom Quote" : "Select a vendor"}
            </p>
            <p className="text-[9px] text-gray-400">{billingModel}{selectedVendor && clientSellingPriceExclGst > 0 ? ` · GST ${gstRate}% added in cart` : ""}</p>
          </div>
          {selectedVendor && (
            <div className="flex items-center rounded-lg border border-gray-200">
              <button type="button" onClick={() => setQty(current => Math.max(1, selectedVendor.moq, current - 1))} className="px-2 py-1 text-gray-600 hover:bg-gray-50">−</button>
              <span className="min-w-7 text-center text-[11px] font-semibold text-gray-700">{qty}</span>
              <button type="button" onClick={() => setQty(current => current + 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-50">+</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 px-3 pb-3 pt-3" onClick={event => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => setServiceDetailsOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white py-2 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          View Services
        </button>
        <button
          type="button"
          onClick={() => {
            setDraftConfiguration({ ...configuration });
            setConfigOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <Settings2 size={12} />
          Configure
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={`col-span-2 flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-semibold transition-colors ${
            !canAdd
              ? "cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isInCart ? <Check size={13} /> : <ShoppingCart size={13} />}
          {isInCart ? "Added to Cart" : "Add to Cart"}
        </button>
      </div>

      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={() => setConfigOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">{provider || serviceLabel}</p>
                <h2 className="mt-0.5 text-base font-bold text-gray-900">Configure {product.name}</h2>
                <p className="mt-1 text-xs text-gray-500">Choose one option from each dropdown for this {serviceLabel.toLowerCase()}.</p>
              </div>
              <button type="button" aria-label="Close configuration" onClick={() => setConfigOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            {configurationFields.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {configurationFields.map((field, index) => {
                  const key = cloudFieldKey(field, index);
                  const value = draftConfiguration[key] ?? field.options[0]?.label ?? field.value;
                  return (
                    <label key={key} className="text-xs font-semibold text-gray-600">
                      <span className="flex items-center justify-between">
                        {field.label}
                        {field.options.some(option => option.priceAdjustment !== 0) && (
                          <span className="text-[10px] font-normal text-gray-400">price varies by option</span>
                        )}
                      </span>
                      <select
                        value={value}
                        onChange={event => setDraftConfiguration(current => ({ ...current, [key]: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-normal text-gray-700 outline-none focus:border-blue-400"
                      >
                        {field.options.length > 0 ? (
                          field.options.map(option => (
                            <option key={option.label} value={option.label}>
                              {option.label}{option.priceAdjustment > 0 ? ` (+${formatCurrency(option.priceAdjustment)})` : option.priceAdjustment < 0 ? ` (${formatCurrency(option.priceAdjustment)})` : ""}
                            </option>
                          ))
                        ) : (
                          <option value={field.value}>{field.value}</option>
                        )}
                      </select>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-gray-50 px-3 py-4 text-xs text-gray-500">This service has no additional configuration fields in the catalogue.</p>
            )}

            <div className="mt-5 flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Price / Unit</p>
                <p className="text-base font-bold text-gray-900">
                  {selectedVendor && draftEstimatedPrice > 0 ? formatCurrency(draftEstimatedPrice) : selectedVendor ? "Custom Quote" : "Select a vendor"}
                </p>
                {selectedVendor && draftConfigurationPriceAdjustment !== 0 && (
                  <p className={`text-[10px] ${draftConfigurationPriceAdjustment > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {draftConfigurationPriceAdjustment > 0 ? "+" : ""}{formatCurrency(draftConfigurationPriceAdjustment)} from configuration
                  </p>
                )}
              </div>
              <div className="flex gap-2">
              <button type="button" onClick={() => setConfigOpen(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => { setConfiguration({ ...draftConfiguration }); setConfigOpen(false); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Save Configuration</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ServiceDetailsDialog
        product={product}
        fields={configurationFields}
        configuration={configuration}
        open={serviceDetailsOpen}
        onClose={() => setServiceDetailsOpen(false)}
      />
    </div>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, onPreview, clientId, isGrid }: { product: Product; onPreview: (p: Product) => void; clientId?: string; isGrid: boolean }) {
  const { addItem, items } = useCart();
  const { isImpersonating } = useAuth();
  const [qty, setQty] = useState(1);
  const [qtyDraft, setQtyDraft] = useState("1");
  const [vendorComps, setVendorComps] = useState<VendorComparisonRow[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorComparisonRow | null>(null);
  const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
  const [vendorPanelAlign, setVendorPanelAlign] = useState<"left" | "right">("left");
  const [vendorSearch, setVendorSearch] = useState("");
  const [liked, setLiked] = useState(false);
  const vendorSelectionRef = useRef<HTMLDivElement>(null);
  const isDigital = isDigitalProduct(product);
  // Keep these labels in lockstep with Vendor Products so every product type
  // presents its commercial terms in the same way across the app.
  const productType = getProductType(product.physicalType || product.productType);
  const productPricingModel = getPricingModel(productType);
  const productQuantityLabel = getQuantityLabel(productType);
  const tenureBilling = getTenureBilling(productType);
  const canUseVendor = (vendor: VendorComparisonRow) => isDigital || canVendorFulfillMoq(vendor);
  const isInCart = !!selectedVendor && items.some(item =>
    item.productCode === product.productCode &&
    item.clientId === clientId &&
    item.selectedVendorId === selectedVendor.vendorId
  );

  useEffect(() => {
    const refreshVendors = () => {
      if (!product.productCode) return;
      setVendorComps(computeVendorComparisons(product.productCode, product.category));
    };
    refreshVendors();
    window.addEventListener("vendorProductsUpdated", refreshVendors);
    return () => window.removeEventListener("vendorProductsUpdated", refreshVendors);
  }, [product.productCode, product.category]);

  useEffect(() => {
    if (!selectedVendor) return;
    const refreshed = vendorComps.find(comp => comp.vendorId === selectedVendor.vendorId);
    if (!refreshed || !canUseVendor(refreshed)) {
      const defaultQty = Math.max(1, product.moq || 1);
      setSelectedVendor(null);
      setQty(defaultQty);
      setQtyDraft(String(defaultQty));
      return;
    }
    if (refreshed !== selectedVendor) setSelectedVendor(refreshed);
    const minimum = Math.max(1, refreshed.moq || 1);
    if (qty < minimum) {
      setQty(minimum);
      setQtyDraft(String(minimum));
    }
  }, [vendorComps, selectedVendor, qty, product.moq]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!vendorSelectionRef.current?.contains(event.target as Node)) {
        setVendorPanelOpen(false);
        setVendorSearch("");
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, []);

  const maxQty = selectedVendor
    ? (isDigital ? undefined : selectedVendor.stock > 0 ? selectedVendor.stock : undefined)
    : undefined;

  const recommendedVendor = isDigital
    ? (vendorComps[0] || null)
    : getRecommendedVendor(vendorComps);
  const termsVendor = selectedVendor ?? recommendedVendor;
  const commercialTerms = getProductCommercialTerms(productType, {
    moq: termsVendor?.moq ?? product.moq,
    leadTime: termsVendor?.leadTime ?? product.leadTime,
    stock: termsVendor?.stock ?? product.totalStock,
  });

  const cardGstRate = getEffectiveTaxPctForCategory(product.category);
  const clientSellingPriceExclGst = selectedVendor && clientId
    ? computeClientSellingPriceExclGst(
        clientId,
        product.productCode,
        product.category,
        selectedVendor.landedCostPerUnit,
      )
    : undefined;

  const hsnForCategory = (() => {
    const map = new Map<string, string>();
    getHsnCodes().forEach(h => { if (h.status === "Active" && h.productCategory) map.set(h.productCategory.toLowerCase(), h.code); });
    getProductCategoryTaxMap().forEach(m => { if (m.defaultHsnCode && m.productCategory) map.set(m.productCategory.toLowerCase(), m.defaultHsnCode); });
    return map.get((product.category || "").toLowerCase()) || "";
  })();

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isImpersonating) return;
    if (!product.inStock || isInCart || !selectedVendor || !canUseVendor(selectedVendor)) return;
    addItem(
      {
        id: Math.random() * 10000,
        name: product.name,
        image: product.image,
        specs: product.specs,
        moq: selectedVendor.moq,
        totalStock: selectedVendor.stock,
        priceNum: product.priceNum,
        clientId,
        category: product.category,
        productCode: product.productCode,
        productType: product.productType,
        physicalType: product.physicalType,
        commercialTerms: getProductCommercialTerms(productType, {
          moq: selectedVendor.moq,
          leadTime: selectedVendor.leadTime,
          stock: selectedVendor.stock,
        }),
        fulfillmentType: product.fulfillmentType,
        leadTime: formatLeadTimeByType(selectedVendor.leadTime, productType).primary,
        selectedVendorId: selectedVendor.vendorId,
        selectedVendorName: selectedVendor.vendorName,
        vendorProductCode: selectedVendor.vendorProductCode,
        vendorPrice: selectedVendor.basePrice,
        clientSellingPriceExclGst: clientId
          ? computeClientSellingPriceExclGst(
              clientId,
              product.productCode,
              product.category,
              selectedVendor.landedCostPerUnit,
            )
          : selectedVendor.basePrice,
        landedCost: selectedVendor.landedCostPerUnit,
        gstSnapshot: cardGstRate,
        hsnSnapshot: hsnForCategory,
        vendorRating: selectedVendor.rating,
      },
      Math.max(1, Math.max(selectedVendor.moq, qty))
    );
  };

  const canAdd = !isImpersonating && product.inStock && !!selectedVendor && canUseVendor(selectedVendor);

  // Filtered vendors by search
  const filteredVendors = vendorSearch
    ? vendorComps.filter(v => v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()))
    : vendorComps;

  // Display values
  const displayMoq = commercialTerms.moqLabel;
  const displayLeadTime = `${commercialTerms.leadTimePrimary}${commercialTerms.leadTimeSecondary ? ` · ${commercialTerms.leadTimeSecondary}` : ''}`;
  const displayPrice = clientSellingPriceExclGst > 0
    ? formatCurrency(clientSellingPriceExclGst)
    : '--';

  // First active slab with a non-zero discount that applies to this product's
  // category (category-specific slabs take priority over "All Products").
  const firstSlabHint: { discountPct: number; minQty: number } | null = (() => {
    if (!clientId) return null;
    const slabs = getClientPriceSlabs(clientId)
      .filter(s => s.status === 'Active' && s.discountPct > 0);
    if (slabs.length === 0) return null;
    const catSlabs = slabs.filter(s => s.applyTo !== 'All Products' && s.applyTo.toLowerCase() === (product.category || '').toLowerCase());
    const pool = catSlabs.length > 0 ? catSlabs : slabs.filter(s => s.applyTo === 'All Products');
    if (pool.length === 0) return null;
    const best = pool.slice().sort((a, b) => a.minQty - b.minQty)[0];
    return { discountPct: best.discountPct, minQty: best.minQty };
  })();

  return (
    <div
      className={`group relative flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isGrid ? "min-h-[520px]" : "h-full"} ${vendorPanelOpen ? "z-20" : ""}`}
      onClick={() => onPreview(product)}
    >
      {/* Top row: product type badge + Heart */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
          {getShopProductIcon(getShopProductKind(product))}
          {getShopProductLabel(getShopProductKind(product))}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <Heart size={14} className={liked ? "fill-red-500 text-red-500" : "text-gray-300"} />
        </button>
      </div>

      {/* Product image */}
      <div className="flex items-center justify-center px-3 py-2 h-[118px]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="w-full h-full overflow-hidden rounded-xl">
            {getProductIcon(product.name, product.category)}
          </div>
        )}
      </div>

      {/* Name + Category */}
      <div className="text-center px-3 pb-2 border-b border-gray-100 min-h-[52px]">
        <h3 className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
        <span className={`block mt-0.5 text-[11px] font-medium ${getCategoryColor(product.category)}`}>{product.category}</span>
      </div>

      {/* Vendor selector */}
      <div ref={vendorSelectionRef} className="relative px-3 pt-2" onClick={e => e.stopPropagation()}>
        <p className="text-[10px] text-gray-500 mb-1">Vendor</p>
        <button
          type="button"
          onClick={() => {
            if (!vendorPanelOpen) {
              const rect = vendorSelectionRef.current?.getBoundingClientRect();
              const panelWidth = Math.min(600, window.innerWidth - 24);
              setVendorPanelAlign(
                rect && rect.left + panelWidth > window.innerWidth - 16 ? "right" : "left",
              );
            }
            setVendorPanelOpen(o => !o);
          }}
          className="w-full flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-2 text-left hover:border-blue-300 transition-colors bg-white"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
            <Building2 size={13} className="text-blue-600" />
          </div>
          {selectedVendor ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-gray-900 truncate">{selectedVendor.vendorName}</span>
            </div>
          ) : (
            <span className="flex-1 text-[11px] font-medium text-gray-500">Select Vendor</span>
          )}
          <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform ${vendorPanelOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Vendor dropdown panel */}
        {vendorPanelOpen && (
          <div
            className={`absolute ${vendorPanelAlign === "right" ? "right-0" : "left-0"} top-[calc(100%+4px)] z-30 bg-white border border-gray-200 rounded-xl shadow-2xl shadow-gray-900/10 overflow-hidden`}
            style={{ width: "min(600px, calc(100vw - 24px))" }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-[12px] font-bold text-gray-800">Select Vendor</p>
            </div>
            {/* Search */}
            <div className="px-2 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-200">
                <Search size={11} className="text-gray-400 shrink-0" />
                <input
                  value={vendorSearch}
                  onChange={e => setVendorSearch(e.target.value)}
                  placeholder="Search vendor..."
                  onClick={e => e.stopPropagation()}
                  className="flex-1 text-[11px] bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>
            {/* Table header */}
            <div className="grid px-3 py-1.5 border-b border-gray-100 bg-gray-50" style={{ gridTemplateColumns: "2fr 1.7fr 1fr 1.25fr 1.25fr 1fr" }}>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Vendor</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Pricing Model</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Price</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">{isDigital ? "Provisioning" : "Stock"}</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">{isDigital ? "Tenure / Billing" : "Lead Time"}</span>
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">{isDigital ? "Users / Licenses" : "Units / MOQ"}</span>
            </div>
            {/* Vendor rows */}
            <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
              {filteredVendors.map(comp => {
                const isSelected = selectedVendor?.vendorId === comp.vendorId;
                const isOOS = !canUseVendor(comp);
                const badge = getVendorComparisonBadge(comp, vendorComps, canUseVendor);
                const availability = getAvailabilityByType(comp.stock, productType);
                const leadTime = formatLeadTimeByType(comp.leadTime, productType);
                const price = !isOOS && clientId
                  ? computeClientSellingPriceExclGst(
                      clientId,
                      product.productCode,
                      product.category,
                      comp.landedCostPerUnit,
                    )
                  : 0;
                return (
                  <button
                    key={comp.vendorId}
                    type="button"
                    disabled={isOOS}
                    onClick={e => {
                      e.stopPropagation();
                      if (!isOOS) {
                        setSelectedVendor(comp);
                        const nextQty = Math.max(1, comp.moq);
                        setQty(nextQty);
                        setQtyDraft(String(nextQty));
                        setVendorPanelOpen(false);
                        setVendorSearch("");
                      }
                    }}
                    className={`w-full grid items-center px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-blue-50' : isOOS ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                     style={{ gridTemplateColumns: "2fr 1.7fr 1fr 1.25fr 1.25fr 1fr" }}
                  >
                    {/* Vendor name */}
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                        <Building2 size={11} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${isOOS ? 'text-gray-400' : 'text-gray-800'}`}>{comp.vendorName}</p>
                        {badge && (
                          <span className={`inline-block text-[8px] font-bold px-1 py-0.5 rounded leading-none mt-0.5 ${
                            badge === "Recommended" ? "text-blue-700 bg-blue-100" :
                            badge === "Fastest" ? "text-emerald-700 bg-emerald-100" :
                            badge === "Best Price" ? "text-amber-700 bg-amber-100" :
                            "text-violet-700 bg-violet-100"
                          }`}>
                            {badge === "Recommended" && "★ "}{badge}
                          </span>
                        )}
                      </div>
                    </div>
                     {/* Pricing model */}
                     <span className="text-[10px] leading-tight text-gray-700">{productPricingModel}</span>
                    {/* Price */}
                    <span className="text-[10px] font-semibold text-gray-800">
                      {!isOOS && price > 0 ? formatCurrency(price, undefined, { decimals: 0 }) : '--'}
                    </span>
                      {/* Stock / provisioning */}
                      {isDigital ? (
                        <span className="text-[10px] leading-tight font-semibold text-emerald-600">
                          {leadTime.primary}
                          {leadTime.secondary && <span className="block text-[9px] font-medium text-gray-400">{leadTime.secondary}</span>}
                        </span>
                      ) : (
                        <span className={`text-[10px] leading-tight font-semibold ${
                          availability.status === 'Out of Stock' ? 'text-red-500' :
                          availability.status === 'Low Stock' ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {availability.primary}
                          <span className="block text-[9px] font-medium text-gray-400">
                            {availability.isUnlimited ? 'Instant' : availability.status}
                          </span>
                        </span>
                      )}
                      {/* Lead time / tenure */}
                      {isDigital ? (
                        <span className="text-[10px] leading-tight text-gray-700">
                          {tenureBilling.tenure}
                          <span className="block text-[9px] text-gray-400">{tenureBilling.billing}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] leading-tight text-gray-700">
                          {leadTime.primary}
                          {leadTime.secondary && <span className="block text-[9px] text-gray-400">{leadTime.secondary}</span>}
                        </span>
                      )}
                     {/* MOQ */}
                     <span className="text-[10px] text-gray-700">{comp.moq > 0 ? `${comp.moq} ${productQuantityLabel}` : '--'}</span>
                  </button>
                );
              })}
              {filteredVendors.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-gray-400">No vendors found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Details stay on the product page so cards remain compact. */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onPreview(product); }}
        className="mx-3 mt-2 flex items-center justify-between rounded-md px-1 py-1 text-left text-[10px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
        aria-label={`View key specifications for ${product.name}`}
      >
        <span>View key specifications</span>
        <ChevronRight size={12} />
      </button>

      {/* Client price is shown after vendor selection; GST is calculated in the cart. */}
      {selectedVendor && (
      <div className="px-3 pt-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <Tag size={10} className="text-gray-400 shrink-0" />
              <span className="font-medium">Price</span>
            </div>
            <p className="text-[15px] font-bold text-gray-900 mt-0.5">{displayPrice}</p>
          </div>
          <span className="text-[9px] text-gray-400 text-right">GST {cardGstRate}%<br />added in cart</span>
        </div>
      </div>
      )}

      {/* Commercial details are revealed only after a vendor is selected. */}
      {selectedVendor && (
      <div className="px-3 pt-2 border-t border-gray-100 space-y-1.5" onClick={e => e.stopPropagation()}>
        {/* Type-specific commercial terms, matching the Vendor Products table. */}
         <div className="grid grid-cols-2 gap-3">
           <div>
             <div className="flex items-center gap-1 text-[9px] text-gray-500">
               <Layers3 size={10} className="text-gray-400 shrink-0" />
               <span className="font-medium">Pricing Model</span>
             </div>
             <p className="text-[10px] font-semibold text-gray-800 mt-0.5 leading-tight">{commercialTerms.pricingModel}</p>
           </div>
          <div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500">
              <Package size={10} className="text-gray-400 shrink-0" />
               <span className="font-medium">{isDigital ? "Users / Licenses" : "Units / MOQ"}</span>
            </div>
             <p className="text-[11px] font-semibold text-gray-800 mt-0.5">{displayMoq}</p>
          </div>
           <div>
             <div className="flex items-center gap-1 text-[9px] text-gray-500">
               <Clock size={10} className="text-gray-400 shrink-0" />
               <span className="font-medium">{isDigital ? "Provisioning Time" : "Lead Time"}</span>
             </div>
             <p className="text-[10px] font-semibold text-gray-800 mt-0.5 leading-tight">{displayLeadTime}</p>
           </div>
             <div>
               <div className="flex items-center gap-1 text-[9px] text-gray-500">
                 <Package size={10} className="text-gray-400 shrink-0" />
                 <span className="font-medium">{isDigital ? "Tenure / Billing" : "Stock"}</span>
               </div>
               {isDigital ? (
                 <>
                   <p className="text-[11px] font-semibold mt-0.5 text-gray-800">{tenureBilling.tenure}</p>
                   <p className="text-[9px] font-medium leading-tight text-gray-400">{tenureBilling.billing}</p>
                 </>
               ) : (
                 <>
                   <p className={`text-[11px] font-semibold mt-0.5 ${commercialTerms.availabilityStatus === "Out of Stock" ? "text-red-600" : "text-emerald-600"}`}>
                     {commercialTerms.availabilityPrimary}
                   </p>
                   <p className="text-[9px] font-medium leading-tight text-gray-400">
                     {commercialTerms.availabilityIsUnlimited ? "Instant" : commercialTerms.availabilityStatus}
                   </p>
                   {termsVendor && termsVendor.stock > 0 && firstSlabHint && (
                     <p className="text-[9px] text-emerald-600 font-medium leading-tight">{firstSlabHint.discountPct}% off on {firstSlabHint.minQty}+ Units</p>
                   )}
                 </>
               )}
             </div>
        </div>

        {/* Quantity row */}
        {selectedVendor ? (
          <div className="flex items-end justify-end gap-2 pb-2">
            <div>
              <p className="text-[9px] text-gray-500 font-medium mb-1">Quantity</p>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => {
                    const v = Math.max(Math.max(1, selectedVendor.moq), qty - 1);
                    setQty(v);
                    setQtyDraft(String(v));
                  }}
                  className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 text-sm leading-none"
                >−</button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={Math.max(1, selectedVendor.moq)}
                  max={maxQty}
                  value={qtyDraft}
                  onChange={e => setQtyDraft(e.target.value)}
                  onBlur={() => {
                    const minQty = Math.max(1, selectedVendor.moq);
                    const parsed = parseInt(qtyDraft, 10);
                    const normalized = Math.min(maxQty ?? Number.MAX_SAFE_INTEGER, Math.max(minQty, Number.isFinite(parsed) ? parsed : minQty));
                    setQty(normalized);
                    setQtyDraft(String(normalized));
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                  }}
                  className="w-12 px-1 py-1.5 text-[11px] font-semibold text-gray-800 text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label={`Quantity for ${product.name}`}
                />
                <button
                  onClick={() => {
                    if (maxQty === undefined || qty < maxQty) {
                      const v = qty + 1;
                      setQty(v);
                      setQtyDraft(String(v));
                    }
                  }}
                  disabled={maxQty !== undefined && qty >= maxQty}
                  className={`px-2.5 py-1.5 text-sm leading-none ${maxQty !== undefined && qty >= maxQty ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                >+</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <Tag size={10} className="text-gray-400 shrink-0" />
              <span className="text-[9px] text-gray-500 font-medium">Price per Unit</span>
              <span className="text-[10px] font-semibold text-gray-800 ml-auto">--</span>
            </div>
          </>
        )}
      </div>
      )}

      {/* Add to Cart button */}
       <div className="mt-auto px-3 pb-3" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${
            !canAdd
              ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
             : isInCart
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
           {isInCart ? <Check size={13} /> : <ShoppingCart size={13} />}
           {isInCart ? 'Added to Cart' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}

function DigitalProductCard({ product, onPreview, clientId, isGrid }: { product: Product; onPreview: (p: Product) => void; clientId?: string; isGrid: boolean }) {
  const { items } = useCart();
  const { isImpersonating } = useAuth();
  const [liked, setLiked] = useState(false);
  const kind = getShopProductKind(product);
  const productType = getProductType(product.physicalType);
  const commercialTerms = getProductCommercialTerms(productType, {
    moq: product.moq,
    leadTime: product.leadTime,
    stock: product.totalStock,
  });
  const gstRate = getEffectiveTaxPctForCategory(product.category);
  const discountPct = clientId ? getSlabDiscountPct(clientId, product.category, Math.max(1, product.moq)) : 0;
  const basePriceExcl = product.priceNum * 100 / (100 + gstRate);
  const displayPrice = discountPct > 0 ? basePriceExcl * (1 - discountPct / 100) : basePriceExcl;
  const isInCart = items.some(item => item.productCode === product.productCode && item.clientId === clientId);
  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    // Digital products still have a vendor relationship. Never add one with
    // the catalog price; open the same vendor-selection flow as other items.
    if (isImpersonating || !product.inStock || isInCart) return;
    onPreview(product);
  };

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md ${isGrid ? "min-h-[520px]" : "h-full"}`}
      onClick={() => onPreview(product)}
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
          {getShopProductIcon(kind)}
          {getShopProductLabel(kind)}
        </span>
        <button
          type="button"
          aria-label={`Save ${product.name}`}
          onClick={event => { event.stopPropagation(); setLiked(value => !value); }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100"
        >
          <Heart size={15} className={liked ? "fill-red-500 text-red-500" : ""} />
        </button>
      </div>

      <div className="flex h-[110px] items-center justify-center px-5 py-2">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="h-full w-full overflow-hidden rounded-lg">{getProductIcon(product.name, product.category)}</div>
        )}
      </div>

      <div className="min-h-[52px] border-b border-gray-100 px-3 pb-2 text-center">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-gray-900">{product.name}</h3>
        <span className={`mt-0.5 block text-[11px] font-medium ${getCategoryColor(product.category)}`}>{product.category}</span>
      </div>

      <button
        type="button"
        onClick={event => { event.stopPropagation(); onPreview(product); }}
        className="mx-3 mt-2 flex items-center justify-between rounded-md px-1 py-1 text-left text-[10px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
        aria-label={`View key specifications for ${product.name}`}
      >
        <span>View key specifications</span>
        <ChevronRight size={12} />
      </button>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-3 pt-2.5 text-[10px] text-gray-500">
        <div>
          <span className="block">Pricing Model</span>
          <strong className="text-gray-700">{commercialTerms.pricingModel}</strong>
        </div>
        <div>
          <span className="block">MOQ / Min Qty</span>
          <strong className="text-gray-700">{commercialTerms.moqLabel}</strong>
        </div>
        <div>
          <span className="block">Lead Time / SLA</span>
          <strong className="text-gray-700">{commercialTerms.leadTimePrimary}{commercialTerms.leadTimeSecondary ? ` · ${commercialTerms.leadTimeSecondary}` : ""}</strong>
        </div>
        <div>
          <span className="block">Availability</span>
          <strong className="text-emerald-600">{getAvailabilityLabel(commercialTerms)}</strong>
        </div>
      </div>

      <div className="mt-auto px-3 pb-3 pt-2.5">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] text-gray-500">Price</p>
            <p className={`text-[17px] font-bold ${discountPct > 0 ? "text-emerald-600" : "text-gray-900"}`}>
              {formatPrice(displayPrice)}
              {product.priceNum > 0 && <span className="ml-1 text-[10px] font-normal text-gray-500">/ unit</span>}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">GST {gstRate}% added in cart</p>
          </div>
          <span className="text-[10px] font-medium text-emerald-600">{product.inStock ? "Available" : "Unavailable"}</span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isImpersonating || !product.inStock || isInCart}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[12px] font-semibold transition-colors ${
            isImpersonating || !product.inStock
              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
              : isInCart
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-blue-300 bg-white text-blue-600 hover:bg-blue-50"
          }`}
        >
           {isInCart ? <Check size={13} /> : <ShoppingCart size={13} />}
           {isInCart ? "Added to Cart" : product.inStock ? "Select Vendor" : "Unavailable"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const navigate = useNavigate();
  const { user, isClientPortalUser } = useAuth();
  useI18n();
  const [search, setSearch] = useState("");
  const [shopTab, setShopTab] = useState<ShopTab>("all");
  const [brand, setBrand] = useState("All Brands");
  const [sortBy, setSortBy] = useState<SortOption>("Popularity");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedClientId, setSelectedClientId] = useState<string>(
    () => (isClientPortalUser ? user?.clientId ?? "" : localStorage.getItem("nido_shop_selected_client") ?? "")
  );

  // Portal users only ever see their own assigned catalog — keep the
  // selected client pinned to their account even if it changes after mount.
  useEffect(() => {
    if (isClientPortalUser && user?.clientId && selectedClientId !== user.clientId) {
      setSelectedClientId(user.clientId);
    }
  }, [isClientPortalUser, user?.clientId]);
  const [category, setCategory] = useState("All Categories");
  const [availability, setAvailability] = useState("All");
  const [clientOpen, setClientOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const requesterStorageKey = isClientPortalUser && user?.id
    ? `${ORDER_REQUESTER_KEY}:${user.id}`
    : ORDER_REQUESTER_KEY;
  const [orderedBy, setOrderedBy] = useState<OrderRequesterValue>(() =>
    normalizeOrderRequester(localStorage.getItem(requesterStorageKey))
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [, setPortalUsersRevision] = useState(0);

  // Load clients on mount and re-load when the shared store updates
  useEffect(() => {
    setClients(loadClients());
    const onUpdate = () => setClients(loadClients());
    window.addEventListener('nidoClientsUpdated', onUpdate);
    return () => window.removeEventListener('nidoClientsUpdated', onUpdate);
  }, []);

  useEffect(() => {
    const refreshUsers = () => setPortalUsersRevision(value => value + 1);
    window.addEventListener("nidoPortalUsersUpdated", refreshUsers);
    return () => window.removeEventListener("nidoPortalUsersUpdated", refreshUsers);
  }, []);

  // Load client catalog whenever selectedClientId changes, merging in the
  // live winning-vendor Lead Time / MOQ from the Vendor Product List for every product.
  // Available stock is now physicalStock − reservedStock, maintained directly
  // in vendorStore. No order/PO scanning needed — the vendorProductsUpdated
  // event fires whenever reservedStock or physicalStock changes.
  const loadClientProducts = () => {
    if (!selectedClientId) { setCatalogProducts([]); return; }
    const entries = getClientCatalog(selectedClientId);
    const vendorMatches = getVendorMatchMap();
    setCatalogProducts(entries.map(e => entryToProduct(e, vendorMatches)));
  };

  useEffect(() => {
    loadClientProducts();
    const events = ['clientCatalogUpdated', 'vendorProductsUpdated', 'nidoVendorsUpdated', 'catalogUpdated', 'priceEngineSettingsUpdated'];
    events.forEach(ev => window.addEventListener(ev, loadClientProducts));
    return () => {
      events.forEach(ev => window.removeEventListener(ev, loadClientProducts));
    };
  }, [selectedClientId]);

  // Reset page on filter change
  const resetPage = () => setCurrentPage(1);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedClientUsers = selectedClientId
    ? getPortalUsersByClient(selectedClientId).filter(user => user.status === "active")
    : [];
  const orderRequesterOptions = getOrderRequesterOptions(selectedClientUsers);
  const selectedRequesterId = orderedBy.startsWith("client-user:")
    ? orderedBy.slice("client-user:".length)
    : "";
  const selectedRequester = selectedClientUsers.find(portalUser => portalUser.id === selectedRequesterId);
  const visibleCatalogProducts = orderedBy.startsWith("client-user:")
    ? selectedRequester
      ? catalogProducts.filter(product =>
        (product.roles || []).some(role =>
          role.trim().toLowerCase() === selectedRequester.role.trim().toLowerCase()
        )
        )
      : []
    : catalogProducts;
  const allCats = ["All Categories", ...Array.from(new Set(visibleCatalogProducts.map(p => p.category)))];
  const allBrands = ["All Brands", ...Array.from(new Set(visibleCatalogProducts.map(p => p.brand).filter(Boolean) as string[])).sort()];

  const closeFilterMenus = () => {
    setClientOpen(false);
    setSortOpen(false);
    setMoreFiltersOpen(false);
  };

  const handleOrderedByChange = (value: string) => {
    const normalized = normalizeOrderRequester(value);
    setOrderedBy(normalized);
    localStorage.setItem(requesterStorageKey, normalized);
    setCurrentPage(1);
  };

  const filtered = visibleCatalogProducts
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (shopTab !== "all" && getShopProductKind(p) !== shopTab) return false;
      if (category !== "All Categories" && p.category !== category) return false;
      if (brand !== "All Brands" && p.brand !== brand) return false;
      if (availability === "In Stock" && !p.inStock) return false;
      if (availability === "Out of Stock" && p.inStock) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Price: Low to High") return a.priceNum - b.priceNum;
      if (sortBy === "Price: High to Low") return b.priceNum - a.priceNum;
      return prefOrder(a.preference) - prefOrder(b.preference);
    });

  const totalProducts = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    localStorage.setItem("nido_shop_selected_client", id);
    setOrderedBy("self");
    localStorage.setItem(ORDER_REQUESTER_KEY, "self");
    setCategory("All Categories");
    setBrand("All Brands");
    setShopTab("all");
    setAvailability("All");
    setSearch("");
    setCurrentPage(1);
    closeFilterMenus();
  };

  const handleShopTabChange = (tab: ShopTab) => {
    setShopTab(tab);
    setCurrentPage(1);
  };

  const pageNums = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#fbfcfe] px-3 py-3 md:px-5">
      <FloatingCartButton />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shop</h1>
          <p className="mt-1 text-xs text-gray-500 md:text-sm">
            {selectedClient
              ? `Browse and order physical products, digital licenses, subscriptions, cloud services and more for ${selectedClient.name}.`
              : "Browse and order physical products, digital licenses, subscriptions, cloud services and more."}
          </p>
        </div>
        {!isClientPortalUser && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setClientOpen(o => !o); setSortOpen(false); setMoreFiltersOpen(false); }}
              className={`flex min-w-[180px] items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors md:text-sm ${
                clientOpen || selectedClientId
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Building2 size={14} className="shrink-0" />
              <span className="flex-1 truncate text-left">{selectedClient ? selectedClient.name : "Select Client"}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${clientOpen ? "rotate-180" : ""}`} />
            </button>
            {clientOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 max-h-64 min-w-[230px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {clients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleClientChange(c.id)}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
                      selectedClientId === c.id ? "bg-blue-50 font-medium text-blue-600" : "text-gray-700"
                    }`}
                  >
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-[10px] text-gray-400">{c.id}</span>
                  </button>
                ))}
                {clients.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">No clients found</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className="mb-5 flex items-center gap-2.5 flex-wrap">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm md:max-w-sm">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by name or category..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 md:text-sm"
          />
          {search && (
            <button type="button" onClick={() => { setSearch(""); resetPage(); }} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {selectedClientId && (
          <div className="relative shrink-0">
            <UserRound size={13} className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-gray-400" />
            <select
              aria-label="Ordered by"
              value={orderedBy}
              onChange={event => handleOrderedByChange(event.target.value)}
              className="h-[38px] min-w-[145px] appearance-none rounded-lg border border-gray-200 bg-white pl-8 pr-8 text-xs text-gray-700 outline-none transition-colors hover:bg-gray-50 focus:border-blue-400 md:text-sm"
            >
              {orderRequesterOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        )}

        {/* More Filters */}
        {selectedClientId && (
          <div className="relative">
            <button
              type="button"
              onClick={() => { setMoreFiltersOpen(o => !o); setClientOpen(false); setSortOpen(false); }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors md:text-sm ${moreFiltersOpen ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              <Filter size={14} />
              More Filters
              <ChevronDown size={14} className={`transition-transform ${moreFiltersOpen ? "rotate-180" : ""}`} />
            </button>
            {moreFiltersOpen && (
              <div className="absolute left-0 top-full z-40 mt-1 w-[min(92vw,360px)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Product type</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {SHOP_TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = shopTab === tab.id;
                    const count = tab.id === "all"
                      ? visibleCatalogProducts.length
                      : visibleCatalogProducts.filter(product => getShopProductKind(product) === tab.id).length;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleShopTabChange(tab.id)}
                        className={`flex min-h-14 flex-col items-start justify-between rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors ${
                          active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/50"
                        }`}
                      >
                        <span className="flex w-full items-center justify-between gap-1">
                          <Icon size={12} className={active ? "text-blue-600" : "text-gray-400"} />
                          <span className={`rounded-full px-1 text-[9px] ${active ? "bg-white text-blue-600" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                        </span>
                        <span className="leading-tight">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[10px] font-medium text-gray-500">
                    Category
                    <select
                      value={category}
                      onChange={event => { setCategory(event.target.value); resetPage(); }}
                      className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] text-gray-700 outline-none focus:border-blue-400"
                    >
                      {allCats.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-medium text-gray-500">
                    Brand
                    <select
                      value={brand}
                      onChange={event => { setBrand(event.target.value); resetPage(); }}
                      className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] text-gray-700 outline-none focus:border-blue-400"
                    >
                      {allBrands.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-medium text-gray-500">
                    Availability
                    <select
                      value={availability}
                      onChange={event => { setAvailability(event.target.value); resetPage(); }}
                      className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] text-gray-700 outline-none focus:border-blue-400"
                    >
                      {["All", "In Stock", "Out of Stock"].map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Quick availability</p>
                <button
                  type="button"
                  onClick={() => { setAvailability(availability === "In Stock" ? "All" : "In Stock"); setMoreFiltersOpen(false); resetPage(); }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  In-stock products
                  <span className={`h-4 w-4 rounded border ${availability === "In Stock" ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                    {availability === "In Stock" && <Check size={12} className="text-white" />}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAvailability(availability === "Out of Stock" ? "All" : "Out of Stock"); setMoreFiltersOpen(false); resetPage(); }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  Out-of-stock products
                  <span className={`h-4 w-4 rounded border ${availability === "Out of Stock" ? "border-blue-600 bg-blue-600" : "border-gray-300"}`}>
                    {availability === "Out of Stock" && <Check size={12} className="text-white" />}
                  </span>
                </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => { setSortOpen(o => !o); setClientOpen(false); setMoreFiltersOpen(false); }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors md:text-sm ${sortOpen ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              <ArrowDownAZ size={14} />
              <span>Sort By: <span className="font-semibold">{sortBy}</span></span>
              <ChevronDown size={14} className={`transition-transform ${sortOpen ? "rotate-180" : ""}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {(["Popularity", "Price: Low to High", "Price: High to Low", "Name"] as SortOption[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setSortBy(option); setSortOpen(false); resetPage(); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${sortBy === option ? "bg-blue-50 font-medium text-blue-600" : "text-gray-700"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!selectedClientId ? (
        /* No client selected — empty state */
        <div className="text-center py-32 text-gray-400">
          <Building2 size={56} className=" mb-4 opacity-20" />
          <p className="font-semibold text-lg text-gray-500">Select a client to view their catalog</p>
          <p className="text-sm mt-2">Use the dropdown above to choose a client. Only products added to that client's catalog will appear here.</p>
        </div>
      ) : paginated.length === 0 ? (
        /* Client selected but no products */
        <div className="text-center py-24 text-gray-400">
          <ShoppingCart size={48} className=" mb-3 opacity-30" />
          <p className="font-medium text-gray-500">
            {catalogProducts.length === 0
              ? `No products have been added to ${selectedClient?.name}'s catalog yet`
              : selectedRequester
                ? `No products are assigned to ${selectedRequester.name}`
              : "No products match your filters"}
          </p>
          <p className="text-sm mt-1">
            {catalogProducts.length === 0
              ? "Go to the client's Catalog tab to add products from the master catalog."
              : selectedRequester
                ? `This user has the ${selectedRequester.role} role. Assign products to this role in the client's Catalog tab.`
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <>
          <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid grid-cols-1 gap-3"}>
            {paginated.map(product => {
              const preview = (p: Product) => navigate(
                `${isClientPortalUser ? "/portal" : ""}/shop/product/${p.productCode}`,
                { state: { product: p, clientId: selectedClientId } },
              );
              return (
                isConfigurableServiceProduct(product) ? (
                  <ConfiguredServiceProductCard
                    key={product.id}
                    product={product}
                    onPreview={preview}
                    clientId={selectedClientId}
                    isGrid={viewMode === "grid"}
                  />
                ) : (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onPreview={preview}
                    clientId={selectedClientId}
                    isGrid={viewMode === "grid"}
                  />
                )
              );
            })}
          </div>

          {/* Pagination */}
          {totalProducts > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalProducts)} to {Math.min(currentPage * PAGE_SIZE, totalProducts)} of {totalProducts} products
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {pageNums().map((n, i) => (
                  n === '...' ? (
                    <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n as number)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === n ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                    >
                      {n}
                    </button>
                  )
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Close dropdowns on outside click */}
      {(clientOpen || sortOpen || moreFiltersOpen) && (
        <div className="fixed inset-0 z-20" onClick={closeFilterMenus} />
      )}
    </div>
  );
}
