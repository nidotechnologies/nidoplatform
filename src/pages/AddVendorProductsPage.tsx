import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Search, X, ChevronLeft, ChevronRight, Plus, Trash2, Info, Save, AlertTriangle, Check } from "lucide-react";
import { getCatalogProducts, CatalogProduct, CatalogVariation, CatalogVariationOption } from "@/lib/catalogStore";
import { getPrefix } from "@/lib/configService";
import {
  addVendorProducts,
  updateVendorProduct,
  getVendorProducts,
  isCatalogProductAlreadyAssigned,
  getAllVendorProducts,
  peekVpcCounter,
  reserveVendorProductCodes,
  VendorProduct,
} from "@/lib/vendorStore";
import {
  formatLeadTimeByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  getTenureBilling,
  isDigitalOnlyType,
  isHybridType,
} from "@/lib/productTypeRules";

// ─── Thumb ────────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedRow {
  catalogProduct: CatalogProduct;
  price: string;
  moq: string;
  leadTime: string;
  stock: string;
  vendorProductCode: string;
  variations: CatalogVariation[];
}

type SelectedProductTab = "physical" | "digital";

function isDigitalCatalogProduct(product: CatalogProduct): boolean {
  return isDigitalOnlyType(getProductType(product.physicalType || product.productType));
}

function selectedProductType(product: CatalogProduct): string {
  return getProductType(product.physicalType || product.productType);
}

