import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight, ShoppingCart, Check, Package, Shield, Clock,
  Printer, Wifi, FileText, Cpu, HardDrive, Monitor, Settings2,
  Timer, ZoomIn,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getClientCatalog, type ClientCatalogEntry } from "@/lib/clientCatalogStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import {
  getAllProductPricing,
  getSlabDiscountPct,
  computeVendorComparisons,
  computeClientSellingPriceExclGst,
  canVendorFulfillMoq,
  getVendorComparisonBadge,
  type VendorComparisonRow,
} from "@/lib/priceEngineStore";
import { getEffectiveTaxPctForCategory, getHsnCodes, getProductCategoryTaxMap } from "@/lib/taxEngine";
import FloatingCartButton from "@/components/FloatingCartButton";
import { getProductCommercialTerms } from "@/lib/productCommercialTerms";
import {
  formatLeadTimeByType,
  getAvailabilityByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  isDigitalOnlyType,
} from "@/lib/productTypeRules";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  fulfillmentType?: "physical" | "digital" | "hybrid";
  image: string;
  images?: string[];
  specs: string[];
  leadTime: string;
  moq: number;
  priceNum: number;
  inStock: boolean;
  description?: string;
  generalSpecs?: { label: string; value: string }[];
  productNotes?: string;
  videoUrl?: string;
  warranty?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  if (!n || n === 0) return "Price on request";
  return "₹" + n.toLocaleString("en-IN");
}

function formatLeadTime(t: string) { return t ? `${t} (Subject to Availability)` : "—"; }
function formatMoq(n: number) { return n > 0 ? `${n} Units` : "—"; }

function getCategoryColor(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("cloud") || c.includes("server") || c.includes("it") || c.includes("hardware") || c.includes("tech")) return "text-blue-600 bg-blue-50";
  if (c.includes("office")) return "text-emerald-600 bg-emerald-50";
  if (c.includes("pantry") || c.includes("food") || c.includes("beverage") || c.includes("consumable")) return "text-orange-600 bg-orange-50";
  if (c.includes("station") || c.includes("misc")) return "text-violet-600 bg-violet-50";
  if (c.includes("furniture")) return "text-amber-600 bg-amber-50";
  if (c.includes("network")) return "text-cyan-600 bg-cyan-50";
  return "text-gray-600 bg-gray-100";
}

function getSpecIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("print") || n.includes("scan") || n.includes("copy") || n.includes("function")) return <Printer size={18} className="text-blue-500" />;
  if (n.includes("speed") || n.includes("rate") || n.includes("ppm")) return <Timer size={18} className="text-blue-500" />;
  if (n.includes("connect") || n.includes("wifi") || n.includes("network")) return <Wifi size={18} className="text-blue-500" />;
  if (n.includes("paper") || n.includes("size") || n.includes("format")) return <FileText size={18} className="text-blue-500" />;
  if (n.includes("warrant") || n.includes("guarantee")) return <Shield size={18} className="text-blue-500" />;
  if (n.includes("resol")) return <Monitor size={18} className="text-blue-500" />;
  if (n.includes("processor") || n.includes("cpu") || n.includes("memory") || n.includes("ram")) return <Cpu size={18} className="text-blue-500" />;
  if (n.includes("storage") || n.includes("ssd") || n.includes("hdd")) return <HardDrive size={18} className="text-blue-500" />;
  if (n.includes("display") || n.includes("screen") || n.includes("monitor")) return <Monitor size={18} className="text-blue-500" />;
  return <Settings2 size={18} className="text-blue-500" />;
}

function getProductIcon(name: string, category: string) {
  const n = (name + category).toLowerCase();
  if (n.includes("server") || n.includes("rack")) return <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center"><HardDrive size={60} className="text-slate-400" /></div>;
  if (n.includes("laptop") || n.includes("latitude") || n.includes("notebook")) return <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"><Monitor size={60} className="text-blue-400" /></div>;
  if (n.includes("print") || n.includes("laserjet") || n.includes("mfp")) return <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><Printer size={60} className="text-gray-500" /></div>;
  return <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center"><Package size={60} className="text-blue-400" /></div>;
}

