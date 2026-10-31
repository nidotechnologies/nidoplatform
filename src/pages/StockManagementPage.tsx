import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Package,
  TrendingDown,
  AlertTriangle,
  XCircle,
  BarChart3,
  Search,
  ChevronRight,
  X,
  Plus,
  Minus,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAllVendorProducts, manualStockAdjustment, getAvailableStock } from "@/lib/vendorStore";
import { getCatalogProducts } from "@/lib/catalogStore";
import { getVendors } from "@/lib/vendorDataStore";
import {
  getStockHistory,
  recordStockEvent,
  getAllThresholds,
  saveThresholds,
  type StockHistoryEntry,
  type StockAction,
} from "@/lib/stockHistoryStore";

// ─── Data layer helpers ───────────────────────────────────────────────────────

interface ProductStockRow {
  masterProductCode: string;
  productName: string;
  sku: string;
  totalVendors: number;
  totalPhysical: number;
  totalReserved: number;
  availableStock: number;
  lowThreshold: number;
  outOfStockThreshold: number;
  lastUpdated: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

interface VendorStockDetail {
  vendorId: string;
  vendorName: string;
  price: number;
  moq: number;
  leadTime: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  lastUpdated: string;
}

function buildProductRows(): ProductStockRow[] {
  const storeMap = getAllVendorProducts();
  const catalog = getCatalogProducts();
  const thresholds = getAllThresholds();

  const map: Record<
    string,
    {
      masterProductCode: string;
      productName: string;
      sku: string;
      totalVendors: number;
      totalPhysical: number;
      totalReserved: number;
      lastUpdated: string;
    }
  > = {};

  Object.entries(storeMap).forEach(([, products]) => {
    products
      .filter((p) => p.status === "Active")
      .forEach((p) => {
        const key = p.masterProductCode;
        if (!map[key]) {
          const cat = catalog.find((c) => c.masterProductCode === key);
          map[key] = {
            masterProductCode: key,
            productName: cat?.productName || p.productName,
            sku: cat?.skuCode || p.skuCode || "—",
            totalVendors: 0,
            totalPhysical: 0,
            totalReserved: 0,
            lastUpdated: p.addedAt || "",
          };
        }
        map[key].totalVendors += 1;
        map[key].totalPhysical +=
          parseInt(p.physicalStock ?? p.stock ?? "0") || 0;
        map[key].totalReserved += parseInt(p.reservedStock ?? "0") || 0;
        if (p.addedAt && p.addedAt > map[key].lastUpdated) {
          map[key].lastUpdated = p.addedAt;
        }
      });
  });

  return Object.values(map).map((row) => {
    const available = Math.max(0, row.totalPhysical - row.totalReserved);
    const t = thresholds[row.masterProductCode] ?? { low: 10, outOfStock: 0 };
    const status: ProductStockRow["status"] =
      available <= t.outOfStock
        ? "Out of Stock"
        : available <= t.low
        ? "Low Stock"
        : "In Stock";
    return {
      ...row,
      availableStock: available,
      lowThreshold: t.low,
      outOfStockThreshold: t.outOfStock,
      status,
    };
  });
}

function getVendorDetailsForProduct(masterProductCode: string): VendorStockDetail[] {
  const storeMap = getAllVendorProducts();
  const allVendors = getVendors();
  const result: VendorStockDetail[] = [];

  Object.entries(storeMap).forEach(([vendorId, products]) => {
    const match = products.find(
      (p) => p.masterProductCode === masterProductCode && p.status === "Active"
    );
    if (!match) return;
    const vendor = allVendors.find((v) => v.id === vendorId);
    const physical = parseInt(match.physicalStock ?? match.stock ?? "0") || 0;
    const reserved = parseInt(match.reservedStock ?? "0") || 0;
    result.push({
      vendorId,
      vendorName: vendor?.name || vendorId,
      price: parseFloat(match.price) || 0,
      moq: parseInt(match.moq) || 0,
      leadTime: parseInt(match.leadTime) || 0,
      physicalStock: physical,
      reservedStock: reserved,
      availableStock: Math.max(0, physical - reserved),
      lastUpdated: match.addedAt || "—",
    });
  });

  return result.sort((a, b) => b.physicalStock - a.physicalStock);
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtPrice(n: number): string {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProductStockRow["status"] }) {
  const cfg: Record<ProductStockRow["status"], { bg: string; color: string; border: string }> = {
    "In Stock": { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
    "Low Stock": { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
    "Out of Stock": { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  };
  const c = cfg[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ─── Action badge (history) ───────────────────────────────────────────────────

function ActionBadge({ action }: { action: StockAction }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    "Order Reserved":      { bg: "#eff6ff", color: "#1d4ed8" },
    "Reservation Released":{ bg: "#f0fdf4", color: "#166534" },
    "PO Raised":           { bg: "#faf5ff", color: "#7e22ce" },
    "PO Cancelled":        { bg: "#fff7ed", color: "#c2410c" },
    "Stock In":            { bg: "#f0fdf4", color: "#166534" },
    "Stock Out":           { bg: "#fef2f2", color: "#991b1b" },
    "Stock Correction":    { bg: "#fffbeb", color: "#92400e" },
    "Vendor Stock Updated":{ bg: "#f0f9ff", color: "#0369a1" },
  };
  const c = cfg[action] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </span>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: accent || "#eff6ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─── Vendor Details Panel ─────────────────────────────────────────────────────

function VendorDetailsPanel({
  product,
  onClose,
  onAdjust,
}: {
  product: ProductStockRow;
  onClose: () => void;
  onAdjust: (masterProductCode: string) => void;
}) {
  const vendors = useMemo(
    () => getVendorDetailsForProduct(product.masterProductCode),
    [product.masterProductCode]
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.42)",
        zIndex: 500,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 780,
          maxWidth: "95vw",
          background: "#fff",
          height: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.14)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            background: "#fafafa",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Package size={18} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
                  {product.productName}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {product.masterProductCode} · SKU: {product.sku}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onAdjust(product.masterProductCode)}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Adjust Stock
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "#9ca3af",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Product-level summary bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {[
            { label: "Total Physical Stock", value: product.totalPhysical, color: "#1d4ed8" },
            { label: "Total Reserved", value: product.totalReserved, color: "#92400e" },
            { label: "Total Available", value: product.availableStock, color: "#166534" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                padding: "14px 20px",
                borderRight: i < 2 ? "1px solid #e5e7eb" : "none",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                {item.value.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>Nos</span>
              </div>
            </div>
          ))}
        </div>

        {/* Vendor breakdown */}
        <div style={{ padding: "20px 24px", flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 14 }}>
            Vendor Breakdown
            <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
              {vendors.length} {vendors.length === 1 ? "vendor" : "vendors"} assigned
            </span>
          </div>

          {vendors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
              <Package size={32} style={{ margin: "0 auto 8px" }} />
              <div>No active vendor assignments found</div>
            </div>
          ) : (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 70px 80px 100px 100px 110px 130px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  textAlign: "center",
                }}
              >
                {["Vendor", "Price", "MOQ", "Lead Time", "Physical", "Reserved", "Available", "Last Updated"].map(
                  (h, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 8px",
                        textAlign: i === 0 ? "left" : "center",
                        paddingLeft: i === 0 ? 14 : 8,
                        borderRight: i < 7 ? "1px solid #e5e7eb" : "none",
                      }}
                    >
                      {h}
                    </div>
                  )
                )}
              </div>

              {/* Rows */}
              {vendors.map((v, i) => (
                <div
                  key={v.vendorId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 70px 80px 100px 100px 110px 130px",
                    borderBottom: i < vendors.length - 1 ? "1px solid #f0f0f0" : "none",
                    fontSize: 13,
                    alignItems: "center",
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                  }}
                >
                  <div style={{ padding: "12px 8px 12px 14px", fontWeight: 600, color: "#111827" }}>
                    {v.vendorName}
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>
                    {fmtPrice(v.price)}
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>
                    {v.moq}
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center", color: "#374151" }}>
                    {v.leadTime} days
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <span style={{ fontWeight: 700, color: "#1d4ed8" }}>{v.physicalStock}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>Nos</span>
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <span style={{ fontWeight: 600, color: "#92400e" }}>{v.reservedStock}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>Nos</span>
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: v.availableStock > 0 ? "#f0fdf4" : "#fef2f2",
                        color: v.availableStock > 0 ? "#166534" : "#991b1b",
                        border: `1px solid ${v.availableStock > 0 ? "#bbf7d0" : "#fecaca"}`,
                      }}
                    >
                      {v.availableStock} Nos
                    </span>
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                    {fmtDate(v.lastUpdated)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

const ADJUSTMENT_REASONS = [
  "Physical Count Correction",
  "Vendor Delivery Received",
  "Damaged / Defective",
  "Expired / Obsolete",
  "Miscount Correction",
  "Return to Vendor",
  "Inter-Location Transfer",
  "Other",
];

function AdjustStockModal({
  initialProductCode,
  onClose,
  onDone,
}: {
  initialProductCode?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const allVendors = useMemo(() => getVendors(), []);
  const allRows = useMemo(() => buildProductRows(), []);

  const [productCode, setProductCode] = useState(initialProductCode || "");
  const [vendorId, setVendorId] = useState("");
  const [adjustType, setAdjustType] = useState<"Stock In" | "Stock Out" | "Stock Correction">("Stock In");
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState(ADJUSTMENT_REASONS[0]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  // Vendors carrying the selected product
  const eligibleVendors = useMemo(() => {
    if (!productCode) return [];
    const storeMap = getAllVendorProducts();
    const result: { id: string; name: string; currentStock: number }[] = [];
    Object.entries(storeMap).forEach(([vid, products]) => {
      const match = products.find(
        (p) => p.masterProductCode === productCode && p.status === "Active"
      );
      if (!match) return;
      const vendor = allVendors.find((v) => v.id === vid);
      result.push({
        id: vid,
        name: vendor?.name || vid,
        currentStock: parseInt(match.physicalStock ?? match.stock ?? "0") || 0,
      });
    });
    return result;
  }, [productCode, allVendors]);

  const selectedVendorStock =
    eligibleVendors.find((v) => v.id === vendorId)?.currentStock ?? 0;

  const handleSubmit = () => {
    if (!productCode) return setError("Select a product.");
    if (!vendorId) return setError("Select a vendor.");
    if (qty <= 0) return setError("Quantity must be greater than 0.");
    if (!reason) return setError("Select a reason.");

    const reference = `Manual: ${reason}${remarks ? ` — ${remarks}` : ""}`;
    manualStockAdjustment(vendorId, productCode, adjustType, qty, reference);
    onDone();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.48)",
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: 520,
          maxWidth: "96vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px 14px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
              Manual Stock Adjustment
            </div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
              Stock In · Stock Out · Correction
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 22, padding: 0 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Adjustment type */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
              Adjustment Type
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(["Stock In", "Stock Out", "Stock Correction"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAdjustType(t)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: `2px solid ${adjustType === t ? (t === "Stock In" ? "#2563eb" : t === "Stock Out" ? "#dc2626" : "#d97706") : "#e5e7eb"}`,
                    background: adjustType === t ? (t === "Stock In" ? "#eff6ff" : t === "Stock Out" ? "#fef2f2" : "#fffbeb") : "#fff",
                    color: adjustType === t ? (t === "Stock In" ? "#1d4ed8" : t === "Stock Out" ? "#991b1b" : "#92400e") : "#374151",
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  {t === "Stock In" ? <Plus size={14} /> : t === "Stock Out" ? <Minus size={14} /> : <RefreshCw size={14} />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Product
            </label>
            <select
              value={productCode}
              onChange={(e) => { setProductCode(e.target.value); setVendorId(""); setError(""); }}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "#111827",
                background: "#fff",
                outline: "none",
              }}
            >
              <option value="">— Select product —</option>
              {allRows.map((r) => (
                <option key={r.masterProductCode} value={r.masterProductCode}>
                  {r.productName} ({r.masterProductCode})
                </option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Vendor
            </label>
            <select
              value={vendorId}
              onChange={(e) => { setVendorId(e.target.value); setError(""); }}
              disabled={!productCode}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "#111827",
                background: productCode ? "#fff" : "#f9fafb",
                outline: "none",
              }}
            >
              <option value="">— Select vendor —</option>
              {eligibleVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (Current: {v.currentStock} Nos)
                </option>
              ))}
            </select>
          </div>

          {/* Current stock display */}
          {vendorId && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12.5, color: "#6b7280" }}>Current Physical Stock</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                {selectedVendorStock} Nos
              </span>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              {adjustType === "Stock Correction" ? "Corrected Quantity (set to)" : "Quantity"}
            </label>
            <input
              type="number"
              min={0}
              value={qty || ""}
              onChange={(e) => { setQty(parseInt(e.target.value) || 0); setError(""); }}
              placeholder="Enter quantity"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "#111827",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {vendorId && qty > 0 && adjustType !== "Stock Correction" && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>
                After adjustment:{" "}
                <strong style={{ color: "#111827" }}>
                  {adjustType === "Stock In"
                    ? selectedVendorStock + qty
                    : Math.max(0, selectedVendorStock - qty)}{" "}
                  Nos
                </strong>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "#111827",
                background: "#fff",
                outline: "none",
              }}
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Remarks <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Additional notes…"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                color: "#111827",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12.5, color: "#dc2626", fontWeight: 500 }}>⚠ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "#fafafa",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "#374151",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: adjustType === "Stock In" ? "#2563eb" : adjustType === "Stock Out" ? "#dc2626" : "#d97706",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Confirm {adjustType}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Overview Tab ───────────────────────────────────────────────────────

function StockOverviewTab({
  rows,
  onRowClick,
  onAdjust,
  onThresholdSave,
  refreshKey,
}: {
  rows: ProductStockRow[];
  onRowClick: (row: ProductStockRow) => void;
  onAdjust: (code: string) => void;
  onThresholdSave: () => void;
  refreshKey: number;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ProductStockRow["status"]>("All");
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<{ low: number; outOfStock: number }>({ low: 10, outOfStock: 0 });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.productName.toLowerCase().includes(q) ||
        r.masterProductCode.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const handleThresholdEdit = (code: string, low: number, oos: number) => {
    setEditingThreshold(code);
    setThresholdDraft({ low, outOfStock: oos });
  };

  const handleThresholdSave = (code: string) => {
    saveThresholds(code, thresholdDraft);
    setEditingThreshold(null);
    onThresholdSave();
  };

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: "16px 0 14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name or code…"
            style={{
              width: "100%",
              padding: "9px 10px 9px 32px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "inherit",
              color: "#111827",
              outline: "none",
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
        </div>
        {(["All", "In Stock", "Low Stock", "Out of Stock"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${statusFilter === s ? "#2563eb" : "#d1d5db"}`,
              background: statusFilter === s ? "#eff6ff" : "#fff",
              color: statusFilter === s ? "#1d4ed8" : "#374151",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {s}
          </button>
        ))}
        <div style={{ fontSize: 12.5, color: "#6b7280", marginLeft: "auto" }}>
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 100px 80px 110px 110px 110px 120px 110px 110px 100px 80px",
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
          }}
        >
          {[
            { label: "Product", align: "left" },
            { label: "SKU", align: "center" },
            { label: "Vendors", align: "center" },
            { label: "Physical Stock", align: "center" },
            { label: "Reserved", align: "center" },
            { label: "Available", align: "center" },
            { label: "Low Threshold", align: "center" },
            { label: "OOS Threshold", align: "center" },
            { label: "Last Updated", align: "center" },
            { label: "Status", align: "center" },
            { label: "", align: "center" },
          ].map((h, i) => (
            <div
              key={i}
              style={{
                padding: "10px 8px",
                textAlign: h.align as any,
                paddingLeft: i === 0 ? 16 : 8,
                borderRight: i < 10 ? "1px solid #e5e7eb" : "none",
              }}
            >
              {h.label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af" }}>
            <Package size={32} style={{ margin: "0 auto 10px", display: "block" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              No products found
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Add products to the Vendor Products catalogue to see them here.
            </div>
          </div>
        ) : (
          filtered.map((row, i) => {
            const isEditing = editingThreshold === row.masterProductCode;
            return (
              <div
                key={row.masterProductCode}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 100px 80px 110px 110px 110px 120px 110px 110px 100px 80px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none",
                  alignItems: "center",
                  background: "#fff",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                onClick={() => !isEditing && onRowClick(row)}
              >
                {/* Product */}
                <div style={{ padding: "14px 8px 14px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#111827" }}>
                    {row.productName}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {row.masterProductCode}
                  </div>
                </div>

                {/* SKU */}
                <div style={{ padding: "14px 8px", textAlign: "center", fontSize: 12.5, color: "#374151", borderLeft: "1px solid #f0f0f0" }}>
                  {row.sku}
                </div>

                {/* Vendors */}
                <div style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {row.totalVendors}
                  </span>
                </div>

                {/* Physical */}
                <div style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
                    {row.totalPhysical.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>Nos</span>
                </div>

                {/* Reserved */}
                <div style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: row.totalReserved > 0 ? "#92400e" : "#9ca3af" }}>
                    {row.totalReserved.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 3 }}>Nos</span>
                </div>

                {/* Available */}
                <div style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      background: row.availableStock > row.lowThreshold ? "#f0fdf4" : row.availableStock > row.outOfStockThreshold ? "#fffbeb" : "#fef2f2",
                      color: row.availableStock > row.lowThreshold ? "#166534" : row.availableStock > row.outOfStockThreshold ? "#92400e" : "#991b1b",
                    }}
                  >
                    {row.availableStock.toLocaleString()} Nos
                  </span>
                </div>

                {/* Low Threshold */}
                <div
                  style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      value={thresholdDraft.low}
                      onChange={(e) => setThresholdDraft((d) => ({ ...d, low: parseInt(e.target.value) || 0 }))}
                      style={{
                        width: 64,
                        padding: "4px 6px",
                        border: "1px solid #d97706",
                        borderRadius: 6,
                        fontSize: 12,
                        fontFamily: "inherit",
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <span
                      title="Click to edit"
                      onClick={(e) => { e.stopPropagation(); handleThresholdEdit(row.masterProductCode, row.lowThreshold, row.outOfStockThreshold); }}
                      style={{ fontSize: 12.5, color: "#374151", cursor: "text", borderBottom: "1px dashed #d1d5db" }}
                    >
                      {row.lowThreshold}
                    </span>
                  )}
                </div>

                {/* OOS Threshold */}
                <div
                  style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "center" }}>
                      <input
                        type="number"
                        min={0}
                        value={thresholdDraft.outOfStock}
                        onChange={(e) => setThresholdDraft((d) => ({ ...d, outOfStock: parseInt(e.target.value) || 0 }))}
                        style={{
                          width: 54,
                          padding: "4px 6px",
                          border: "1px solid #d97706",
                          borderRadius: 6,
                          fontSize: 12,
                          fontFamily: "inherit",
                          textAlign: "center",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => handleThresholdSave(row.masterProductCode)}
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: 5,
                          padding: "3px 7px",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: 600,
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingThreshold(null)}
                        style={{
                          background: "#f3f4f6",
                          color: "#6b7280",
                          border: "none",
                          borderRadius: 5,
                          padding: "3px 6px",
                          fontSize: 11,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      title="Click to edit"
                      onClick={(e) => { e.stopPropagation(); handleThresholdEdit(row.masterProductCode, row.lowThreshold, row.outOfStockThreshold); }}
                      style={{ fontSize: 12.5, color: "#374151", cursor: "text", borderBottom: "1px dashed #d1d5db" }}
                    >
                      {row.outOfStockThreshold}
                    </span>
                  )}
                </div>

                {/* Last Updated */}
                <div style={{ padding: "14px 8px", textAlign: "center", fontSize: 12, color: "#6b7280", borderLeft: "1px solid #f0f0f0" }}>
                  {fmtDate(row.lastUpdated)}
                </div>

                {/* Status */}
                <div style={{ padding: "14px 8px", textAlign: "center", borderLeft: "1px solid #f0f0f0" }}>
                  <StatusBadge status={row.status} />
                </div>

                {/* Actions */}
                <div
                  style={{ padding: "14px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderLeft: "1px solid #f0f0f0" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onAdjust(row.masterProductCode)}
                    title="Adjust Stock"
                    style={{
                      background: "#eff6ff",
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 8px",
                      cursor: "pointer",
                      color: "#2563eb",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "inherit",
                    }}
                  >
                    Adjust
                  </button>
                  <button
                    onClick={() => onRowClick(row)}
                    title="View vendor details"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Movement History Tab ─────────────────────────────────────────────────────

const ACTION_OPTIONS: StockAction[] = [
  "Order Reserved",
  "Reservation Released",
  "PO Raised",
  "PO Cancelled",
  "Stock In",
  "Stock Out",
  "Stock Correction",
  "Vendor Stock Updated",
];

function MovementHistoryTab({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [searchProduct, setSearchProduct] = useState("");
  const [actionFilter, setActionFilter] = useState<"All" | StockAction>("All");

  useEffect(() => {
    setHistory(getStockHistory());
  }, [refreshKey]);

  useEffect(() => {
    const handler = () => setHistory(getStockHistory());
    window.addEventListener("stockHistoryUpdated", handler);
    return () => window.removeEventListener("stockHistoryUpdated", handler);
  }, []);

  const filtered = useMemo(() => {
    return history.filter((h) => {
      const q = searchProduct.toLowerCase();
      const matchSearch =
        !q ||
        h.productName.toLowerCase().includes(q) ||
        h.masterProductCode.toLowerCase().includes(q) ||
        h.vendorName.toLowerCase().includes(q);
      const matchAction = actionFilter === "All" || h.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [history, searchProduct, actionFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "16px 0 14px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder="Search product, vendor…"
            style={{
              width: "100%",
              padding: "9px 10px 9px 32px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "inherit",
              color: "#111827",
              outline: "none",
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as any)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: "inherit",
            color: "#374151",
            background: "#fff",
            outline: "none",
          }}
        >
          <option value="All">All Actions</option>
          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginLeft: "auto" }}>
          {filtered.length.toLocaleString()} {filtered.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 140px 110px 90px 90px 90px 160px 130px",
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
          }}
        >
          {["Date & Time", "Product", "Vendor", "Action", "Before", "Changed", "After", "Reference", "User"].map(
            (h, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 8px",
                  textAlign: i <= 2 ? "left" : "center",
                  paddingLeft: i === 0 ? 14 : 8,
                  borderRight: i < 8 ? "1px solid #e5e7eb" : "none",
                }}
              >
                {h}
              </div>
            )
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af" }}>
            <Clock size={32} style={{ margin: "0 auto 10px", display: "block" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              No movement history yet
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Stock events (orders, POs, adjustments) will appear here automatically.
            </div>
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 140px 110px 90px 90px 90px 160px 130px",
                borderBottom: i < filtered.length - 1 ? "1px solid #f0f0f0" : "none",
                alignItems: "center",
                fontSize: 12.5,
                background: i % 2 === 0 ? "#fff" : "#fafafa",
              }}
            >
              <div style={{ padding: "12px 8px 12px 14px", color: "#6b7280", fontSize: 12 }}>
                {fmtDateTime(entry.timestamp)}
              </div>
              <div style={{ padding: "12px 8px" }}>
                <div style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{entry.productName}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{entry.masterProductCode}</div>
              </div>
              <div style={{ padding: "12px 8px", color: "#374151" }}>{entry.vendorName}</div>
              <div style={{ padding: "12px 8px", textAlign: "center" }}>
                <ActionBadge action={entry.action} />
              </div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontWeight: 600, color: "#374151" }}>
                {entry.qtyBefore}
              </div>
              <div style={{ padding: "12px 8px", textAlign: "center" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: entry.qtyChanged > 0 ? "#166534" : entry.qtyChanged < 0 ? "#991b1b" : "#374151",
                  }}
                >
                  {entry.qtyChanged > 0 ? `+${entry.qtyChanged}` : entry.qtyChanged}
                </span>
              </div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#111827" }}>
                {entry.qtyAfter}
              </div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                {entry.reference}
              </div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                {entry.user}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockManagementPage() {
  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");
  const [selectedProduct, setSelectedProduct] = useState<ProductStockRow | null>(null);
  const [adjustModalCode, setAdjustModalCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setRows(buildProductRows());
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("vendorProductsUpdated", handler);
    window.addEventListener("stockThresholdsUpdated", handler);
    return () => {
      window.removeEventListener("vendorProductsUpdated", handler);
      window.removeEventListener("stockThresholdsUpdated", handler);
    };
  }, [reload]);

  // Summary stats
  const totalProducts = rows.length;
  const totalPhysical = rows.reduce((s, r) => s + r.totalPhysical, 0);
  const totalReserved = rows.reduce((s, r) => s + r.totalReserved, 0);
  const totalAvailable = rows.reduce((s, r) => s + r.availableStock, 0);
  const lowStockCount = rows.filter((r) => r.status === "Low Stock").length;
  const outOfStockCount = rows.filter((r) => r.status === "Out of Stock").length;

  // Keep panel in sync after reloads
  useEffect(() => {
    if (selectedProduct) {
      const updated = rows.find((r) => r.masterProductCode === selectedProduct.masterProductCode);
      if (updated) setSelectedProduct(updated);
    }
  }, [rows]);

  const handleOpenAdjust = (code: string) => {
    setAdjustModalCode(code);
    setSelectedProduct(null);
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "24px 28px" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: 0 }}>
            Stock Management
          </h1>
          <p style={{ fontSize: 13.5, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
            Centralized inventory — single source of truth for all stock across the platform.
          </p>
        </div>
        <button
          onClick={() => setAdjustModalCode("")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
          }}
        >
          <RefreshCw size={15} />
          Adjust Stock
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <SummaryCard
          icon={<Package size={20} color="#2563eb" />}
          label="Total Products"
          value={totalProducts}
          sub="active in catalogue"
          accent="#eff6ff"
        />
        <SummaryCard
          icon={<BarChart3 size={20} color="#7c3aed" />}
          label="Total Vendor Stock"
          value={totalPhysical.toLocaleString()}
          sub="physical units"
          accent="#f5f3ff"
        />
        <SummaryCard
          icon={<Clock size={20} color="#d97706" />}
          label="Total Reserved"
          value={totalReserved.toLocaleString()}
          sub="pending orders"
          accent="#fffbeb"
        />
        <SummaryCard
          icon={<TrendingDown size={20} color="#059669" />}
          label="Total Available"
          value={totalAvailable.toLocaleString()}
          sub="physical − reserved"
          accent="#ecfdf5"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} color="#d97706" />}
          label="Low Stock"
          value={lowStockCount}
          sub="products"
          accent="#fffbeb"
        />
        <SummaryCard
          icon={<XCircle size={20} color="#dc2626" />}
          label="Out of Stock"
          value={outOfStockCount}
          sub="products"
          accent="#fef2f2"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 0 }}>
        {(["overview", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 22px",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "#2563eb" : "transparent"}`,
              marginBottom: -2,
              background: "none",
              color: activeTab === tab ? "#2563eb" : "#6b7280",
              fontSize: 13.5,
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 0.15s",
            }}
          >
            {tab === "overview" ? "📦 Stock Overview" : "📋 Movement History"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "0 20px 20px" }}>
        {activeTab === "overview" ? (
          <StockOverviewTab
            rows={rows}
            onRowClick={setSelectedProduct}
            onAdjust={handleOpenAdjust}
            onThresholdSave={reload}
            refreshKey={refreshKey}
          />
        ) : (
          <MovementHistoryTab refreshKey={refreshKey} />
        )}
      </div>

      {/* Vendor details slide-in */}
      {selectedProduct && (
        <VendorDetailsPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdjust={handleOpenAdjust}
        />
      )}

      {/* Adjust modal */}
      {adjustModalCode !== null && (
        <AdjustStockModal
          initialProductCode={adjustModalCode || undefined}
          onClose={() => setAdjustModalCode(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
