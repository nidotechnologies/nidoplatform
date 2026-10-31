import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Filter, MoreVertical, Search, X, ZoomIn, Package, Clock, Shield, Cpu, HardDrive, Monitor, Printer, Wifi, FileText, Settings2, Timer, ChevronLeft, Eye, Pencil, AlertTriangle } from "lucide-react";
import { getCatalogProducts, CatalogProduct } from "@/lib/catalogStore";
import { getAllVendorProducts } from "@/lib/vendorStore";
import { getVendorById } from "@/lib/vendorDataStore";
import {
  getClientCatalog,
  saveClientCatalog,
  peekCpcCounter,
  reserveClientProductCodes,
  type ClientCatalogEntry,
} from "@/lib/clientCatalogStore";
import { syncClientPrices } from "@/lib/priceEngineStore";
import { getPortalRoleNames } from "@/lib/portalUserStore";
import {
  formatLeadTimeByType,
  getProductType,
  getQuantityLabel,
  getTenureBilling,
  isDigitalOnlyType,
} from "@/lib/productTypeRules";

function getAssignableCatalogRoles(clientId: string): string[] {
  return getPortalRoleNames(clientId);
}

function normalizeMasterProductCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Returns a numeric sort key for a preference string.
 *  "Preference 1" → 1, "Preference 2" → 2, custom names → large number (alphabetical tiebreak),
 *  empty/undefined → Infinity (always last).
 */
function prefOrder(pref?: string): number {
  if (!pref || pref.trim() === "") return Infinity;
  const m = pref.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  // Non-numeric custom preference: sort after numbered ones, alphabetically
  return 10000 + pref.charCodeAt(0);
}