// ── Zoom on hover ─────────────────────────────────────────────────────────────

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y });
  };

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden cursor-zoom-in"
      onMouseMove={handleMove}
      onMouseLeave={() => setZoom(null)}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-100 ${zoom ? "opacity-0" : "opacity-100"}`}
      />
      {zoom && (
        <div
          className="absolute inset-0 bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "250%",
            backgroundPosition: `${zoom.x}% ${zoom.y}%`,
          }}
        />
      )}
    </div>
  );
}

// ── Vendor match helper ───────────────────────────────────────────────────────

function getVendorMatchMap(): Map<string, { leadTime: string; moq: number }> {
  const map = new Map<string, { leadTime: string; moq: number }>();
  getAllProductPricing().forEach(p => {
    if (!p.winningVendor) return;
    const days = p.winningVendor.leadTime;
    const displayDays = days > 0 ? days * 2 : 0;
    map.set(p.masterProductCode, {
      leadTime: displayDays > 0 ? `${displayDays} Day${displayDays !== 1 ? "s" : ""}` : "",
      moq: p.winningVendor.moq,
    });
  });
  return map;
}

function entryToProduct(e: ClientCatalogEntry, vendorMatches: Map<string, { leadTime: string; moq: number }>): Product {
  const match = vendorMatches.get(e.productCode);
  const master = getCatalogProducts().find(p => p.masterProductCode === e.productCode);
  const masterSpecs = master?.specifications
    ?.map(s => `${s.specification}: ${s.value}${s.unit && s.unit !== "-" ? ` ${s.unit}` : ""}`)
    .filter(Boolean);
  const masterGeneralSpecs = master?.generalSpecs
    ?.filter(s => s.category || s.attributeValue)
    .map(s => ({ label: s.category, value: s.attributeValue }));
  return {
    id: `client-${e.productCode}`,
    productCode: e.productCode,
    name: e.name,
    category: master?.category || e.category || "General",
    subcategory: master?.subcategory || e.subcategory,
    brand: master?.brand || e.brand,
    tags: master?.tags || e.tags || [],
    productType: master?.productType || e.productType,
    physicalType: master?.physicalType || e.physicalType,
    image: master?.images?.[0] || e.img || "",
    images: master?.images?.length ? master.images : e.images,
    specs: masterSpecs?.length ? masterSpecs : e.specs || [],
    leadTime: match?.leadTime || e.leadTime || "",
    moq: match?.moq ?? e.moq ?? 0,
    priceNum: e.priceNum ?? 0,
    inStock: e.availability !== "Out of Stock",
    description: master?.description || e.description,
    generalSpecs: masterGeneralSpecs?.length ? masterGeneralSpecs : e.generalSpecs,
    productNotes: master?.productNotes || e.productNotes,
    videoUrl: master?.videoUrl || e.videoUrl,
    warranty: master?.warranty || e.warranty,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user, isClientPortalUser } = useAuth();
  const isPortalFlow = location.pathname.startsWith("/portal/");
  const catalogPath = isPortalFlow ? "/portal/catalog" : "/shop";
  const productPath = isPortalFlow ? "/portal/shop/product" : "/shop/product";

  // Product + client come from router state (set by ShopPage on click)
  const stateProduct = location.state?.product as Product | undefined;
  const clientId = isClientPortalUser
    ? (user?.clientId || "")
    : (location.state?.clientId as string | undefined);

  const [product, setProduct] = useState<Product | null>(stateProduct ?? null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(Math.max(1, stateProduct?.moq ?? 1));
  const [added, setAdded] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [vendorComps, setVendorComps] = useState<VendorComparisonRow[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorComparisonRow | null>(null);
  const [vendorPanelOpen, setVendorPanelOpen] = useState(false);

  // Keep qty >= moq
  useEffect(() => {
    if (product) setQty(Math.max(1, product.moq));
  }, [product?.moq]);

  // Keep vendor comparisons and the selected MOQ current when a vendor listing changes.
  useEffect(() => {
    if (!product?.productCode) return;
    const refreshVendors = () => {
      setVendorComps(computeVendorComparisons(product.productCode, product.category));
    };
    refreshVendors();
    window.addEventListener("vendorProductsUpdated", refreshVendors);
    return () => window.removeEventListener("vendorProductsUpdated", refreshVendors);
  }, [product?.productCode, product?.category]);

  useEffect(() => {
    if (!selectedVendor) return;
    const refreshed = vendorComps.find(comp => comp.vendorId === selectedVendor.vendorId);
    if (!refreshed || !canUseVendor(refreshed)) {
      setSelectedVendor(null);
      setQty(Math.max(1, product.moq || 1));
      return;
    }
    if (refreshed !== selectedVendor) setSelectedVendor(refreshed);
    setQty(value => Math.max(Math.max(1, refreshed.moq || 1), value));
  }, [vendorComps, selectedVendor, product?.moq]);

  // Load related products from client catalog
  useEffect(() => {
    if (!clientId || !product) return;
    const vendorMatches = getVendorMatchMap();
    const entries = getClientCatalog(clientId);
    const all = entries.map(e => entryToProduct(e, vendorMatches));
    const related = all
      .filter(p => p.productCode !== product.productCode)
      .sort((a, b) => (a.category === product.category ? -1 : 1) - (b.category === product.category ? -1 : 1))
      .slice(0, 4);
    setRelatedProducts(related);
  }, [clientId, product?.productCode]);

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Package size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Product not found</p>
          <button
            onClick={() => navigate(catalogPath)}
            className="mt-4 text-blue-600 text-sm hover:underline"
          >
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  // Build image list — use product.images array if available, else single image
  const images: string[] = product.images && product.images.length > 0
    ? product.images
    : product.image ? [product.image] : [];

  const discountPct = clientId ? getSlabDiscountPct(clientId, product.category, qty) : 0;
  const productType = getProductType(product.physicalType);
  const productPricingModel = getPricingModel(productType);
  const productQuantityLabel = getQuantityLabel(productType);
  const canUseVendor = (vendor: VendorComparisonRow) =>
    isDigitalOnlyType(productType) || canVendorFulfillMoq(vendor);
  const vendorMoq = selectedVendor?.moq ?? product.moq;
  const vendorMaxQty = selectedVendor && !isDigitalOnlyType(productType) && selectedVendor.stock > 0
    ? selectedVendor.stock
    : undefined;

  const specPairs = product.specs.map(s => {
    const idx = s.indexOf(': ');
    return idx > -1 ? { key: s.slice(0, idx), val: s.slice(idx + 2) } : { key: '', val: s };
  }).filter(sp => sp.key || sp.val);

  const gstRate = getEffectiveTaxPctForCategory(product?.category ?? "");
  const selectedClientPriceExcl = selectedVendor && clientId
    ? computeClientSellingPriceExclGst(
        clientId,
        product.productCode,
        product.category,
        selectedVendor.landedCostPerUnit,
      )
    : undefined;
  const displayPriceExcl = selectedClientPriceExcl ?? product.priceNum * 100 / (100 + gstRate);
  const effectivePrice = discountPct > 0 ? displayPriceExcl * (1 - discountPct / 100) : displayPriceExcl;
  const hsnSnapshot = (() => {
    const byCategory = new Map<string, string>();
    getHsnCodes().forEach(h => {
      if (h.status === "Active" && h.productCategory) byCategory.set(h.productCategory.toLowerCase(), h.code);
    });
    getProductCategoryTaxMap().forEach(m => {
      if (m.defaultHsnCode && m.productCategory) byCategory.set(m.productCategory.toLowerCase(), m.defaultHsnCode);
    });
    return byCategory.get((product.category || "").toLowerCase()) || "";
  })();

  const handleAdd = () => {
    if (added || !selectedVendor || !canUseVendor(selectedVendor)) return;
    const orderQty = vendorMaxQty !== undefined
      ? Math.min(vendorMaxQty, Math.max(Math.max(1, selectedVendor.moq || 1), qty))
      : Math.max(Math.max(1, selectedVendor.moq || 1), qty);
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
        gstSnapshot: gstRate,
         hsnSnapshot,
      },
       Math.max(1, orderQty)
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleRelatedClick = (rp: Product) => {
    setProduct(rp);
    setActiveImg(0);
    setAdded(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(`${productPath}/${rp.productCode}`, { state: { product: rp, clientId }, replace: true });
  };

  // Thumbnails to display (max 4 visible, +N badge for the rest)
  const MAX_VISIBLE_THUMBS = 4;
  const visibleThumbs = images.slice(0, MAX_VISIBLE_THUMBS);
  const extraCount = images.length - MAX_VISIBLE_THUMBS;

  return (
    <div className="min-h-screen bg-white">
      <FloatingCartButton />

      {/* ── Breadcrumb ── */}
      <div className="border-b border-gray-200 bg-white px-2 py-4">
        <div className="max-w-7xlflex items-center gap-2 text-sm">
          <button
            onClick={() => navigate(catalogPath)}
            className="flex items-center gap-1.5 text-blue-600 font-medium hover:underline"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Products
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xlpx-2 py-8">

        {/* Top section: image + details + price */}
        <div className="flex gap-8">

          {/* ── Image column ── */}
          <div className="w-[340px] shrink-0">
            <div className="flex gap-3">

              {/* Thumbnail rail */}
              <div className="flex flex-col gap-2 shrink-0">
                {visibleThumbs.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-14 h-14 rounded-lg border-2 overflow-hidden bg-gray-50 flex items-center justify-center transition-colors ${
                      activeImg === i ? "border-blue-500" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {img ? (
                      <img src={img} alt={`${product.name} view ${i + 1}`} className="w-full h-full object-contain" />
                    ) : (
                      <div className="scale-[0.35] origin-center">{getProductIcon(product.name, product.category)}</div>
                    )}
                  </button>
                ))}

                {/* No real image — show one placeholder thumbnail */}
                {images.length === 0 && (
                  <div className="w-14 h-14 rounded-lg border-2 border-blue-500 overflow-hidden bg-gray-50 flex items-center justify-center">
                    <div className="scale-[0.35] origin-center">{getProductIcon(product.name, product.category)}</div>
                  </div>
                )}

                {/* +N more badge */}
                {extraCount > 0 && (
                  <button
                    onClick={() => setActiveImg(MAX_VISIBLE_THUMBS)}
                    className="w-14 h-14 rounded-lg border-2 border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-semibold text-gray-600 hover:border-gray-400 transition-colors"
                  >
                    +{extraCount}
                  </button>
                )}
              </div>

              {/* Main image */}
              <div className="flex-1 aspect-square rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
                {images.length > 0 ? (
                  <ZoomableImage src={images[activeImg] || images[0]} alt={product.name} />
                ) : (
                  getProductIcon(product.name, product.category)
                )}
              </div>
            </div>

            {/* Zoom hint */}
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 justify-center">
              <ZoomIn size={12} /> Click image to zoom
            </p>
          </div>

          {/* ── Product details ── */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>

            <span className={`inline-block mt-2 text-xs font-semibold px-2 py-1 rounded-full ${getCategoryColor(product.category)}`}>
              {product.category}
            </span>

            {product.description && (
              <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-2xl">
                {product.description}
              </p>
            )}

            {/* Key Specifications */}
            {specPairs.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Specifications</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {specPairs.map((sp, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 border border-gray-200 rounded-xl bg-gray-50"
                    >
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

          {/* ── Price panel ── */}
          <div className="w-72 shrink-0">
            <div className="border border-gray-200 rounded-2xl p-2 sticky top-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Price (Excl. GST)</p>

              {discountPct > 0 ? (
                <>
                   <p className="text-sm text-gray-400 line-through mt-1">{formatPrice(displayPriceExcl)}</p>
                  <p className="text-3xl font-bold text-green-600 mt-0.5">
                    {formatPrice(effectivePrice)}
                    {product.priceNum > 0 && <span className="text-sm font-normal text-gray-500"> / each</span>}
                  </p>
                  <p className="text-xs text-green-600 font-semibold mt-1">{discountPct}% volume discount applied</p>
                </>
              ) : (
                <p className="text-3xl font-bold text-gray-900 mt-1">
                   {formatPrice(displayPriceExcl)}
                   {displayPriceExcl > 0 && <span className="text-sm font-normal text-gray-500"> / each</span>}
                </p>
              )}

              {/* ── Vendor Selection ── */}
              <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Select Vendor</span>
                    <span className="block text-[9px] text-gray-400 mt-0.5">{productType} · {productPricingModel}</span>
                  </div>
                  {vendorComps.length > 0 && <span className="text-[10px] text-gray-400">{vendorComps.length} available</span>}
                </div>
                {vendorComps.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-400">No vendor pricing available for this product.</div>
                ) : selectedVendor ? (
                  <div className="px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <Check size={10} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{selectedVendor.vendorName}</p>
                          <p className="text-[10px] text-gray-500">
                            Selected vendor · {productPricingModel}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => { setSelectedVendor(null); setVendorPanelOpen(true); }} className="text-[10px] text-blue-600 font-semibold shrink-0 hover:underline">Change</button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-gray-100">
                      {(() => {
                        const availability = getAvailabilityByType(selectedVendor.stock, productType);
                        const leadTime = formatLeadTimeByType(selectedVendor.leadTime, productType);
                        return (
                          <>
                            <div>
                              <p className="text-[9px] text-gray-400 uppercase">Price</p>
                              <p className="text-xs font-bold text-gray-900">
                                {selectedClientPriceExcl && selectedClientPriceExcl > 0 ? formatPrice(selectedClientPriceExcl) : "—"}
                              </p>
                            </div>
                            <div><p className="text-[9px] text-gray-400 uppercase">Availability</p><p className="text-xs font-semibold text-emerald-600">{availability.primary}</p><p className="text-[9px] text-gray-400">{availability.isUnlimited ? "Instant" : availability.status}</p></div>
                            <div><p className="text-[9px] text-gray-400 uppercase">Lead Time / SLA</p><p className="text-xs font-semibold text-gray-800">{leadTime.primary}</p><p className="text-[9px] text-gray-400">{leadTime.secondary || "Subject to Availability"}</p></div>
                            <div><p className="text-[9px] text-gray-400 uppercase">MOQ / Min Qty</p><p className="text-xs font-semibold text-gray-800">{selectedVendor.moq > 0 ? `${selectedVendor.moq} ${productQuantityLabel}` : "—"}</p></div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* The comparison rows use the same type-specific presentation as Vendor Products. */}
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px]">
                        <div className="grid grid-cols-[1.5fr_1.55fr_0.9fr_1.15fr_1.2fr_1fr] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Vendor</span>
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Pricing Model</span>
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Price</span>
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Availability</span>
                          <span className="text-[8px] font-bold text-gray-500 uppercase">Lead Time / SLA</span>
                          <span className="text-[8px] font-bold text-gray-500 uppercase">MOQ / Min Qty</span>
                        </div>
                        {vendorComps.map((comp) => {
                          const eligible = canUseVendor(comp);
                          const availability = getAvailabilityByType(comp.stock, productType);
                          const leadTime = formatLeadTimeByType(comp.leadTime, productType);
                          const badge = getVendorComparisonBadge(comp, vendorComps, canUseVendor);
                          return (
                            <button
                              key={comp.vendorId}
                              type="button"
                              disabled={!eligible}
                              onClick={() => { if (eligible) { setSelectedVendor(comp); setQty(Math.max(1, comp.moq)); setVendorPanelOpen(false); } }}
                              className={`w-full grid grid-cols-[1.5fr_1.55fr_0.9fr_1.15fr_1.2fr_1fr] gap-2 items-center px-3 py-2.5 text-left border-b border-gray-50 last:border-0 transition-colors ${eligible ? "hover:bg-blue-50" : "opacity-50 cursor-not-allowed"}`}
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-gray-800 truncate">{comp.vendorName}</p>
                                {badge && <span className="text-[8px] text-blue-700 font-bold">{badge === "Recommended" ? "★ " : ""}{badge}</span>}
                              </div>
                              <span className="text-[9px] leading-tight text-gray-700">{productPricingModel}</span>
                              <span className="text-[10px] font-semibold text-gray-800">
                                {eligible && clientId
                                  ? formatPrice(computeClientSellingPriceExclGst(
                                      clientId,
                                      product.productCode,
                                      product.category,
                                      comp.landedCostPerUnit,
                                    ))
                                  : "—"}
                              </span>
                              <span className={`text-[9px] leading-tight font-semibold ${!eligible || availability.status === "Out of Stock" ? "text-red-500" : availability.status === "Low Stock" ? "text-amber-600" : "text-emerald-600"}`}>
                                {!eligible ? "Out of Stock" : availability.primary}<span className="block text-[8px] text-gray-400 font-medium">{eligible && availability.isUnlimited ? "Instant" : !eligible ? "Below MOQ" : availability.status}</span>
                              </span>
                              <span className="text-[9px] leading-tight text-gray-700">{leadTime.primary}<span className="block text-[8px] text-gray-400">{leadTime.secondary || "Subject to Availability"}</span></span>
                              <span className="text-[9px] text-gray-700">{comp.moq > 0 ? `${comp.moq} ${productQuantityLabel}` : "—"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Qty stepper */}
              <div className="flex items-center gap-3 mt-4">
                <button
                   onClick={() => setQty(q => Math.max(Math.max(1, vendorMoq), q - 1))}
                  className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none shrink-0"
                >
                  −
                </button>
                   <span className="flex-1 text-center font-bold text-base">{qty}</span>
                <button
                   onClick={() => setQty(q => vendorMaxQty === undefined ? q + 1 : Math.min(vendorMaxQty, q + 1))}
                   disabled={vendorMaxQty !== undefined && qty >= vendorMaxQty}
                  className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg leading-none shrink-0"
                >
                  +
                </button>
                 <span className="text-xs text-gray-400 whitespace-nowrap">(Min: {vendorMoq > 0 ? vendorMoq : 1})</span>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAdd}
                disabled={!selectedVendor}
                className={`w-full mt-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                  !selectedVendor ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-dashed border-gray-300" :
                  added ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {added ? <Check size={16} /> : <ShoppingCart size={16} />}
                {added ? "Added to Cart!" : !selectedVendor ? "Select a vendor first" : "Add to Cart"}
              </button>

              {/* MOQ / Lead time / Warranty */}
              <div className="mt-5 space-y-2.5 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Package size={14} className="text-gray-400 shrink-0" />
                  <span>MOQ: {formatMoq(product.moq)}</span>
                </div>
                {product.leadTime && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <span>Lead Time: {formatLeadTime(product.leadTime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield size={14} className="text-gray-400 shrink-0" />
                  <span>
                    {product.warranty
                      ? `Warranty: ${product.warranty}`
                      : "Warranty: 1 Year (Subject to Availability)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom section ── */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-2 items-start">

          {/* General Specifications */}
          {product.generalSpecs && product.generalSpecs.length > 0 && (
            <div className="border border-gray-200 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">General Specifications</h3>
              <div className="flex flex-col">
                {product.generalSpecs.map((gs, i) => (
                  <div
                    key={i}
                    className="flex justify-between border-b border-gray-100 last:border-0 py-2.5"
                  >
                    <span className="text-sm text-gray-500 w-1/3">{gs.label}</span>
                    <span className="text-sm font-medium text-gray-800 flex-1 text-right">{gs.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Related Products</h3>
                <button
                  onClick={() => navigate(catalogPath)}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  View All
                </button>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {relatedProducts.map(rp => {
                  const rpDiscountPct = clientId ? getSlabDiscountPct(clientId, rp.category, Math.max(1, rp.moq)) : 0;
                  const rpPrice = rpDiscountPct > 0 ? rp.priceNum * (1 - rpDiscountPct / 100) : rp.priceNum;
                  return (
                    <div
                      key={rp.id}
                      onClick={() => handleRelatedClick(rp)}
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
                      <span className={`text-[11px] font-medium mt-1 ${getCategoryColor(rp.category).split(" ")[0]}`}>
                        {rp.category}
                      </span>
                      <p className="text-sm font-bold text-gray-900 mt-1.5">
                        {formatPrice(rpPrice)}
                        {rp.priceNum > 0 && <span className="text-[11px] font-normal text-gray-500"> / each</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">MOQ: {rp.moq > 0 ? rp.moq : "—"}</p>
                      <button
                        onClick={e => { e.stopPropagation(); handleRelatedClick(rp); }}
                        className="mt-2 flex items-center justify-center gap-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg py-1.5 text-[11px] font-semibold transition-colors"
                      >
                        <ShoppingCart size={12} /> View &amp; Select Vendor
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
  );
}
