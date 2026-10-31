import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Minus,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckSquare,
  AlertTriangle,
  Tag,
  Clock,
  Star,
  Download,
  Upload,
  RefreshCcw,
  BookOpen,
  Pencil,
  Trash2,
  X,
  IndianRupee,
  Layers,
  Timer,
  Warehouse,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { getCatalogProducts, CatalogProduct } from "@/lib/catalogStore";
import {
  getVendorProducts,
  removeVendorProduct,
  updateVendorProduct,
  addVendorProducts,
  reserveVendorProductCodes,
  VendorProduct,
} from "@/lib/vendorStore";
import {
  formatLeadTimeByType,
  getAvailabilityByType,
  getPricingModel,
  getProductType,
  getQuantityLabel,
  getTenureBilling,
  isHybridType,
  isDigitalOnlyType,
} from "@/lib/productTypeRules";

const STATS = [
  { icon: <Package className="w-5 h-5 text-blue-500" />, label: "Total Products", value: "128", sub: "All Products", bg: "bg-blue-50" },
  { icon: <CheckSquare className="w-5 h-5 text-green-500" />, label: "Active Products", value: "120", sub: "93.75% of total", bg: "bg-green-50" },
  { icon: <AlertTriangle className="w-5 h-5 text-orange-400" />, label: "Out of Stock", value: "5", sub: "3.91% of total", bg: "bg-orange-50" },
  { icon: <Tag className="w-5 h-5 text-cyan-500" />, label: "Price Updates", value: "23", sub: "This Month", bg: "bg-cyan-50" },
  { icon: <Clock className="w-5 h-5 text-blue-400" />, label: "Avg. Lead Time", value: "4 Days", sub: "Across all products", bg: "bg-blue-50" },
  { icon: <Star className="w-5 h-5 text-red-400" />, label: "Preferred Products", value: "84", sub: "65.63% of total", bg: "bg-red-50" },
];

type PriceChange = "up" | "down" | "neutral";
type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

interface Product {
  image: string;
  vendorSku: string;
  name: string;
  spec: string;
  masterSku: string;
  category: string;
  price: string;
  priceChange: string;
  priceDir: PriceChange;
  moq: number;
  leadTime: string;
  stock: number;
  stockStatus: StockStatus;
  lastUpdated: string;
  status: "Active" | "Inactive";
}

const PRODUCTS: Product[] = [
  { image: "💻", vendorSku: "DELL-LAT-5440", name: "Dell Latitude 5440 Laptop", spec: "Intel i5, 16GB RAM, 512GB SSD, 14\" FHD", masterSku: "LT-1001", category: "Laptops", price: "₹52,000.00", priceChange: "2.80%", priceDir: "down", moq: 5, leadTime: "3 Days", stock: 120, stockStatus: "In Stock", lastUpdated: "May 16, 2026", status: "Active" },
  { image: "🖥️", vendorSku: "DELL-MON-24", name: "Dell 24 Monitor - P2422H", spec: '24", FHD, IPS, 60Hz, HDMI, DP', masterSku: "MN-1005", category: "Monitors", price: "₹9,500.00", priceChange: "5.56%", priceDir: "up", moq: 10, leadTime: "2 Days", stock: 75, stockStatus: "In Stock", lastUpdated: "May 15, 2026", status: "Active" },
  { image: "⌨️", vendorSku: "DELL-KB-01", name: "Dell Wired Keyboard", spec: "USB, Black", masterSku: "KB-2001", category: "Accessories", price: "₹650.00", priceChange: "0.00%", priceDir: "neutral", moq: 20, leadTime: "1 Day", stock: 250, stockStatus: "In Stock", lastUpdated: "May 16, 2026", status: "Active" },
  { image: "🖱️", vendorSku: "DELL-MSE-01", name: "Dell MS116 Mouse", spec: "Wired Optical Mouse, Black", masterSku: "MS-2001", category: "Accessories", price: "₹450.00", priceChange: "0.00%", priceDir: "neutral", moq: 20, leadTime: "1 Day", stock: 150, stockStatus: "In Stock", lastUpdated: "May 14, 2026", status: "Active" },
  { image: "🔌", vendorSku: "DELL-DOCK-WD19", name: "Dell WD19 Docking Station", spec: "USB-C, 180W, Dual Display", masterSku: "DOCK-1002", category: "Accessories", price: "₹18,750.00", priceChange: "1.32%", priceDir: "down", moq: 5, leadTime: "3 Days", stock: 45, stockStatus: "In Stock", lastUpdated: "May 13, 2026", status: "Active" },
  { image: "🔋", vendorSku: "DELL-PWR-65W", name: "Dell 65W Power Adapter", spec: "Original Adapter", masterSku: "ADP-1003", category: "Accessories", price: "₹1,550.00", priceChange: "3.33%", priceDir: "up", moq: 10, leadTime: "2 Days", stock: 60, stockStatus: "In Stock", lastUpdated: "May 10, 2026", status: "Active" },
  { image: "📡", vendorSku: "DELL-SWITCH-24P", name: "Dell 24 Port Switch", spec: "24 Port Gigabit Switch", masterSku: "NET-2001", category: "Networking", price: "₹22,000.00", priceChange: "0.00%", priceDir: "neutral", moq: 2, leadTime: "4 Days", stock: 25, stockStatus: "Low Stock", lastUpdated: "May 08, 2026", status: "Active" },
  { image: "💻", vendorSku: "DELL-LAT-3540", name: "Dell Latitude 3540 Laptop", spec: 'Intel i3, 8GB RAM, 256GB SSD, 15.6"', masterSku: "LT-1002", category: "Laptops", price: "₹36,000.00", priceChange: "1.37%", priceDir: "down", moq: 5, leadTime: "3 Days", stock: 30, stockStatus: "In Stock", lastUpdated: "May 07, 2026", status: "Active" },
];