function selectedProductTypeClasses(type: string): string {
  if (isDigitalOnlyType(type)) return "bg-violet-50 text-violet-700";
  if (isHybridType(type)) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function createVariationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function VendorVariationsDialog({
  productName,
  initialVariations,
  onCancel,
  onSave,
}: {
  productName: string;
  initialVariations: CatalogVariation[];
  onCancel: () => void;
  onSave: (variations: CatalogVariation[]) => void;
}) {
  const [variations, setVariations] = useState<CatalogVariation[]>(
    () => initialVariations.map(variation => ({
      ...variation,
      options: variation.options.map(option => ({ ...option })),
    })),
  );

  const addVariation = () => {
    setVariations(current => [
      ...current,
      {
        id: createVariationId("vendor-variation"),
        name: "",
        options: [{
          id: createVariationId("vendor-option"),
          label: "",
          priceAdjustment: 0,
        }],
      },
    ]);
  };

  const updateVariation = (id: string, name: string) => {
    setVariations(current => current.map(variation =>
      variation.id === id ? { ...variation, name } : variation,
    ));
  };

  const removeVariation = (id: string) => {
    setVariations(current => current.filter(variation => variation.id !== id));
  };

  const addOption = (variationId: string) => {
    setVariations(current => current.map(variation =>
      variation.id === variationId
        ? {
            ...variation,
            options: [
              ...variation.options,
              { id: createVariationId("vendor-option"), label: "", priceAdjustment: 0 },
            ],
          }
        : variation,
    ));
  };

  const updateOption = (
    variationId: string,
    optionId: string,
    field: keyof CatalogVariationOption,
    value: string,
  ) => {
    setVariations(current => current.map(variation =>
      variation.id !== variationId
        ? variation
        : {
            ...variation,
            options: variation.options.map(option =>
              option.id !== optionId
                ? option
                : {
                    ...option,
                    [field]: field === "priceAdjustment" ? (Number(value) || 0) : value,
                  },
            ),
          },
    ));
  };

  const removeOption = (variationId: string, optionId: string) => {
    setVariations(current => current.map(variation =>
      variation.id === variationId
        ? { ...variation, options: variation.options.filter(option => option.id !== optionId) }
        : variation,
    ));
  };

  const save = () => {
    const cleaned = variations
      .map(variation => ({
        ...variation,
        name: variation.name.trim(),
        options: variation.options
          .map(option => ({
            ...option,
            label: option.label.trim(),
            priceAdjustment: Number(option.priceAdjustment) || 0,
          }))
          .filter(option => option.label),
      }))
      .filter(variation => variation.name && variation.options.length > 0);
    onSave(cleaned);
  };

  return (
    <div data-confirmation-skip className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Add Variations</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Configure vendor-specific options and prices for {productName}.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {variations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/40 px-4 py-8 text-center text-xs text-gray-500">
              No variations yet. Add fields such as Users, Plan, Storage, Region, Support, or Billing Cycle.
            </div>
          ) : (
            variations.map((variation, variationIndex) => (
              <div key={variation.id} className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <div className="flex items-start gap-3">
                  <label className="flex-1">
                    <span className="text-xs font-semibold text-gray-700">Variation field {variationIndex + 1}</span>
                    <input
                      value={variation.name}
                      onChange={event => updateVariation(variation.id, event.target.value)}
                      placeholder="e.g. Users, Plan, Storage, Region"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVariation(variation.id)}
                    className="mt-5 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove variation ${variationIndex + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Options and price adjustments</p>
                  {variation.options.map((option, optionIndex) => (
                    <div key={option.id} className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-2">
                      <input
                        value={option.label}
                        onChange={event => updateOption(variation.id, option.id, "label", event.target.value)}
                        placeholder={`Option ${optionIndex + 1}`}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-400"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={option.priceAdjustment}
                          onChange={event => updateOption(variation.id, option.id, "priceAdjustment", event.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-14 text-xs text-gray-800 outline-none focus:border-blue-400"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">₹ adj.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(variation.id, option.id)}
                        disabled={variation.options.length === 1}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={`Remove option ${optionIndex + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(variation.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add option
                  </button>
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={addVariation}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> Add variation field
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save Variations</button>
        </div>
      </div>
    </div>
  );
}

type UpdateSelectedRow = (
  id: string,
  field: keyof Omit<SelectedRow, "catalogProduct">,
  value: string | CatalogVariation[],
) => void;

function SelectedProductsTable({
  rows,
  isEditMode,
  selectedTab,
  updateRow,
  editVariations,
  removeSelected,
}: {
  rows: SelectedRow[];
  isEditMode: boolean;
  selectedTab: SelectedProductTab;
  updateRow: UpdateSelectedRow;
  editVariations: (row: SelectedRow) => void;
  removeSelected: (id: string) => void;
}) {
  const isDigitalTab = selectedTab === "digital";

  return (
    <div className="w-full overflow-x-visible">
      <table className="w-full text-sm" style={{ minWidth: isDigitalTab ? "860px" : "980px" }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">VPC / MPI</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pricing Model</th>
            {!isDigitalTab && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                <span className="flex items-center gap-1">Price / Unit <Info className="w-3 h-3 text-gray-400" /></span>
              </th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="flex items-center gap-1">{isDigitalTab ? "Variations" : "Units / MOQ"} <Info className="w-3 h-3 text-gray-400" /></span>
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span className="flex items-center gap-1">{isDigitalTab ? "Tenure / Billing" : "Stock"} <Info className="w-3 h-3 text-gray-400" /></span>
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
              {isDigitalTab ? "Provisioning Time" : "Lead Time"}
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const type = selectedProductType(row.catalogProduct);
            const digital = isDigitalOnlyType(type);
            const tenureBilling = getTenureBilling(type);
            const formattedLeadTime = formatLeadTimeByType(row.leadTime, type);

            return (
              <tr key={row.catalogProduct.id} className="hover:bg-gray-50/40 transition-colors">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ProductThumb images={row.catalogProduct.images} name={row.catalogProduct.productName} />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 text-sm leading-tight truncate max-w-[180px]">{row.catalogProduct.productName}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{row.catalogProduct.masterProductCode}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <span className={`inline-flex max-w-[120px] rounded-md px-2 py-1.5 text-[10px] font-semibold leading-snug ${selectedProductTypeClasses(type)}`}>
                    {type}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="space-y-1">
                    <div className="font-mono text-[10px] text-gray-700 break-all">{row.vendorProductCode || "—"}</div>
                    <div className="font-mono text-[10px] text-gray-500 break-all">{row.catalogProduct.masterProductCode || "—"}</div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-gray-700 break-words">{getPricingModel(type)}</td>
                {!digital && (
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateRow(row.catalogProduct.id, "price", e.target.value)}
                      aria-label={`${row.catalogProduct.productName} price per unit`}
                      placeholder="0.00"
                      className="w-full min-w-[90px] max-w-[110px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </td>
                )}
                <td className="px-3 py-3">
                  {digital ? (
                    <button
                      type="button"
                      onClick={() => editVariations(row)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {row.variations.length > 0 ? `Edit (${row.variations.length})` : "Add Variations"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={row.moq}
                        onChange={(e) => updateRow(row.catalogProduct.id, "moq", e.target.value)}
                        placeholder="0"
                        className="w-full min-w-[56px] max-w-[76px] px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-gray-500">{getQuantityLabel(type)}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  {digital ? (
                    <div className="space-y-1 text-[10px] text-gray-700">
                      <div className="font-semibold">{tenureBilling.tenure}</div>
                      <div className="text-gray-500">{tenureBilling.billing}</div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={row.stock}
                      onChange={(e) => updateRow(row.catalogProduct.id, "stock", e.target.value)}
                      placeholder="0"
                      className="w-full min-w-[64px] max-w-[80px] px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={row.leadTime}
                      onChange={(e) => updateRow(row.catalogProduct.id, "leadTime", e.target.value)}
                      placeholder="0"
                      className="w-full min-w-[64px] max-w-[80px] px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-gray-500">
                      {formattedLeadTime.primary}{formattedLeadTime.secondary ? ` · ${formattedLeadTime.secondary}` : ""}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {!isEditMode ? (
                    <button
                      type="button"
                      onClick={() => removeSelected(row.catalogProduct.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      aria-label={`Remove ${row.catalogProduct.productName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PAGE_SIZE = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export default function AddVendorProductsPage() {
  const { id: vendorId = "unknown" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const editProductId = searchParams.get("edit"); // null → add mode, string → edit mode
  const isEditMode = Boolean(editProductId);

  // ── Catalog ──────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>(() => getVendorProducts(vendorId));
  useEffect(() => {
    const loadPublished = () =>
      setCatalog(getCatalogProducts().filter((p) => p.publishStatus === "published"));
    loadPublished();
    window.addEventListener("catalogUpdated", loadPublished);
    return () => window.removeEventListener("catalogUpdated", loadPublished);
  }, []);
  useEffect(() => {
    const loadVendorProducts = () => setVendorProducts(getVendorProducts(vendorId));
    loadVendorProducts();
    window.addEventListener("vendorProductsUpdated", loadVendorProducts);
    return () => window.removeEventListener("vendorProductsUpdated", loadVendorProducts);
  }, [vendorId]);

  // ── Search ───────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);

  const availableCatalog = useMemo(
    () => catalog.filter((product) => !isCatalogProductAlreadyAssigned(product, vendorProducts)),
    [catalog, vendorProducts],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return availableCatalog;
    return availableCatalog.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.skuCode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.masterProductCode.toLowerCase().includes(q)
    );
  }, [availableCatalog, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
      if (page < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  }, [page, totalPages]);

  // ── Selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<SelectedRow[]>([]);
  const [selectedProductTab, setSelectedProductTab] = useState<SelectedProductTab>("physical");
  const [variationRow, setVariationRow] = useState<SelectedRow | null>(null);

  // In edit mode: pre-populate with the existing product
  useEffect(() => {
    if (!isEditMode || !editProductId) return;
    const existing = getVendorProducts(vendorId).find((p) => p.id === editProductId);
    if (!existing) return;
    const catalogProduct = getCatalogProducts().find((p) => p.id === editProductId);
    if (!catalogProduct) return;
    setSelectedIds(new Set([editProductId]));
    setSelectedProductTab(isDigitalCatalogProduct(catalogProduct) ? "digital" : "physical");
    setSelectedRows([{
      catalogProduct,
      price: existing.price,
      moq: existing.moq,
      leadTime: existing.leadTime,
      stock: existing.stock,
      vendorProductCode: existing.vendorProductCode,
      variations: Array.isArray(existing.variations) ? existing.variations : [],
    }]);
  }, [editProductId, isEditMode, vendorId]);

  const toggleSelect = useCallback((product: CatalogProduct) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
        setSelectedRows((rows) => rows.filter((r) => r.catalogProduct.id !== product.id));
      } else {
        next.add(product.id);
        setSelectedProductTab(isDigitalCatalogProduct(product) ? "digital" : "physical");
        // Compute a *preview* VPC for display — peekVpcCounter() is a pure
        // localStorage read with no side-effects, so it is safe to call inside
        // a React state updater (even under Strict Mode's double-invocation).
        // The persistent counter is NOT incremented here; codes are only
        // reserved when the user confirms with "Add Products", so cancelling
        // the page wastes no sequence numbers.
        setSelectedRows((rows) => {
          const vpcPrefix = getPrefix('vendorProductCode') || 'VPC-';
          const preview = `${vpcPrefix}${String(peekVpcCounter() + rows.length + 1).padStart(5, '0')}`;
          return [...rows, {
            catalogProduct: product,
            price: isDigitalCatalogProduct(product)
              ? String(Number.isFinite(product.price) ? product.price : 0)
              : "",
            moq: isDigitalCatalogProduct(product) ? "1" : "",
            leadTime: "",
            stock: "",
            vendorProductCode: preview,
            variations: [],
          }];
        });
      }
      return next;
    });
  }, []);

  const removeSelected = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setSelectedRows((rows) => rows.filter((r) => r.catalogProduct.id !== id));
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof Omit<SelectedRow, "catalogProduct">, value: string | CatalogVariation[]) => {
      setSelectedRows((rows) => rows.map((r) => r.catalogProduct.id === id ? { ...r, [field]: value } : r));
    },
    []
  );

  const saveRowVariations = (variations: CatalogVariation[]) => {
    if (!variationRow) return;
    updateRow(variationRow.catalogProduct.id, "variations", variations);
    setVariationRow(null);
  };

  // ── Validation modal ─────────────────────────────────────────────────────
  type MissingField = { productName: string; missing: string[] };
  const [validationErrors, setValidationErrors] = useState<MissingField[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ── Submit ───────────────────────────────────────────────────────────────
  const commitProducts = () => {
    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    if (isEditMode && editProductId) {
      // In edit mode the product already has a VPC — keep it as-is.
      const row = selectedRows[0];
      updateVendorProduct(vendorId, editProductId, {
        price: row.price,
        moq: isDigitalCatalogProduct(row.catalogProduct) ? row.moq || "1" : row.moq,
        leadTime: row.leadTime,
        stock: isDigitalCatalogProduct(row.catalogProduct) ? row.stock || "0" : row.stock,
        vendorProductCode: row.vendorProductCode,
        variations: isDigitalCatalogProduct(row.catalogProduct) ? row.variations : [],
      });
    } else {
      // Reserve sequential VPC codes only after the user confirms the review.
      const vpcs = reserveVendorProductCodes(selectedRows.length);
      const products: VendorProduct[] = selectedRows.map((r, i) => ({
        id: r.catalogProduct.id,
        vendorId,
        masterProductCode: r.catalogProduct.masterProductCode,
        skuCode: r.catalogProduct.skuCode,
        productName: r.catalogProduct.productName,
        category: r.catalogProduct.category,
        brand: r.catalogProduct.brand,
        physicalType: r.catalogProduct.physicalType,
        images: r.catalogProduct.images,
        price: r.price,
        moq: isDigitalCatalogProduct(r.catalogProduct) ? r.moq || "1" : r.moq,
        leadTime: r.leadTime,
        stock: isDigitalCatalogProduct(r.catalogProduct) ? r.stock || "0" : r.stock,
        variations: isDigitalCatalogProduct(r.catalogProduct) ? r.variations : [],
        reservedStock: "0",
        incomingStock: "0",
        lastStockUpdate: new Date().toISOString(),
        vendorProductCode: vpcs[i],
        addedAt: now,
        status: "Active",
      }));
      addVendorProducts(vendorId, products);
    }
    setShowConfirmation(false);
    navigate(`/vendors/${vendorId}`, { state: { tab: "products" } });
  };

  const handleSubmit = () => {
    if (selectedRows.length === 0) return;

    // Validate required vendor-specific fields before saving
    const errors: MissingField[] = [];
    for (const row of selectedRows) {
      const missing: string[] = [];
        if (!isDigitalCatalogProduct(row.catalogProduct)) {
          const basePrice = Number(row.price);
          if (!row.price || row.price.trim() === "" || !Number.isFinite(basePrice) || basePrice < 0) {
            missing.push("Price / Unit");
          }
        }
      if (!isDigitalCatalogProduct(row.catalogProduct) && (!row.moq || row.moq.trim() === "")) {
        missing.push("MOQ");
      }
      if (!row.leadTime || row.leadTime.trim() === "") missing.push("Lead Time");
      if (!isDigitalCatalogProduct(row.catalogProduct) && (!row.stock || row.stock.trim() === "")) {
        missing.push("Stock");
      }
      if (missing.length > 0) errors.push({ productName: row.catalogProduct.productName, missing });
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!isEditMode) {
      setShowConfirmation(true);
      return;
    }

    commitProducts();
  };

  const goBack = () => navigate(`/vendors/${vendorId}`, { state: { tab: "products" } });
  const physicalSelectedCount = selectedRows.filter((row) => !isDigitalCatalogProduct(row.catalogProduct)).length;
  const digitalSelectedCount = selectedRows.length - physicalSelectedCount;
  const visibleSelectedRows = selectedRows.filter((row) =>
    selectedProductTab === "digital"
      ? isDigitalCatalogProduct(row.catalogProduct)
      : !isDigitalCatalogProduct(row.catalogProduct)
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-white font-[Inter,sans-serif]">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-2 py-2 shadow-sm">
        <div className="flex items-center gap-2 mb-0.5">
          <button onClick={goBack} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">
            {isEditMode ? "Edit Product" : "Add Products to Vendor"}
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-7">
          {isEditMode
            ? "Update the vendor-specific details for this product."
            : "Search and select products from master catalog and set vendor-specific details."}
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-2 py-2 flex flex-col gap-4">

        {/* ── Section 1: Search & Select ── */}
        {!isEditMode && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">

            {/* Header */}
            <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <h2 className="text-sm font-semibold text-gray-800">Search &amp; Select Products</h2>
              {selectedIds.size > 0 && (
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {/* Search bar */}
            <div className="flex-shrink-0 px-2 py-2.5 border-b border-gray-100">
              <div className="relative max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by product name, SKU, category, brand…"
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table area */}
            <div className="w-full overflow-x-visible">
              {catalog.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  No products in master catalog yet. Add products via Master Catalog first.
                </div>
              ) : availableCatalog.length === 0 && !query.trim() ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  All published products have already been added to this vendor.
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-5 py-2 text-center text-gray-400 text-sm">
                  No products match "<span className="font-medium text-gray-600">{query}</span>"
                </div>
              ) : (
                <table className="w-full text-sm" style={{ minWidth: "620px" }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Select</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Master Product Code</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((product) => {
                      const checked = selectedIds.has(product.id);
                      return (
                        <tr
                          key={product.id}
                          onClick={() => toggleSelect(product)}
                          className={`cursor-pointer transition-colors ${checked ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(product)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <ProductThumb images={product.images} name={product.productName} />
                              <div>
                                <div className="font-medium text-gray-800 text-sm leading-tight">{product.productName}</div>
                                <div className="text-xs text-gray-400 font-mono mt-0.5">{product.masterProductCode}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{product.masterProductCode || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-sm">{product.category || "—"}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 text-sm">{product.brand || "—"}</td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <span className="text-gray-500 text-xs line-clamp-2">{product.description || "—"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination — always visible at bottom of section 1 */}
            {filtered.length > 0 && (
              <div className="flex-shrink-0 px-2 py-2.5 flex items-center justify-between border-t border-gray-100 bg-white">
                <span className="text-xs text-gray-500">
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {pageNumbers.map((n, i) =>
                    n === "…" ? (
                      <span key={`e${i}`} className="px-1 text-gray-400 text-xs">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${page === n ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section 2: Selected Products ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">

          {/* Header */}
          <div className="flex-shrink-0 px-2 py-2 border-b border-gray-100 flex items-center gap-3">
            {!isEditMode && (
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            )}
            <h2 className="text-sm font-semibold text-gray-800">
              {isEditMode
                ? "Product Details"
                : <>Selected Products{selectedRows.length > 0 && <span className="ml-1.5 text-blue-600">({selectedRows.length})</span>}</>
              }
            </h2>
          </div>

          {!isEditMode && (
            <div className="flex items-end gap-5 px-4 pt-2 border-b border-gray-100">
              {([
                ["physical", "Physical Selected Products", physicalSelectedCount],
                ["digital", "Digital Selected Products", digitalSelectedCount],
              ] as const).map(([tab, label, count]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedProductTab(tab)}
                  className={`border-b-2 pb-2 text-xs font-semibold transition-colors ${
                    selectedProductTab === tab
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label} <span className="ml-1 text-[10px] font-medium text-gray-400">({count})</span>
                </button>
              ))}
            </div>
          )}

          {selectedRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              {isEditMode ? "Product details are shown here." : `No ${selectedProductTab} products selected yet — check items in the list above.`}
            </div>
          ) : (
            <>
              {visibleSelectedRows.length === 0 && !isEditMode ? (
                <div className="flex min-h-32 items-center justify-center text-gray-400 text-sm">
                  No {selectedProductTab} products selected yet.
                </div>
              ) : (
                <>
                <SelectedProductsTable
                  rows={isEditMode ? selectedRows : visibleSelectedRows}
                  isEditMode={isEditMode}
                  selectedTab={selectedProductTab}
                  updateRow={updateRow}
                  editVariations={setVariationRow}
                  removeSelected={removeSelected}
                />
                </>
              )}

              {!isEditMode && (
                <div className="flex-shrink-0 px-2 py-2 border-t border-gray-100 bg-white">
                  <span className="text-xs text-gray-500">
                    {selectedRows.length} product{selectedRows.length !== 1 ? "s" : ""} selected
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {variationRow && (
        <VendorVariationsDialog
          productName={variationRow.catalogProduct.productName}
          initialVariations={variationRow.variations}
          onCancel={() => setVariationRow(null)}
          onSave={saveRowVariations}
        />
      )}

      {/* ── Review confirmation modal ── */}
      {showConfirmation && !isEditMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-products-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-start gap-3 px-6 py-5 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 id="review-products-title" className="text-base font-semibold text-gray-900">
                  Review Products Before Adding
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Check the product and vendor details below. Products will be added only after you confirm.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedRows.map((row) => (
                <div key={row.catalogProduct.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <ProductThumb images={row.catalogProduct.images} name={row.catalogProduct.productName} />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{row.catalogProduct.productName}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {row.catalogProduct.masterProductCode || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 px-4 py-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">SKU</p>
                      <p className="text-sm text-gray-800 mt-0.5 break-words">{row.catalogProduct.skuCode || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Category</p>
                      <p className="text-sm text-gray-800 mt-0.5 break-words">{row.catalogProduct.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Brand</p>
                      <p className="text-sm text-gray-800 mt-0.5 break-words">{row.catalogProduct.brand || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Vendor Product Code</p>
                      <p className="text-sm font-mono text-gray-800 mt-0.5 break-words">{row.vendorProductCode}</p>
                    </div>
                    {!isDigitalCatalogProduct(row.catalogProduct) && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Price / Unit</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{row.price}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">
                        {isDigitalCatalogProduct(row.catalogProduct) ? "Users / Licenses" : "Units / MOQ"}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">{row.moq}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">
                        {isDigitalCatalogProduct(row.catalogProduct) ? "Provisioning Time" : "Lead Time"}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">
                        {formatLeadTimeByType(row.leadTime, selectedProductType(row.catalogProduct)).primary}
                      </p>
                    </div>
                    {isDigitalCatalogProduct(row.catalogProduct) ? (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Tenure / Billing</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">
                          {(() => {
                            const terms = getTenureBilling(selectedProductType(row.catalogProduct));
                            return `${terms.tenure} · ${terms.billing}`;
                          })()}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Stock</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{row.stock}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {selectedRows.length} product{selectedRows.length === 1 ? "" : "s"} ready to add
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel &amp; Modify
                </button>
                <button
                  onClick={commitProducts}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Confirm &amp; Add Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Validation warning modal ── */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-2 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Missing Required Details</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Please fill in all required fields before adding products.
                </p>
              </div>
            </div>

            {/* Error list */}
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

            {/* Action */}
            <button
              onClick={() => setValidationErrors([])}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back &amp; Fill Details
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-2 py-2 flex items-center justify-end gap-3 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
        <button
          onClick={goBack}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={selectedRows.length === 0}
          className="flex items-center gap-2 px-2 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isEditMode ? (
            <><Save className="w-4 h-4" /> Save Changes</>
          ) : (
            <><Plus className="w-4 h-4" /> Add Products</>
          )}
        </button>
      </div>
    </div>
  );
}