function ProductThumb({ images, name }: { images: string[]; name: string }) {
  if (images && images.length > 0) {
    return (
      <img
        src={images[0]}
        alt={name}
        className="w-8 h-8 rounded-md object-cover border border-gray-200 flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0 border border-blue-200">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface SelectedRow {
  product: CatalogProduct;
  roles: string[];
  preference: string;
  cpc: string;
}

function PreferenceDropdown({
  value,
  preferences,
  onSelect,
  onAddNew,
}: {
  value: string;
  preferences: string[];
  onSelect: (p: string) => void;
  onAddNew: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 150 });

  const commit = () => {
    const name = newName.trim();
    if (!name) return;
    onAddNew(name);
    onSelect(name);
    setNewName("");
    setAdding(false);
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const estimatedHeight = Math.min(288, 40 + preferences.length * 28);
      const margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const rawTop = openUpward ? rect.top - 4 - estimatedHeight : rect.bottom + 4;
      const clampedTop = Math.min(
        Math.max(rawTop, margin),
        Math.max(window.innerHeight - estimatedHeight - margin, margin)
      );
      setMenuPos({
        top: clampedTop,
        left: rect.left,
        width: Math.max(rect.width, 150),
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, preferences.length]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen((v) => !v); setAdding(false); }}
        className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600 min-w-[120px] w-full"
      >
        <span className={value ? "text-gray-700" : "text-gray-400"}>{value || "Select…"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[51]" onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[52] py-1 max-h-72 overflow-y-auto"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
          >
            {preferences.map((p) => (
              <button
                key={p}
                onClick={() => { onSelect(p); setOpen(false); }}
                className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${value === p ? "text-blue-600 font-medium" : "text-gray-700"}`}
              >
                {p}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              {adding ? (
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && commit()}
                    placeholder="Preference name…"
                    className="flex-1 px-2 py-1 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button onClick={commit} className="px-1.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
                  <button onClick={() => { setAdding(false); setNewName(""); }} className="px-1.5 py-1 text-xs border border-gray-200 text-gray-500 rounded hover:bg-gray-50">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full text-left px-2 py-1.5 text-xs text-blue-500 hover:bg-blue-50 transition-colors font-medium flex items-center gap-1"
                >
                  <span className="text-sm leading-none">+</span> Add new
                </button>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function RoleDropdown({
  values,
  roles,
  onToggle,
}: {
  values: string[];
  roles: string[];
  onToggle: (r: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 180 });

  const label = values.length === 0
    ? "Select roles…"
    : values.length === 1
      ? values[0]
      : `${values.length} roles selected`;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const estimatedHeight = Math.min(288, 40 + roles.length * 28);
      const margin = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const rawTop = openUpward ? rect.top - 4 - estimatedHeight : rect.bottom + 4;
      const clampedTop = Math.min(
        Math.max(rawTop, margin),
        Math.max(window.innerHeight - estimatedHeight - margin, margin)
      );
      setMenuPos({
        top: clampedTop,
        left: rect.left,
        width: Math.max(rect.width, 180),
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, roles.length]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-600 min-w-[140px] w-full"
      >
        <span className={values.length > 0 ? "text-gray-700 truncate" : "text-gray-400"}>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400 ml-1"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {/* Selected role tags shown below trigger */}
      {values.length > 1 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map((r) => (
            <span key={r} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
              {r}
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(r); }}
                className="text-blue-400 hover:text-blue-700 leading-none ml-0.5"
              >×</button>
            </span>
          ))}
        </div>
      )}

      {open && createPortal(
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-[51]" onClick={() => setOpen(false)} />
          <div
            className="fixed bg-white border border-gray-200 rounded-xl shadow-lg z-[52] py-1 max-h-72 overflow-y-auto"
            style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
          >
            {roles.map((r) => {
              const checked = values.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => onToggle(r)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${checked ? "text-blue-600" : "text-gray-700"}`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {checked && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  {r}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Use the shared interface from the store (aliased for local use)
type CatalogEntry = ClientCatalogEntry;
type CatalogProductTab = "physical" | "digital";

function isDigitalCatalogEntry(product: CatalogEntry): boolean {
  return isDigitalOnlyType(getProductType(product.physicalType || product.productType));
}

function getCatalogVendorSummary(productCode: string): { names: string[]; price: string; stock: number } {
  const matches = Object.values(getAllVendorProducts())
    .flat()
    .filter((product) => product.masterProductCode === productCode && product.status === "Active");
  const names = Array.from(new Set(matches.map((product) => getVendorById(product.vendorId)?.name || product.vendorId)));
  const prices = matches
    .map((product) => Number.parseFloat(product.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  const stock = matches.reduce((total, product) => {
    const physical = Number.parseInt(product.physicalStock ?? product.stock ?? "0", 10) || 0;
    const reserved = Number.parseInt(product.reservedStock ?? "0", 10) || 0;
    return total + Math.max(0, physical - reserved);
  }, 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  return {
    names,
    price: lowestPrice > 0 ? `₹${lowestPrice.toLocaleString("en-IN")}` : "—",
    stock,
  };
}

// ── Helpers shared by view/edit screens ───────────────────────────────────────

function getCategoryColor(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (c.includes("cloud") || c.includes("server")) return "text-blue-600";
  if (c.includes("it") || c.includes("hardware") || c.includes("tech")) return "text-blue-600";
  if (c.includes("office")) return "text-emerald-600";
  if (c.includes("pantry") || c.includes("food") || c.includes("beverage") || c.includes("consumable")) return "text-orange-600";
  if (c.includes("furniture")) return "text-amber-600";
  if (c.includes("network")) return "text-cyan-600";
  return "text-gray-600";
}

function getSpecIcon(name: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("print") || n.includes("scan") || n.includes("copy")) return <Printer size={16} className="text-blue-500" />;
  if (n.includes("speed") || n.includes("rate")) return <Timer size={16} className="text-blue-500" />;
  if (n.includes("connect") || n.includes("wifi") || n.includes("network")) return <Wifi size={16} className="text-blue-500" />;
  if (n.includes("paper") || n.includes("size") || n.includes("format")) return <FileText size={16} className="text-blue-500" />;
  if (n.includes("warrant") || n.includes("guarantee")) return <Shield size={16} className="text-blue-500" />;
  if (n.includes("processor") || n.includes("cpu") || n.includes("memory") || n.includes("ram")) return <Cpu size={16} className="text-blue-500" />;
  if (n.includes("storage") || n.includes("ssd") || n.includes("hdd")) return <HardDrive size={16} className="text-blue-500" />;
  if (n.includes("display") || n.includes("screen") || n.includes("resolution")) return <Monitor size={16} className="text-blue-500" />;
  return <Settings2 size={16} className="text-blue-500" />;
}

// ── Product View Screen ────────────────────────────────────────────────────────

function ProductViewScreen({ product, onClose }: { product: CatalogEntry; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  const specPairs = (product.specs || []).map((s) => {
    const idx = s.indexOf(": ");
    return idx > -1 ? { key: s.slice(0, idx), val: s.slice(idx + 2) } : { key: "", val: s };
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{product.name}</h2>
            <span className={`text-xs font-medium ${getCategoryColor(product.category)}`}>{product.category}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xlpx-2 py-8">
          <div className="flex gap-8">
            {/* Image */}
            <div className="w-80 shrink-0">
              <div
                className={`w-full aspect-square rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 ${product.img ? "cursor-zoom-in" : ""}`}
                onClick={() => product.img && setZoomed(true)}
              >
                {product.img ? (
                  <img src={product.img} alt={product.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={64} className="text-gray-300" />
                  </div>
                )}
              </div>
              {product.img && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 justify-center">
                  <ZoomIn size={12} /> Click image to zoom
                </p>
              )}
            </div>

            {/* Lightbox */}
            {zoomed && product.img && (
              <div
                className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
                onClick={() => setZoomed(false)}
              >
                <button
                  onClick={() => setZoomed(false)}
                  className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X size={20} />
                </button>
                <img
                  src={product.img}
                  alt={product.name}
                  className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-zoom-out"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <span className={`inline-block mt-2 text-sm font-semibold ${getCategoryColor(product.category)}`}>{product.category}</span>

              {product.description && (
                <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-2xl">{product.description}</p>
              )}

              {specPairs.filter(s => s.key).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Key Specifications</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {specPairs.filter(s => s.key).map((sp, i) => (
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

            {/* Info panel */}
            <div className="w-60 shrink-0">
              <div className="border border-gray-200 rounded-2xl p-2 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Price</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{product.price || "—"}</p>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package size={14} className="text-gray-400 shrink-0" />
                    <span>MOQ: {product.moq ? `${product.moq} Units` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400 shrink-0" />
                    <span>Lead Time: {product.leadTime || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield size={14} className="text-gray-400 shrink-0" />
                    <span className={`font-medium ${
                      product.availability === "In Stock" ? "text-green-600"
                      : product.availability === "Low Stock" ? "text-orange-500"
                      : "text-red-500"
                    }`}>{product.availability || "—"}</span>
                  </div>
                  {product.cpc && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">CPC</span>
                      <span className="font-mono text-xs text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">{product.cpc}</span>
                    </div>
                  )}
                </div>
                {(product.roles.length > 0 || product.preference) && (
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    {product.roles.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Roles</p>
                        <div className="flex flex-wrap gap-1">
                          {product.roles.map(r => (
                            <span key={r} className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.preference && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Preference</p>
                        <span className="text-[11px] bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">{product.preference}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* General Specs */}
          {product.generalSpecs && product.generalSpecs.length > 0 && (
            <div className="mt-8 border border-gray-200 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">General Specifications</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8">
                {product.generalSpecs.map((gs, i) => (
                  <div key={i} className="flex justify-between border-b border-gray-100 py-2.5">
                    <span className="text-sm text-gray-500">{gs.label}</span>
                    <span className="text-sm font-medium text-gray-800">{gs.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Product Screen ────────────────────────────────────────────────────────

function EditProductScreen({
  product,
  clientId,
  onClose,
  onSave,
}: {
  product: CatalogEntry;
  clientId: string;
  onClose: () => void;
  onSave: (updated: Partial<CatalogEntry>) => void;
}) {
  const [availableRoles, setAvailableRoles] = useState<string[]>(() => getAssignableCatalogRoles(clientId));
  const [roles, setRoles] = useState<string[]>(() =>
    product.roles.filter(role =>
      getAssignableCatalogRoles(clientId).some(available => available.toLowerCase() === role.trim().toLowerCase())
    ),
  );
  const [preference, setPreference] = useState(product.preference || "");
  const [availablePreferences, setAvailablePreferences] = useState(["Preference 1", "Preference 2", "Preference 3"]);

  useEffect(() => {
    const refreshRoles = () => {
      const next = getAssignableCatalogRoles(clientId);
      setAvailableRoles(next);
      setRoles(current => current.filter(role =>
        next.some(available => available.toLowerCase() === role.trim().toLowerCase())
      ));
    };
    refreshRoles();
    window.addEventListener("nidoPortalRolesUpdated", refreshRoles);
    return () => window.removeEventListener("nidoPortalRolesUpdated", refreshRoles);
  }, [clientId]);

  const addPreference = (name: string) => setAvailablePreferences((prev) => prev.includes(name) ? prev : [...prev, name]);

  const toggleRole = (r: string) => setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const specPairs = (product.specs || []).map((s) => {
    const idx = s.indexOf(": ");
    return idx > -1 ? { key: s.slice(0, idx), val: s.slice(idx + 2) } : { key: "", val: s };
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Edit Product</h2>
            <p className="text-xs text-gray-400 truncate">{product.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xlpx-2 py-2 flex gap-8">

          {/* Left: Product details (read-only) */}
          <div className="w-72 shrink-0">
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="w-full aspect-square bg-gray-50">
                {product.img ? (
                  <img src={product.img} alt={product.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={56} className="text-gray-300" />
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                <span className={`text-xs font-medium ${getCategoryColor(product.category)}`}>{product.category}</span>
                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">SKU</span>
                    <span className="font-mono">{product.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Code</span>
                    <span className="font-mono">{product.productCode}</span>
                  </div>
                  {product.cpc && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">CPC</span>
                      <span className="font-mono">{product.cpc}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price</span>
                    <span className="font-semibold text-gray-900">{product.price || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Availability</span>
                    <span className={`font-medium ${
                      product.availability === "In Stock" ? "text-green-600"
                      : product.availability === "Low Stock" ? "text-orange-500"
                      : "text-red-500"
                    }`}>{product.availability}</span>
                  </div>
                  {product.moq ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400">MOQ</span>
                      <span>{product.moq} Units</span>
                    </div>
                  ) : null}
                  {product.leadTime ? (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lead Time</span>
                      <span>{product.leadTime}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Key specs preview */}
            {specPairs.filter(s => s.key).length > 0 && (
              <div className="mt-4 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Key Specifications</p>
                <div className="space-y-1.5">
                  {specPairs.filter(s => s.key).slice(0, 6).map((sp, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-400 truncate mr-2">{sp.key}</span>
                      <span className="font-medium text-gray-700 text-right">{sp.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Editable fields */}
          <div className="flex-1 min-w-0">
            <div className="border border-gray-200 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Roles &amp; Preferences</h3>
              <p className="text-sm text-gray-400 mb-6">Assign roles and set the preference level for this product in the client catalog.</p>

              {/* Roles */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Roles</label>
                <p className="text-xs text-gray-400 mb-3">Select one or more roles that have access to this product.</p>
                <RoleDropdown
                  values={roles}
                  roles={availableRoles}
                  onToggle={toggleRole}
                />
                {roles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {roles.map(r => (
                      <span key={r} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full">
                        {r}
                        <button
                          onClick={() => toggleRole(r)}
                          className="text-blue-400 hover:text-blue-700 leading-none ml-0.5"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preference */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Preference</label>
                <p className="text-xs text-gray-400 mb-3">Set a preference level or category for this product.</p>
                <PreferenceDropdown
                  value={preference}
                  preferences={availablePreferences}
                  onSelect={setPreference}
                  onAddNew={addPreference}
                />
                {preference && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2.5 py-1 rounded-full">
                      {preference}
                      <button
                        onClick={() => setPreference("")}
                        className="text-purple-400 hover:text-purple-700 leading-none ml-0.5"
                      >×</button>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-2 py-2 border-t border-gray-200 bg-white flex items-center justify-end gap-3">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onSave({ roles, preference }); onClose(); }}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

function AddNewProductModal({
  clientId,
  onClose,
  onAdd,
}: {
  clientId: string;
  onClose: () => void;
  onAdd: (entries: CatalogEntry[]) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [assignedProductCodes, setAssignedProductCodes] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<SelectedRow[]>([]);
  const [preferences, setPreferences] = useState(["Preference 1", "Preference 2", "Preference 3"]);
  const [roles, setRoles] = useState<string[]>(() => getAssignableCatalogRoles(clientId));

  useEffect(() => {
    const loadAssignedProductCodes = () => {
      setAssignedProductCodes(
        new Set(
          getClientCatalog(clientId)
            .map((entry) => normalizeMasterProductCode(entry.productCode))
            .filter(Boolean)
        )
      );
    };

    // Only products that at least one vendor has actually added (and marked
    // Active) should be assignable to a client. If the same master product
    // has been added by multiple vendors, it must still appear only once.
    const loadAssignable = () => {
      const vendorProductStore = getAllVendorProducts();
      const activeMasterCodes = new Set<string>();
      for (const products of Object.values(vendorProductStore)) {
        for (const p of products) {
          if (p.status === "Active") {
            activeMasterCodes.add(normalizeMasterProductCode(p.masterProductCode));
          }
        }
      }
      const published = getCatalogProducts().filter((p) => p.publishStatus === "published");
      const seen = new Set<string>();
      const deduped = published.filter((p) => {
        const code = normalizeMasterProductCode(p.masterProductCode);
        if (!activeMasterCodes.has(code)) return false;
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      });
      setCatalog(deduped);
      loadAssignedProductCodes();
    };
    loadAssignable();
    window.addEventListener("catalogUpdated", loadAssignable);
    window.addEventListener("vendorProductsUpdated", loadAssignable);
    window.addEventListener("clientCatalogUpdated", loadAssignedProductCodes);
    const refreshRoles = () => setRoles(getAssignableCatalogRoles(clientId));
    window.addEventListener("nidoPortalRolesUpdated", refreshRoles);
    return () => {
      window.removeEventListener("catalogUpdated", loadAssignable);
      window.removeEventListener("vendorProductsUpdated", loadAssignable);
      window.removeEventListener("clientCatalogUpdated", loadAssignedProductCodes);
      window.removeEventListener("nidoPortalRolesUpdated", refreshRoles);
    };
  }, [clientId]);

  const availableCatalog = useMemo(
    () => catalog.filter((product) =>
      !assignedProductCodes.has(normalizeMasterProductCode(product.masterProductCode))
    ),
    [catalog, assignedProductCodes]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return availableCatalog;
    return availableCatalog.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.masterProductCode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
    );
  }, [availableCatalog, query]);

  const toggleSelect = (product: CatalogProduct) => {
    if (assignedProductCodes.has(normalizeMasterProductCode(product.masterProductCode))) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
        setRows((r) => r.filter((row) => row.product.id !== product.id));
      } else {
        next.add(product.id);
        // Compute a *preview* CPC for display — peekCpcCounter() is a pure
        // localStorage read with no side-effects, so it is safe to call inside
        // a React state updater (even under Strict Mode's double-invocation).
        // The persistent counter is NOT incremented here; codes are only
        // reserved when the user confirms with "Add Products", so cancelling
        // the modal wastes no sequence numbers.
        setRows((r) => {
          const preview = `CPC-${String(peekCpcCounter() + r.length + 1).padStart(5, '0')}`;
          return [...r, { product, roles: [], preference: "", cpc: preview }];
        });
      }
      return next;
    });
  };

  const removeProduct = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setRows((r) => r.filter((row) => row.product.id !== id));
  };

  const toggleRowRole = (id: string, role: string) => {
    setRows((r) => r.map((row) => {
      if (row.product.id !== id) return row;
      const has = row.roles.includes(role);
      return { ...row, roles: has ? row.roles.filter((r) => r !== role) : [...row.roles, role] };
    }));
  };

  const updateRow = (id: string, field: "preference", value: string) => {
    setRows((r) => r.map((row) => row.product.id === id ? { ...row, [field]: value } : row));
  };

  const addPreference = (name: string) => {
    setPreferences((prev) => prev.includes(name) ? prev : [...prev, name]);
  };

  // Sort rows by preference index, then by insertion order within same preference
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ai = a.preference ? preferences.indexOf(a.preference) : Infinity;
      const bi = b.preference ? preferences.indexOf(b.preference) : Infinity;
      if (ai !== bi) return ai - bi;
      return rows.indexOf(a) - rows.indexOf(b);
    });
  }, [rows, preferences]);

  // ── Validation modal ─────────────────────────────────────────────────────
  type MissingField = { productName: string; missing: string[] };
  const [validationErrors, setValidationErrors] = useState<MissingField[]>([]);

  const handleAddProducts = () => {
    const currentlyAssigned = new Set(
      getClientCatalog(clientId)
        .map((entry) => normalizeMasterProductCode(entry.productCode))
        .filter(Boolean)
    );
    const rowsToAdd = rows.filter(
      (row) => !currentlyAssigned.has(normalizeMasterProductCode(row.product.masterProductCode))
    );
    if (rowsToAdd.length === 0) {
      onClose();
      return;
    }

    // A role is required for every selected product. Preference is optional.
    const errors: MissingField[] = [];
    for (const row of rowsToAdd) {
      const missing: string[] = [];
      if (!row.roles || row.roles.length === 0) missing.push("Role");
      if (missing.length > 0) errors.push({ productName: row.product.productName, missing });
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Reserve sequential CPC codes for every product being added RIGHT NOW,
    // only at the moment the user confirms. Cancelling the modal wastes nothing.
    const cpcs = reserveClientProductCodes(rowsToAdd.length);
    const entries: CatalogEntry[] = rowsToAdd.map((row, i) => ({
      productCode: row.product.masterProductCode,
      sku: row.product.skuCode,
      name: row.product.productName,
      category: row.product.category,
      subcategory: row.product.subcategory,
      brand: row.product.brand,
      tags: row.product.tags,
      productType: row.product.productType,
      physicalType: row.product.physicalType,
      roles: row.roles,
      preference: row.preference,
      cpc: cpcs[i],
      price: row.product.price > 0
        ? "₹" + row.product.price.toLocaleString("en-IN")
        : "Price on request",
      availability: "In Stock",
      img: row.product.images[0] || "",
      description: row.product.description,
      specs: row.product.specifications
        .map(s => `${s.specification}: ${s.value}${s.unit && s.unit !== '-' ? ' ' + s.unit : ''}`)
        .filter(Boolean),
      leadTime: row.product.leadTime,
      moq: row.product.moq || 0,
      priceNum: row.product.price || 0,
      generalSpecs: row.product.generalSpecs
        .filter(g => g.category || g.attributeValue)
        .map(g => ({ label: g.category, value: g.attributeValue })),
      variations: row.product.variations || [],
      productNotes: row.product.productNotes,
      videoUrl: row.product.videoUrl,
      warranty: row.product.warranty,
    }));
    onAdd(entries);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add New Product</h2>
            <p className="text-xs text-gray-400 mt-0.5">Search and select products from the master catalog to add to this client</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 flex flex-col">

          {/* ── Section 1: Search & Select ── */}
          <div className="flex flex-col border-b border-gray-200">
            {/* Section header */}
            <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Search &amp; Select Products</h3>
                <p className="text-xs text-gray-400 mt-0.5">Check the boxes next to the products you want to add</p>
              </div>
              {selectedIds.size > 0 && (
                <span className="ml-auto text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {/* Search bar */}
            <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100">
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by product name, master product code, category or brand…"
                  className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Products table */}
            <div className="w-full overflow-x-auto">
              {catalog.length === 0 ? (
                <div className="px-8 py-16 text-center text-gray-400 text-sm">
                  No products in master catalog yet. Add products via Master Catalog first.
                </div>
              ) : availableCatalog.length === 0 ? (
                <div className="px-8 py-16 text-center text-gray-400 text-sm">
                  All available products are already added to this client&apos;s catalog.
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-8 py-12 text-center text-gray-400 text-sm">
                  No products match "<span className="font-medium text-gray-600">{query}</span>"
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <th className="px-8 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-14"></th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((product) => {
                      const checked = selectedIds.has(product.id);
                      return (
                        <tr
                          key={product.id}
                          onClick={() => toggleSelect(product)}
                          className={`cursor-pointer transition-colors ${checked ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-8 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(product)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ProductThumb images={product.images} name={product.productName} />
                              <div>
                                <div className="font-medium text-gray-900 text-sm leading-tight">{product.productName}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">{product.masterProductCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">{product.masterProductCode || "—"}</span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700 text-sm">{product.category || "—"}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700 text-sm">{product.brand || "—"}</td>
                          <td className="px-4 py-2 max-w-xs">
                            <span className="text-gray-500 text-sm line-clamp-2">{product.description || "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Section 2: Assign Roles & Preferences ── */}
          <div className="flex flex-col">
            <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Assign Roles &amp; Preferences
                  {rows.length > 0 && <span className="ml-2 text-blue-600">({rows.length} product{rows.length !== 1 ? "s" : ""})</span>}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Assign a role to each product; preference is optional</p>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="px-8 py-12 text-center text-gray-400 text-sm">
                No products selected yet — check items in the list above to assign roles and preferences.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-8 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Preference (optional)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Client Product Code</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedRows.map((row, idx) => (
                      <tr key={row.product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-3.5 text-gray-500 text-sm font-medium">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <ProductThumb images={row.product.images} name={row.product.productName} />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm leading-tight">{row.product.productName}</div>
                              <div className="text-xs text-gray-400 font-mono mt-0.5">{row.product.masterProductCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">{row.product.masterProductCode || "—"}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-700 text-sm">{row.product.category || "—"}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-700 text-sm">{row.product.brand || "—"}</td>
                        <td className="px-4 py-3.5">
                          <RoleDropdown
                            values={row.roles}
                            roles={roles}
                            onToggle={(r) => toggleRowRole(row.product.id, r)}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <PreferenceDropdown
                            value={row.preference}
                            preferences={preferences}
                            onSelect={(v) => updateRow(row.product.id, "preference", v)}
                            onAddNew={addPreference}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block min-w-[110px] px-2 py-1.5 text-sm font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-md">
                            {row.cpc}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => removeProduct(row.product.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-2 py-2 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
        <span className="text-sm text-gray-500">
          {rows.length === 0 ? "No products selected yet" : `${rows.length} product${rows.length !== 1 ? "s" : ""} selected`}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            disabled={rows.length === 0}
            onClick={handleAddProducts}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Product{rows.length > 1 ? "s" : ""}
          </button>
        </div>
      </div>

      {/* Validation warning modal — require a role before adding */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-2 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Missing Required Details</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Please set a role for every selected product before adding them.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {validationErrors.map((err, i) => (
                <div key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-2.5">
                  <p className="text-sm font-medium text-gray-800 leading-tight truncate">{err.productName}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Missing: {err.missing.join(", ")}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setValidationErrors([])}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back &amp; Fill Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientCatalogPage({ clientId = "CLI-DEFAULT" }: { clientId?: string }) {
  const [search, setSearch] = useState("");
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [productTab, setProductTab] = useState<CatalogProductTab>("physical");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [viewProduct, setViewProduct] = useState<CatalogEntry | null>(null);
  const [editProduct, setEditProduct] = useState<CatalogEntry | null>(null);
  const [products, setProducts] = useState<CatalogEntry[]>(() => getClientCatalog(clientId));
  // When prices are refreshed externally (price engine rules changed) we update
  // state directly from the store without triggering the save-back effect.
  const skipNextSave = useRef(false);

  // Reload from store when clientId changes
  useEffect(() => {
    setProducts(getClientCatalog(clientId));
  }, [clientId]);

  // Keep the shop page in sync: whenever this catalog is opened for a client,
  // pre-select that same client in the shop so products appear immediately.
  useEffect(() => {
    if (clientId && clientId !== "CLI-DEFAULT") {
      localStorage.setItem("nido_shop_selected_client", clientId);
    } else {
      localStorage.removeItem("nido_shop_selected_client");
    }
  }, [clientId]);

  // Listen for price-engine updates (category rules, slabs, margin changes) and
  // pull fresh price/priceNum values into state so the table re-renders immediately.
  useEffect(() => {
    const refreshPrices = () => {
      const fresh = getClientCatalog(clientId);
      skipNextSave.current = true;
      setProducts(prev =>
        prev.map(p => {
          const updated = fresh.find(f => f.productCode === p.productCode);
          return updated ? { ...p, price: updated.price, priceNum: updated.priceNum } : p;
        })
      );
    };
    window.addEventListener('priceEngineSettingsUpdated', refreshPrices);
    return () => window.removeEventListener('priceEngineSettingsUpdated', refreshPrices);
  }, [clientId]);

  // Persist to store whenever products change — skipped when triggered by an
  // external price refresh so we don't overwrite freshly computed prices.
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveClientCatalog(clientId, products);
  }, [products, clientId]);

  const tabProducts = products.filter((product) =>
    productTab === "digital" ? isDigitalCatalogEntry(product) : !isDigitalCatalogEntry(product)
  );
  const filtered = tabProducts
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => prefOrder(a.preference) - prefOrder(b.preference));

  const totalItems = products.length;
  const inStock = products.filter((p) => p.availability === "In Stock").length;
  const lowStock = products.filter((p) => p.availability === "Low Stock").length;
  const outOfStock = products.filter((p) => p.availability === "Out of Stock").length;

  const removeRole = (sku: string, role: string) => {
    setProducts((prev) =>
      prev.map((p) => p.sku === sku ? { ...p, roles: p.roles.filter((r) => r !== role) } : p)
    );
  };

  const handleSaveEdit = (sku: string, updated: Partial<CatalogEntry>) => {
    setProducts((prev) => prev.map((p) => p.sku === sku ? { ...p, ...updated } : p));
  };

  // Merge new entries, persist, run price engine, then reload synced prices into state.
  // Side effects are kept outside the state updater so they run exactly once.
  const handleAddProducts = (entries: CatalogEntry[]) => {
    const existing = new Set(products.map((p) => normalizeMasterProductCode(p.productCode)));
    const toAdd = entries.filter(
      (entry) => !existing.has(normalizeMasterProductCode(entry.productCode))
    );
    if (toAdd.length === 0) return;
    const merged = [...products, ...toAdd];
    saveClientCatalog(clientId, merged);
    syncClientPrices(clientId);
    setProducts(getClientCatalog(clientId));
  };

  return (
    <div className="p-5 flex flex-col gap-4" onClick={() => { setRowMenu(null); setHeaderMenu(false); }}>
      <>
      {showAddProduct && (
        <AddNewProductModal
          clientId={clientId}
          onClose={() => setShowAddProduct(false)}
          onAdd={handleAddProducts}
        />
      )}
      {viewProduct && (
        <ProductViewScreen product={viewProduct} onClose={() => setViewProduct(null)} />
      )}
      {editProduct && (
        <EditProductScreen
          product={editProduct}
          clientId={clientId}
          onClose={() => setEditProduct(null)}
          onSave={(updated) => handleSaveEdit(editProduct.sku, updated)}
        />
      )}
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white">
          <p className="text-xs text-gray-500 mb-1">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white">
          <p className="text-xs text-gray-500 mb-1">In Stock</p>
          <p className="text-2xl font-bold text-green-500">{inStock}</p>
        </div>
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white">
          <p className="text-xs text-gray-500 mb-1">Low Stock</p>
          <p className="text-2xl font-bold text-orange-400">{lowStock}</p>
        </div>
        <div className="border border-gray-200 rounded-xl px-2 py-2 bg-white">
          <p className="text-xs text-gray-500 mb-1">Out of Stock</p>
          <p className="text-2xl font-bold text-red-500">{outOfStock}</p>
        </div>
      </div>

      {/* Catalog table card */}
      <div className="border border-gray-200 rounded-xl bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Client Catalog</h2>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setHeaderMenu((v) => !v); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {headerMenu && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-44" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setShowAddProduct(true); setHeaderMenu(false); }} className="w-full flex items-center gap-2 px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  <span className="text-gray-400"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
                  Add New Product
                </button>
                <button onClick={() => setHeaderMenu(false)} className="w-full flex items-center gap-2 px-2 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                  <Download size={13} className="text-gray-400" /> Export
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-5 px-4 pt-2 border-b border-gray-100">
          {([
            ["physical", "Physical Products", products.filter((product) => !isDigitalCatalogEntry(product)).length],
            ["digital", "Digital Products", products.filter((product) => isDigitalCatalogEntry(product)).length],
          ] as const).map(([tab, label, count]) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setProductTab(tab); setPage(1); }}
              className={`border-b-2 pb-2 text-xs font-semibold transition-colors ${
                productTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label} <span className="ml-1 text-[10px] font-medium text-gray-400">({count})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, brand..."
              className="w-full pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-32 whitespace-nowrap">Client Product Code</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-28">Product ID</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Product</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-28">Category <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Roles <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-36">Vendor Mapping / Price <Filter size={9} className="inline ml-0.5 text-gray-400" /></th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-28">{productTab === "digital" ? "Users / Licenses" : "Units / MOQ"}</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-28">{productTab === "digital" ? "Tenure / Billing" : "Stock"}</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-28">{productTab === "digital" ? "Provisioning" : "Lead Time"}</th>
                <th className="text-left px-2 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product, i) => (
                <tr key={product.sku} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                  <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">{product.cpc || "—"}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-[10px]">{product.productCode}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {product.img ? (
                        <img src={product.img} alt={product.name} className="w-8 h-8 rounded object-cover bg-gray-100 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 border border-blue-200">{product.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <span className="font-medium text-gray-800 text-[11px]">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{product.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {product.roles.map((role) => (
                        <span key={role} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                          {role}
                          <button onClick={(e) => { e.stopPropagation(); removeRole(product.sku, role); }} className="text-blue-400 hover:text-blue-700 leading-none">×</button>
                        </span>
                      ))}
                    </div>
                  </td>
                  {(() => {
                    const digital = isDigitalCatalogEntry(product);
                    const type = getProductType(product.physicalType || product.productType);
                    const terms = getTenureBilling(type);
                    const quantityLabel = getQuantityLabel(type);
                    const leadTime = formatLeadTimeByType(product.leadTime, type);
                    const vendorSummary = getCatalogVendorSummary(product.productCode);
                    return (
                      <>
                        <td className="px-4 py-2">
                          <div className="font-semibold text-gray-900">{product.price}</div>
                          <div className="text-[10px] text-gray-500">
                            {vendorSummary.names.length > 0
                              ? `${vendorSummary.names.join(", ")} · ${vendorSummary.price}`
                              : "No active vendor mapping"}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">{product.moq || "—"} <span className="text-[10px] text-gray-500">{quantityLabel}</span></td>
                        <td className="px-4 py-3">
                          {digital ? (
                            <div className="text-[10px] text-gray-700">
                              <div className="font-semibold">{terms.tenure}</div>
                              <div className="text-gray-500">{terms.billing}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-gray-800">{vendorSummary.stock.toLocaleString("en-IN")} Units</div>
                              <span className={`mt-1 inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                vendorSummary.stock > 10 ? "bg-green-50 text-green-700 border-green-200"
                                : vendorSummary.stock > 0 ? "bg-orange-50 text-orange-600 border-orange-200"
                                : "bg-red-50 text-red-500 border-red-200"
                              }`}>
                                {vendorSummary.stock > 10 ? "In Stock" : vendorSummary.stock > 0 ? "Low Stock" : "Out of Stock"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          <div>{leadTime.primary}</div>
                          {leadTime.secondary && <div className="text-[10px] text-gray-400">{leadTime.secondary}</div>}
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-2 relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRowMenu(rowMenu === product.sku ? null : product.sku); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <MoreVertical size={13} />
                    </button>
                    {rowMenu === product.sku && (
                      <div className="absolute right-8 top-2 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-48" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setViewProduct(product); setRowMenu(null); }}
                          className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700"
                        >
                          <Eye size={12} className="text-gray-400" /> View Product
                        </button>
                        <button
                          onClick={() => { setEditProduct(product); setRowMenu(null); }}
                          className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-gray-700"
                        >
                          <Pencil size={12} className="text-gray-400" /> Edit Roles &amp; Preferences
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          onClick={() => { setProducts((prev) => prev.filter((p) => p.sku !== product.sku)); setRowMenu(null); }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors text-red-500"
                        >
                          Remove Product
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-400">No products match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="flex items-center justify-between px-2 py-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-500">Showing 1 to {filtered.length} of {filtered.length} products</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-colors disabled:opacity-40">–</button>
            <span className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-semibold">{page}</span>
            <button onClick={() => setPage((p) => p + 1)} className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs transition-colors">+</button>
          </div>
        </div>
      </div>
      </>
    </div>
  );
}