function PriceIndicator({ dir, change }: { dir: PriceChange; change: string }) {
  if (dir === "up") return <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium"><ArrowUp className="w-3 h-3" /> {change}</span>;
  if (dir === "down") return <span className="flex items-center gap-0.5 text-green-600 text-xs font-medium"><ArrowDown className="w-3 h-3" /> {change}</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs font-medium"><Minus className="w-3 h-3" /> {change}</span>;
}

function StockBadge({ status, count }: { status: StockStatus; count: number }) {
  const colors: Record<StockStatus, string> = {
    "In Stock": "text-green-700 bg-green-50",
    "Low Stock": "text-orange-600 bg-orange-50",
    "Out of Stock": "text-red-600 bg-red-50",
  };
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="font-semibold text-sm text-gray-800">{count}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[status]}`}>{status}</span>
    </div>
  );
}

function typeBadgeClasses(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("digital")) return "bg-violet-50 text-violet-700";
  if (normalized.includes("subscription") || normalized.includes("saas")) return "bg-blue-50 text-blue-700";
  if (normalized.includes("cloud") || normalized.includes("service")) return "bg-sky-50 text-sky-700";
  if (normalized.includes("hybrid")) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

const MENU_ITEMS = [
  { icon: <Plus className="w-4 h-4" />, label: "Add Product" },
  { icon: <Tag className="w-4 h-4" />, label: "Bulk Price Update" },
  { icon: <Upload className="w-4 h-4" />, label: "Import Products" },
  { icon: <Download className="w-4 h-4" />, label: "Export Catalog" },
  { icon: <RefreshCcw className="w-4 h-4" />, label: "Sync Vendor Feed" },
  { icon: <BookOpen className="w-4 h-4" />, label: "Assign to Master Catalog" },
];

type ToolDialog = "bulkPrice" | "assign" | null;
type BulkPriceMode = "increase" | "decrease";
type VendorProductTab = "physical" | "digital";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);

  if (rows.length < 2) return [];
  const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) =>
    headers.reduce<Record<string, string>>((result, header, index) => {
      if (header) result[header] = values[index] ?? "";
      return result;
    }, {}),
  );
}

function normalizeImportValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key.replace(/[^a-z0-9]/gi, "").toLowerCase()];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function masterSnapshot(product: CatalogProduct) {
  return {
    masterProductCode: product.masterProductCode,
    skuCode: product.skuCode,
    productName: product.productName,
    category: product.category,
    brand: product.brand,
    physicalType: product.physicalType,
    images: product.images,
  };
}

function BulkPriceDialog({
  productCount,
  onCancel,
  onApply,
}: {
  productCount: number;
  onCancel: () => void;
  onApply: (mode: BulkPriceMode, percentage: number) => void;
}) {
  const [mode, setMode] = useState<BulkPriceMode>("increase");
  const [percentage, setPercentage] = useState("5");

  const submit = () => {
    const value = Number(percentage);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      toast.error("Enter a percentage between 0.01 and 100.");
      return;
    }
    onApply(mode, value);
  };

  return (
    <div data-confirmation-skip className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Bulk Price Update</h3>
            <p className="mt-0.5 text-xs text-gray-500">Update prices for {productCount} vendor product{productCount === 1 ? "" : "s"}.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Change</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as BulkPriceMode)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="increase">Increase prices by</option>
              <option value="decrease">Decrease prices by</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Percentage</span>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </label>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
            Prices are rounded to two decimal places. Products without a valid price are left unchanged.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply Update</button>
        </div>
      </div>
    </div>
  );
}

function AssignMasterCatalogDialog({
  products,
  catalog,
  onCancel,
  onAssign,
}: {
  products: VendorProduct[];
  catalog: CatalogProduct[];
  onCancel: () => void;
  onAssign: (assignments: Record<string, string>) => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const hasProducts = products.length > 0;

  const submit = () => {
    const missing = products.some((product) => !assignments[product.id]);
    if (missing) {
      toast.error("Choose a master catalog product for every unmatched item.");
      return;
    }
    onAssign(assignments);
  };

  return (
    <div data-confirmation-skip className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Assign to Master Catalog</h3>
            <p className="mt-0.5 text-xs text-gray-500">Repair vendor products that no longer match a master catalog item.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        {hasProducts ? (
          <>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-5">
              {products.map((product) => (
                <div key={product.id} className="grid grid-cols-1 items-center gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{product.productName}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-gray-400">{product.masterProductCode || "No master code"} · {product.id}</p>
                  </div>
                  <select
                    value={assignments[product.id] || ""}
                    onChange={(event) => setAssignments((current) => ({ ...current, [product.id]: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select master product…</option>
                    {catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.productName} · {item.masterProductCode}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-800">
              Assigning replaces the vendor product’s master-catalog snapshot fields but keeps its vendor price, MOQ, lead time, stock, and vendor product code.
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Assign Products</button>
            </div>
          </>
        ) : (
          <div className="px-5 py-10 text-center">
            <Check className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-3 text-sm font-medium text-gray-800">All vendor products are assigned</p>
            <p className="mt-1 text-xs text-gray-500">Every product on this vendor already matches an item in the master catalog.</p>
            <button type="button" onClick={onCancel} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Product Screen ────────────────────────────────────────────────────────

function EditProductScreen({
  product,
  onClose,
  onSave,
}: {
  product: VendorProduct;
  onClose: () => void;
  onSave: (updates: Pick<VendorProduct, "price" | "moq" | "leadTime" | "stock" | "incomingStock">) => void;
}) {
  const [price, setPrice] = useState(product.price || "0");
  const [moq, setMoq] = useState(product.moq || "");
  const [leadTime, setLeadTime] = useState(product.leadTime || "");
  const [stock, setStock] = useState(product.stock || "");
  const [incomingStock, setIncomingStock] = useState(product.incomingStock || "0");

  const productType = getProductType(product.physicalType);
  const isDigitalProduct = isDigitalOnlyType(productType);
  const tenureBilling = getTenureBilling(productType);
  const reservedStock = parseInt(product.reservedStock || "0") || 0;
  const currentStockNum = parseInt(stock) || 0;
  const availableStock = Math.max(0, currentStockNum - reservedStock);

  const initials = product.productName.slice(0, 2).toUpperCase();

  const handleSave = () => {
    onSave({
      price: price.trim(),
      moq: moq.trim(),
      leadTime: leadTime.trim(),
      stock: isDigitalProduct ? product.stock || "0" : stock.trim(),
      incomingStock: isDigitalProduct ? product.incomingStock || "0" : incomingStock.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Edit Product</h2>
            <p className="text-xs text-gray-400 truncate">{product.productName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xlpx-2 py-2 flex gap-8">

          {/* Left: Product card (read-only) */}
          <div className="w-64 shrink-0">
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="w-full aspect-square bg-gray-50 flex items-center justify-center">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.productName} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 text-2xl font-bold border border-blue-200">
                    {initials}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 space-y-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{product.productName}</h3>
                <p className="text-xs text-gray-500">{product.category}</p>
                <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                   <div className="flex justify-between gap-3">
                     <span className="text-gray-400">Product Type</span>
                     <span className="text-right">{productType}</span>
                   </div>
                   <div className="flex justify-between gap-3">
                     <span className="text-gray-400">Pricing Model</span>
                     <span className="text-right">{getPricingModel(productType)}</span>
                   </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">MPI Code</span>
                    <span className="font-mono">{product.masterProductCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">SKU</span>
                    <span className="font-mono">{product.skuCode || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Brand</span>
                    <span>{product.brand || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium ${product.status === "Active" ? "text-green-600" : "text-gray-400"}`}>{product.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Editable fields */}
          <div className="flex-1 min-w-0">
            <div className="border border-gray-200 rounded-2xl p-6">
               <h3 className="text-base font-semibold text-gray-900 mb-1">
                 {isDigitalProduct ? "Digital Commercial Terms" : "Pricing & Inventory"}
               </h3>
                <p className="text-sm text-gray-400 mb-6">
                  {isDigitalProduct
                     ? "Update users/licenses, tenure/billing, and provisioning time for this product."
                     : "Update the vendor price, units/MOQ, lead time, and current stock for this product."}
                </p>

              <div className="grid grid-cols-2 gap-6">
                {/* Purchase Price */}
                {!isDigitalProduct && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Price / Unit
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Vendor purchase price (excl. GST)</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <IndianRupee className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      aria-label="Vendor purchase price per unit"
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                )}

                {/* MOQ */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {isDigitalProduct ? "Users / Licenses" : "Units / MOQ"}
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    {isDigitalProduct ? "Number of users or licenses included" : `Minimum ${getQuantityLabel(productType).toLowerCase()} per order`}
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Layers className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900"
                    />
                  </div>
                </div>

                {/* Lead Time */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {isDigitalProduct ? "Provisioning Time (hours)" : "Lead Time (days)"}
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    {isDigitalProduct ? "Time from order to service provisioning" : "Days from order to delivery"}
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Timer className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900"
                    />
                  </div>
                </div>

                {isDigitalProduct ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tenure / Billing</label>
                    <p className="text-xs text-gray-400 mb-2">Commercial terms derived from the digital product type</p>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                      <p className="text-sm font-semibold text-gray-900">{tenureBilling.tenure}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tenureBilling.billing}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Stock</label>
                    <p className="text-xs text-gray-400 mb-2">Total units physically held by vendor</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Warehouse className="w-4 h-4" />
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                )}

                {!isDigitalProduct && (
                  <>
                {/* Reserved Stock — read-only */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Reserved Stock
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Units reserved by client orders (not yet PO'd) — auto-managed</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Layers className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      readOnly
                      value={reservedStock}
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Available Stock — computed, read-only */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Available Stock
                    <span className="ml-2 text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Computed</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">= Current − Reserved · shown in client shop</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Warehouse className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      readOnly
                      value={availableStock}
                      className={`w-full pl-9 pr-4 py-2.5 text-sm border rounded-xl bg-gray-50 cursor-not-allowed font-semibold ${availableStock > 0 ? "border-green-200 text-green-700" : "border-orange-200 text-orange-600"}`}
                    />
                  </div>
                </div>

                {/* Incoming Stock */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Incoming Stock
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Units on order / in transit (informational)</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Timer className="w-4 h-4" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={incomingStock}
                      onChange={(e) => setIncomingStock(e.target.value)}
                      placeholder="e.g. 200"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900"
                    />
                  </div>
                </div>
                  </>
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
          onClick={handleSave}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Confirm Remove Dialog ──────────────────────────────────────────────────────

function ConfirmRemoveDialog({
  product,
  onCancel,
  onConfirm,
}: {
  product: VendorProduct;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div data-confirmation-skip className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Remove Product</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl mb-4">
            {product.images && product.images.length > 0 ? (
              <img src={product.images[0]} alt={product.productName} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
            ) : (
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs font-bold border border-blue-200 shrink-0">
                {product.productName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{product.productName}</p>
              <p className="text-xs text-gray-400 font-mono">{product.masterProductCode}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Are you sure you want to remove this product from the vendor list? This action cannot be undone.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Remove Product
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VendorProductsPage() {
  const { id: vendorId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [editProduct, setEditProduct] = useState<VendorProduct | null>(null);
  const [removeProduct, setRemoveProduct] = useState<VendorProduct | null>(null);
  const [toolDialog, setToolDialog] = useState<ToolDialog>(null);
  const [productTab, setProductTab] = useState<VendorProductTab>("physical");
  const [importing, setImporting] = useState(false);
  const perPage = 10;
  const menuRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load vendor products from store
  useEffect(() => {
    if (vendorId) setVendorProducts(getVendorProducts(vendorId));
  }, [vendorId]);

  useEffect(() => {
    const loadCatalog = () => setCatalogProducts(getCatalogProducts());
    loadCatalog();
    window.addEventListener("catalogUpdated", loadCatalog);
    return () => window.removeEventListener("catalogUpdated", loadCatalog);
  }, []);

  useEffect(() => {
    const handler = () => { if (vendorId) setVendorProducts(getVendorProducts(vendorId)); };
    window.addEventListener("vendorProductsUpdated", handler);
    return () => window.removeEventListener("vendorProductsUpdated", handler);
  }, [vendorId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSaveEdit = (id: string, updates: Pick<VendorProduct, "price" | "moq" | "leadTime" | "stock" | "incomingStock">) => {
    updateVendorProduct(vendorId, id, { ...updates, lastStockUpdate: new Date().toISOString() });
    setVendorProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  };

  const handleConfirmRemove = (id: string) => {
    removeVendorProduct(vendorId, id);
    setVendorProducts((prev) => prev.filter((p) => p.id !== id));
    setRemoveProduct(null);
  };

  const handleBulkPriceUpdate = (mode: BulkPriceMode, percentage: number) => {
    const multiplier = mode === "increase" ? 1 + percentage / 100 : 1 - percentage / 100;
    let updatedCount = 0;
    vendorProducts.forEach((product) => {
      const currentPrice = Number(product.price);
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
      updateVendorProduct(vendorId, product.id, { price: (currentPrice * multiplier).toFixed(2) });
      updatedCount += 1;
    });
    setVendorProducts(getVendorProducts(vendorId));
    setToolDialog(null);
    toast.success(`${updatedCount} vendor price${updatedCount === 1 ? "" : "s"} updated.`);
  };

  const handleExportCatalog = () => {
    const headers = [
      "vendorProductCode",
      "masterProductCode",
      "productName",
      "category",
      "brand",
      "price",
      "moq",
      "leadTime",
      "stock",
      "reservedStock",
      "incomingStock",
      "status",
    ];
    const rows = vendorProducts.map((product) =>
      [
        product.vendorProductCode,
        product.masterProductCode,
        product.productName,
        product.category,
        product.brand,
        product.price,
        product.moq,
        product.leadTime,
        product.stock,
        product.reservedStock,
        product.incomingStock || "0",
        product.status,
      ].map(csvEscape).join(","),
    );
    const blob = new Blob([`\uFEFF${headers.join(",")}\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendor-catalog-${vendorId}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${vendorProducts.length} product${vendorProducts.length === 1 ? "" : "s"} exported.`);
  };

  const handleSyncVendorFeed = () => {
    const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));
    const catalogByCode = new Map(catalogProducts.map((product) => [product.masterProductCode.toLowerCase(), product]));
    let syncedCount = 0;
    let unmatchedCount = 0;

    vendorProducts.forEach((product) => {
      const master = catalogById.get(product.id) || catalogByCode.get((product.masterProductCode || "").toLowerCase());
      if (!master) {
        unmatchedCount += 1;
        return;
      }
      updateVendorProduct(vendorId, product.id, masterSnapshot(master));
      syncedCount += 1;
    });

    setVendorProducts(getVendorProducts(vendorId));
    toast.success(
      `${syncedCount} product${syncedCount === 1 ? "" : "s"} synced from the master catalog${unmatchedCount ? `; ${unmatchedCount} unmatched` : ""}.`,
    );
  };

  const handleImportFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const parsed = file.name.toLowerCase().endsWith(".json")
          ? JSON.parse(raw)
          : parseCsvRows(raw);
        const rows = Array.isArray(parsed) ? parsed : [];
        if (rows.length === 0) throw new Error("The file has no product rows.");

        const catalogById = new Map(catalogProducts.map((product) => [product.id.toLowerCase(), product]));
        const catalogByCode = new Map(catalogProducts.map((product) => [product.masterProductCode.toLowerCase(), product]));
        const catalogBySku = new Map(catalogProducts.map((product) => [product.skuCode.toLowerCase(), product]));
        const catalogByName = new Map(catalogProducts.map((product) => [product.productName.trim().toLowerCase(), product]));
        const existingById = new Map(getVendorProducts(vendorId).map((product) => [product.id, product]));
        const pending: Omit<VendorProduct, "vendorProductCode">[] = [];
        let updatedCount = 0;
        let skippedCount = 0;
        let missingCount = 0;

        for (const rawRow of rows) {
          const row = Object.entries(rawRow as Record<string, unknown>).reduce<Record<string, string>>((result, [key, value]) => {
            result[key.replace(/[^a-z0-9]/gi, "").toLowerCase()] = String(value ?? "").trim();
            return result;
          }, {});
          const identity = normalizeImportValue(row, "masterProductCode", "masterCode", "productCode", "id");
          const sku = normalizeImportValue(row, "skuCode", "sku");
          const name = normalizeImportValue(row, "productName", "name");
          const master = catalogById.get(identity.toLowerCase()) ||
            catalogByCode.get(identity.toLowerCase()) ||
            catalogBySku.get(sku.toLowerCase()) ||
            catalogByName.get(name.toLowerCase());
          if (!master) {
            missingCount += 1;
            continue;
          }

          const existing = existingById.get(master.id);
          const updates: Partial<VendorProduct> = {
            ...masterSnapshot(master),
            price: normalizeImportValue(row, "price", "purchasePrice") || existing?.price || "",
            moq: normalizeImportValue(row, "moq", "minimumOrderQuantity") || existing?.moq || "",
            leadTime: normalizeImportValue(row, "leadTime", "leadTimeDays") || existing?.leadTime || "",
            stock: normalizeImportValue(row, "stock", "currentStock") || existing?.stock || "0",
            physicalStock: normalizeImportValue(row, "physicalStock") || existing?.physicalStock || existing?.stock || "0",
            incomingStock: normalizeImportValue(row, "incomingStock") || existing?.incomingStock || "0",
            status: normalizeImportValue(row, "status") === "Inactive" ? "Inactive" : "Active",
          };

          if (existing) {
            updateVendorProduct(vendorId, master.id, updates);
            updatedCount += 1;
          } else {
            pending.push({
              id: master.id,
              vendorId,
              ...updates,
              reservedStock: "0",
              addedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            } as Omit<VendorProduct, "vendorProductCode">);
          }
        }

        if (pending.length > 0) {
          const codes = reserveVendorProductCodes(pending.length);
          addVendorProducts(vendorId, pending.map((product, index) => ({ ...product, vendorProductCode: codes[index] } as VendorProduct)));
        }

        setVendorProducts(getVendorProducts(vendorId));
        const importedCount = pending.length + updatedCount;
        if (importedCount === 0) {
          toast.error("No rows could be imported. Match each row to a master product code, SKU, ID, or product name.");
        } else {
          toast.success(`${importedCount} product${importedCount === 1 ? "" : "s"} imported${missingCount ? `; ${missingCount} row${missingCount === 1 ? "" : "s"} skipped` : ""}.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read the import file.");
      } finally {
        setImporting(false);
        if (importInputRef.current) importInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setImporting(false);
      toast.error("Could not read the import file.");
    };
    reader.readAsText(file);
  };

  const handleAssignProducts = (assignments: Record<string, string>) => {
    const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));
    const existingIds = new Set(vendorProducts.map((product) => product.id));
    let assignedCount = 0;
    let conflictCount = 0;

    Object.entries(assignments).forEach(([vendorProductId, catalogId]) => {
      const master = catalogById.get(catalogId);
      if (!master) return;
      if (existingIds.has(catalogId) && catalogId !== vendorProductId) {
        conflictCount += 1;
        return;
      }
      updateVendorProduct(vendorId, vendorProductId, { id: catalogId, ...masterSnapshot(master) });
      assignedCount += 1;
    });

    setVendorProducts(getVendorProducts(vendorId));
    setToolDialog(null);
    toast.success(`${assignedCount} product${assignedCount === 1 ? "" : "s"} assigned${conflictCount ? `; ${conflictCount} conflict${conflictCount === 1 ? "" : "s"} skipped` : ""}.`);
  };

  const unmatchedProducts = vendorProducts.filter((product) => {
    const matchesId = catalogProducts.some((catalog) => catalog.id === product.id);
    const matchesCode = catalogProducts.some((catalog) => catalog.masterProductCode.toLowerCase() === (product.masterProductCode || "").toLowerCase());
    return !matchesId && !matchesCode;
  });

  const visibleProducts = vendorProducts.filter((product) => {
    const type = getProductType(product.physicalType);
    return productTab === "digital" ? isDigitalOnlyType(type) : !isDigitalOnlyType(type);
  });
  const isDigitalTab = productTab === "digital";

  const handleMenuAction = (label: string) => {
    setMenuOpen(false);
    if (label === "Add Product") navigate(`/vendors/${vendorId}/add-products`);
    if (label === "Bulk Price Update") setToolDialog("bulkPrice");
    if (label === "Import Products") importInputRef.current?.click();
    if (label === "Export Catalog") handleExportCatalog();
    if (label === "Sync Vendor Feed") handleSyncVendorFeed();
    if (label === "Assign to Master Catalog") setToolDialog("assign");
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {toolDialog === "bulkPrice" && (
        <BulkPriceDialog
          productCount={vendorProducts.length}
          onCancel={() => setToolDialog(null)}
          onApply={handleBulkPriceUpdate}
        />
      )}
      {toolDialog === "assign" && (
        <AssignMasterCatalogDialog
          products={unmatchedProducts}
          catalog={catalogProducts}
          onCancel={() => setToolDialog(null)}
          onAssign={handleAssignProducts}
        />
      )}
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="hidden"
        disabled={importing}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleImportFile(file);
        }}
      />
      {editProduct && (
        <EditProductScreen
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={(updates) => handleSaveEdit(editProduct.id, updates)}
        />
      )}
      {removeProduct && (
        <ConfirmRemoveDialog
          product={removeProduct}
          onCancel={() => setRemoveProduct(null)}
          onConfirm={() => handleConfirmRemove(removeProduct.id)}
        />
      )}
      <div className="w-full px-2 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>{stat.icon}</div>
              <p className="text-xs text-gray-500 font-medium mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Tabs and actions */}
          <div className="px-4 pt-2 flex items-end justify-between border-b border-gray-100">
            <div className="flex items-end gap-5">
              {([
                ["physical", "Physical Products", vendorProducts.filter((product) => !isDigitalOnlyType(getProductType(product.physicalType))).length],
                ["digital", "Digital Products", vendorProducts.filter((product) => isDigitalOnlyType(getProductType(product.physicalType))).length],
              ] as const).map(([tab, label, count]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setProductTab(tab); setCurrentPage(1); }}
                  className={`border-b-2 pb-2 text-xs font-semibold transition-colors ${
                    productTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label} <span className="ml-1 text-[10px] font-medium text-gray-400">({count})</span>
                </button>
              ))}
            </div>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="p-2 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                  {MENU_ITEMS.map((item, i) => (
                    <div key={item.label}>
                      {i === 1 && <div className="my-1 border-t border-gray-100" />}
                      <button
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => handleMenuAction(item.label)}
                      >
                        <span className="text-gray-400">{item.icon}</span>
                        {item.label}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {vendorProducts.length === 0 ? (
            <div className="px-4 py-16 text-center text-gray-400 text-sm">
              No products assigned to this vendor yet.{" "}
              <button
                onClick={() => navigate(`/vendors/${vendorId}/add-products`)}
                className="text-blue-600 hover:underline font-medium"
              >
                Add products from master catalog
              </button>
            </div>
            ) : visibleProducts.length === 0 ? (
              <div className="px-4 py-16 text-center text-gray-400 text-sm">
                No {isDigitalTab ? "digital" : "physical"} products are assigned to this vendor yet.
              </div>
            ) : (
            <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-sm">
               <colgroup>
                 <col style={{ width: "21%" }} />
                 <col style={{ width: "9%" }} />
                 <col style={{ width: "12%" }} />
                 <col style={{ width: "11%" }} />
                  {!isDigitalTab && <col style={{ width: "9%" }} />}
                 <col style={{ width: "8%" }} />
                 <col style={{ width: "10%" }} />
                 <col style={{ width: "8%" }} />
                 <col style={{ width: "12%" }} />
               </colgroup>
              <thead>
                 <tr className="border-b border-gray-200 bg-gray-50">
                   <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">Product</th>
                   <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">Type</th>
                   <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">VPC / MPI</th>
                   <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">Pricing Model</th>
                    {!isDigitalTab && (
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">Price / Unit</th>
                    )}
                    <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">{isDigitalTab ? "Users / Licenses" : "Units / MOQ"}</th>
                    <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">{isDigitalTab ? "Tenure / Billing" : "Stock"}</th>
                    <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">{isDigitalTab ? "Provisioning Time" : "Lead Time"}</th>
                   <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
               <tbody className="divide-y divide-gray-100">
                  {visibleProducts.slice((currentPage - 1) * perPage, currentPage * perPage).map((product) => {
                   const initials = product.productName.slice(0, 2).toUpperCase();
                    const type = getProductType(product.physicalType);
                    const hybrid = isHybridType(type);
                   const current = parseInt(product.stock || "0") || 0;
                   const reserved = parseInt(product.reservedStock || "0") || 0;
                   const available = Math.max(0, current - reserved);
                    const availability = getAvailabilityByType(available, type);
                    const leadTime = formatLeadTimeByType(product.leadTime, type);
                    const tenureBilling = getTenureBilling(type);
                   return (
                     <tr key={product.id} className="hover:bg-gray-50/70 transition-colors group">
                       <td className="px-2 py-4">
                         <div className="flex items-center gap-2">
                           {product.images && product.images.length > 0 ? (
                             <img src={product.images[0]} alt={product.productName} className="w-10 h-10 rounded-md object-cover border border-gray-200 flex-shrink-0" />
                           ) : (
                             <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0 border border-blue-200">{initials}</div>
                           )}
                           <div className="min-w-0">
                             <div className="font-semibold text-gray-800 text-sm leading-snug">{product.productName}</div>
                             <div className="text-xs text-gray-500 mt-1">{product.category || "—"}</div>
                           </div>
                         </div>
                       </td>
                       <td className="px-2 py-4 align-middle">
                         <span className={`inline-flex max-w-[112px] rounded-md px-2 py-2 text-xs font-semibold leading-snug ${typeBadgeClasses(type)}`}>{type}</span>
                       </td>
                        <td className="px-2 py-4 align-middle break-words">
                         <div className="space-y-1">
                            <div className="font-mono text-[10px] text-gray-700 break-all">{product.vendorProductCode || "—"}</div>
                            <div className="font-mono text-[10px] text-gray-500 break-all">{product.masterProductCode || "—"}</div>
                         </div>
                       </td>
                         <td className="px-2 py-4 align-middle break-words text-xs text-gray-700">{getPricingModel(type)}</td>
                        {!isDigitalTab && (
                          <td className="px-2 py-4 align-middle break-words">
                            <div className="font-semibold text-gray-800 text-sm">
                              {product.price ? `₹${parseFloat(product.price).toLocaleString("en-IN")}` : "—"}
                            </div>
                          </td>
                        )}
                         <td className="px-2 py-4 align-middle break-words text-gray-700 text-sm">
                           {product.moq || "—"} <span className="text-xs text-gray-500">{getQuantityLabel(type)}</span>
                       </td>
                         <td className="px-2 py-4 align-middle break-words">
                          {isDigitalTab ? (
                            <div className="space-y-1 text-xs">
                              <div className="font-semibold text-gray-800">{tenureBilling.tenure}</div>
                              <div className="text-gray-500">{tenureBilling.billing}</div>
                            </div>
                          ) : availability.isUnlimited ? (
                           <div className="space-y-1">
                              <div className="font-semibold text-sm text-gray-800">{availability.primary}</div>
                             <div className="text-xs font-medium text-emerald-600">Instant</div>
                           </div>
                         ) : (
                           <div className="space-y-1">
                              <div className="font-semibold text-sm text-gray-800">{availability.primary}</div>
                             <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                                availability.status === "In Stock" ? "bg-emerald-50 text-emerald-700" :
                                availability.status === "Low Stock" ? "bg-amber-50 text-amber-700" :
                               "bg-red-50 text-red-600"
                             }`}>
                                {availability.status}
                             </span>
                           </div>
                         )}
                       </td>
                         <td className="px-2 py-4 align-middle break-words text-gray-700 text-sm">
                         <div className="space-y-1">
                            <div>{leadTime.primary}{!isDigitalTab && hybrid ? " *" : ""}</div>
                           {leadTime.secondary && <div className="text-xs text-gray-500">{leadTime.secondary}</div>}
                         </div>
                       </td>
                         <td className="px-2 py-4 align-middle">
                           <div className="flex flex-wrap items-center gap-1">
                             <button
                               type="button"
                               onClick={() => navigate(`/vendors/${vendorId}/add-products?edit=${encodeURIComponent(product.id)}`)}
                              aria-label={`Edit ${product.productName}`}
                               className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                               <Pencil className="w-3 h-3" /><span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemoveProduct(product)}
                              aria-label={`Remove ${product.productName}`}
                              data-confirmation-skip
                               className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-100 transition-colors"
                            >
                               <Trash2 className="w-3 h-3" /><span className="hidden sm:inline">Remove</span>
                            </button>
                          </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
            </table>
          </div>
          )}

          {/* Pagination */}
          {visibleProducts.length > 0 && (
          <div className="px-4 py-3.5 flex items-center justify-between border-t border-gray-100">
            <span className="text-sm text-gray-500">
               Showing {Math.min((currentPage - 1) * perPage + 1, visibleProducts.length)}–{Math.min(currentPage * perPage, visibleProducts.length)} of {visibleProducts.length} product{visibleProducts.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.ceil(vendorProducts.length / perPage) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${currentPage === p ? "bg-blue-600 text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{p}</button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(vendorProducts.length / perPage), p + 1))}
                disabled={currentPage >= Math.ceil(vendorProducts.length / perPage)}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="ml-2 flex items-center gap-1.5 text-sm text-gray-500">10 / page <ChevronDown className="w-3.5 h-3.5 text-gray-400" /></div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
