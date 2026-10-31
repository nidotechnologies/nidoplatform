import { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LabelList,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, Star, Truck, Award,
  IndianRupee, UserCheck,
} from "lucide-react";
import { getVendors, type StoredVendor } from "@/lib/vendorDataStore";
import { getAllPOs, getPODisplayStatus, type StoredPO } from "@/lib/purchaseOrderStore";
import { getAllVendorProducts } from "@/lib/vendorStore";
import { getLandedCost, getVendorCommonSettings } from "@/lib/priceEngineStore";
import { belongsToVendor } from "@/lib/vendorScope";

// ─── Color Palette ──────────────────────────────────────────────
const C = {
  blue:   "#4B7BE5",
  green:  "#28C76F",
  orange: "#FF9F43",
  red:    "#EA5455",
  purple: "#7367F0",
  cyan:   "#00CFE8",
  gray:   "#ADB5BD",
};

// ─── Helper ─────────────────────────────────────────────────────
function qColor(q: number) {
  if (q >= 4.5) return C.green;
  if (q >= 4.0) return C.blue;
  if (q >= 3.5) return C.orange;
  return C.red;
}

// ─── Shared UI Primitives ────────────────────────────────────────
function SCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-lg border border-border shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SHead({ title, link }: { title: string; link?: string }) {
  return (
    <div className="flex justify-between items-center px-3 py-1.5 border-b border-border">
      <span className="text-[11px] font-semibold text-foreground">{title}</span>
      {link && (
        <span className="text-[10px] text-primary cursor-pointer hover:text-primary/80">
          {link} →
        </span>
      )}
    </div>
  );
}

function dashboardAmount(po: StoredPO): number {
  const amount = Number(po.grandTotal);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Number(po.subtotal || 0) + Number(po.sgstAmt || 0) + Number(po.cgstAmt || 0);
}

function dashboardDate(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  if (Number.isFinite(parsed)) return parsed;
  const parts = value.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day).getTime() || 0;
  }
  return 0;
}

function formatCr(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function clampRatingScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildVendorRatingSummary(vendors: StoredVendor[]) {
  const productsByVendor = getAllVendorProducts();
  const offersByProduct = new Map<string, Map<string, number>>();

  for (const vendor of vendors) {
    const vendorSettings = getVendorCommonSettings(vendor.id);
    const vendorOffers = new Map<string, number>();
    for (const product of productsByVendor[vendor.id] || []) {
      const productCode = String(product.masterProductCode || "").trim();
      const basePrice = Number.parseFloat(String(product.price || "").replace(/,/g, ""));
      if (product.status !== "Active" || !productCode || !Number.isFinite(basePrice) || basePrice <= 0) continue;

      const landedCost = getLandedCost(basePrice, vendorSettings, product.category);
      if (!Number.isFinite(landedCost) || landedCost <= 0) continue;
      const currentCost = vendorOffers.get(productCode);
      if (currentCost === undefined || landedCost < currentCost) vendorOffers.set(productCode, landedCost);
    }

    for (const [productCode, landedCost] of vendorOffers) {
      const offers = offersByProduct.get(productCode) || new Map<string, number>();
      offers.set(vendor.id, landedCost);
      offersByProduct.set(productCode, offers);
    }
  }

  const vendorCostTotals = new Map<string, { total: number; count: number }>();
  for (const offers of offersByProduct.values()) {
    if (offers.size < 2) continue;
    const lowestLandedCost = Math.min(...offers.values());
    for (const [vendorId, landedCost] of offers) {
      const score = clampRatingScore((lowestLandedCost / landedCost) * 100);
      const total = vendorCostTotals.get(vendorId) || { total: 0, count: 0 };
      total.total += score;
      total.count += 1;
      vendorCostTotals.set(vendorId, total);
    }
  }

  const ratings = vendors.map(vendor => {
    const costTotal = vendorCostTotals.get(vendor.id);
    const costScore = costTotal?.count ? costTotal.total / costTotal.count : null;
    const storedRating = Number(vendor.rating || 0);
    const storedQuality = Number(vendor.performanceQuality || 0);
    const qualityScore = storedRating > 0
      ? clampRatingScore(storedRating <= 5 ? storedRating * 20 : storedRating)
      : storedQuality > 0 ? clampRatingScore(storedQuality) : null;
    const storedDelivery = Number(vendor.performanceDelivery || 0);
    const deliveryScore = storedDelivery > 0 ? clampRatingScore(storedDelivery) : null;
    const overallScore = costScore !== null && qualityScore !== null && deliveryScore !== null
      ? (costScore + qualityScore + deliveryScore) / 3
      : null;

    return {
      vendorId: vendor.id,
      name: vendor.name,
      costScore,
      qualityScore,
      deliveryScore,
      overallScore,
    };
  });

  const averageScore = (scores: Array<number | null>) => {
    const recorded = scores.filter((score): score is number => score !== null && Number.isFinite(score));
    return recorded.length ? recorded.reduce((sum, score) => sum + score, 0) / recorded.length : null;
  };

  return {
    ratings,
    averageCostScore: averageScore(ratings.map(row => row.costScore)),
    averageQualityScore: averageScore(ratings.map(row => row.qualityScore)),
    averageDeliveryScore: averageScore(ratings.map(row => row.deliveryScore)),
    averageOverallScore: averageScore(ratings.map(row => row.overallScore)),
    completeVendorCount: ratings.filter(row => row.overallScore !== null).length,
    vendorCount: vendors.length,
  };
}

function buildLiveDashboardData() {
  const vendors = getVendors().filter(vendor => !vendor.archived);
  const purchaseOrders = getAllPOs().filter(po =>
    vendors.some(vendor =>
      belongsToVendor(po, { vendorId: vendor.id, vendorName: vendor.name })
    )
  );
  const vendorRatingSummary = buildVendorRatingSummary(vendors);
  const activePOs = purchaseOrders.filter(po => po.status !== "Draft" && po.status !== "Cancelled");
  const vendorOrders = (vendor: StoredVendor) =>
    purchaseOrders.filter(po => belongsToVendor(po, { vendorId: vendor.id, vendorName: vendor.name }));
  const spendByVendor = vendors.map(vendor => {
    const orders = vendorOrders(vendor).filter(po => po.status !== "Draft" && po.status !== "Cancelled");
    return {
      vendor,
      orders,
      spend: orders.reduce((total, po) => total + dashboardAmount(po), 0),
    };
  });

  const spendByVendorData = spendByVendor
    .filter(row => row.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map(row => ({ name: row.vendor.name, value: row.spend / 10000000 }));

  const ratingByVendorId = new Map(vendorRatingSummary.ratings.map(rating => [rating.vendorId, rating]));
  const vendorRankingData = vendors
    .map(vendor => {
      const rating = ratingByVendorId.get(vendor.id);
      return {
        name: vendor.name,
        costScore: rating?.costScore ?? null,
        qualityScore: rating?.qualityScore ?? null,
        deliveryScore: rating?.deliveryScore ?? null,
        overallScore: rating?.overallScore ?? null,
      };
    })
    .sort((a, b) =>
      (b.overallScore ?? -1) - (a.overallScore ?? -1) ||
      (b.qualityScore ?? -1) - (a.qualityScore ?? -1) ||
      (b.deliveryScore ?? -1) - (a.deliveryScore ?? -1),
    )
    .slice(0, 10);

  const slaVendorData = vendors
    .map(vendor => {
      const orders = vendorOrders(vendor).filter(po => po.status !== "Draft" && po.status !== "Cancelled");
      const delivered = orders.filter(po => po.status === "Delivered").length;
      return {
        vendor: vendor.name,
        category: vendor.category || "—",
        sla: Number(vendor.performanceDelivery || 0),
        tickets: orders.length,
        resolved: delivered,
        status: Number(vendor.performanceDelivery || 0) > 0 ? "Recorded" : "No data",
      };
    })
    .filter(row => row.tickets > 0 || row.sla > 0)
    .sort((a, b) => b.sla - a.sla)
    .slice(0, 7);

  const avgDelivery = vendors.length
    ? vendors.reduce((total, vendor) => total + Number(vendor.performanceDelivery || 0), 0) / vendors.length
    : 0;
  const slaData = [
    { name: "Recorded", value: avgDelivery, color: "#2B2D42" },
    { name: "Remaining", value: Math.max(0, 100 - avgDelivery), color: "#E5E7EB" },
  ];

  const activities = [...purchaseOrders]
    .sort((a, b) => dashboardDate(b.createdOn || b.createdOnDisplay) - dashboardDate(a.createdOn || a.createdOnDisplay))
    .slice(0, 9)
    .map(po => ({
      text: `${po.item || po.items?.[0]?.item || "Purchase order"} · ${po.poNumber}`,
      sub: `${po.vendorName || "Vendor"} · ${getPODisplayStatus(po.status)}`,
      time: po.createdOn
        ? new Date(po.createdOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : po.createdOnDisplay || "Date not recorded",
      color: po.status === "Delivered" ? C.green : po.status === "Cancelled" ? C.red : C.blue,
    }));

  const categorySpend = new Map<string, number>();
  for (const po of activePOs) {
    const items = po.items?.length ? po.items : [{
      category: po.category,
      lineSubtotal: po.subtotal,
    }];
    for (const item of items) {
      const category = String(item.category || "Uncategorised");
      categorySpend.set(category, (categorySpend.get(category) || 0) + Number(item.lineSubtotal || 0));
    }
  }
  const totalCategorySpend = [...categorySpend.values()].reduce((sum, amount) => sum + amount, 0);
  const spendCategoryData = [...categorySpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount], index) => {
      const value = totalCategorySpend ? Math.round((amount / totalCategorySpend) * 100) : 0;
      return {
        name,
        value,
        displayValue: `${value}%`,
        color: [C.blue, C.orange, C.purple, C.green, C.gray][index],
      };
    });

  const statusGroups = [
    { name: "Pending", matches: ["draft"], color: C.orange },
    { name: "Processing", matches: ["confirmed", "accepted", "vendor notified"], color: C.blue },
    { name: "In Transit", matches: ["dispatched", "partially shipped", "shipped", "partially delivered"], color: C.cyan },
    { name: "Delivered", matches: ["delivered", "completed"], color: C.green },
    { name: "Cancelled", matches: ["cancelled", "rejected"], color: C.red },
  ];
  const orderStatusData = statusGroups.map(group => {
    const value = purchaseOrders.filter(po => group.matches.includes(String(po.status || "").toLowerCase())).length;
    return {
      name: group.name,
      value,
      displayValue: String(value),
      color: group.color,
    };
  }).filter(group => group.value > 0);

  const recentOrdersData = [...purchaseOrders]
    .sort((a, b) => dashboardDate(b.createdOn || b.createdOnDisplay) - dashboardDate(a.createdOn || a.createdOnDisplay))
    .slice(0, 5)
    .map(po => {
      const status = getPODisplayStatus(po.status);
      const colors: Record<string, string> = { Delivered: C.green, Completed: C.green, Dispatched: C.blue, "Partially Shipped": C.blue, Processing: C.orange, Pending: C.orange, Cancelled: C.red };
      return {
        vendor: po.vendorName || "—",
        category: po.category || po.items?.[0]?.category || "—",
        amount: formatCr(dashboardAmount(po)),
        date: po.createdOn
          ? new Date(po.createdOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
          : po.createdOnDisplay || "—",
        status,
        sc: colors[status] || C.gray,
      };
    });

  const monthlyTotals = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthPOs = activePOs.filter(po => {
      const created = new Date(dashboardDate(po.createdOn || po.createdOnDisplay));
      return created.getMonth() === month && created.getFullYear() === year;
    });
    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      paid: monthPOs.reduce((sum, po) => sum + dashboardAmount(po), 0) / 10000000,
      pending: purchaseOrders
        .filter(po => {
          if (po.status !== "Draft") return false;
          const created = new Date(dashboardDate(po.createdOn || po.createdOnDisplay));
          return created.getMonth() === month && created.getFullYear() === year;
        })
        .reduce((sum, po) => sum + dashboardAmount(po), 0) / 10000000,
    };
  });

  const issueVendors = vendors.filter(vendor => Number(vendor.complianceIssues || 0) > 0).length;
  const riskData = [
    { level: "No reported issues", count: vendors.length - issueVendors, pct: vendors.length ? Math.round(((vendors.length - issueVendors) / vendors.length) * 100) : 0, color: C.green },
    { level: "Reported issues", count: issueVendors, pct: vendors.length ? Math.round((issueVendors / vendors.length) * 100) : 0, color: C.orange },
  ];

  const deliveryCounts = [
    { name: "Delivered", value: purchaseOrders.filter(po => po.status === "Delivered" || po.status === "Completed").length, color: C.green },
    { name: "In progress", value: purchaseOrders.filter(po => !["Delivered", "Completed", "Cancelled"].includes(po.status) && po.status !== "Draft").length, color: C.blue },
    { name: "Pending", value: purchaseOrders.filter(po => po.status === "Draft").length, color: C.orange },
    { name: "Cancelled", value: purchaseOrders.filter(po => po.status === "Cancelled").length, color: C.red },
  ];
  const qualityCounts = [
    { name: "4.5–5", min: 4.5, max: 5.01, color: C.green },
    { name: "3.5–4.4", min: 3.5, max: 4.5, color: C.blue },
    { name: "2.5–3.4", min: 2.5, max: 3.5, color: C.orange },
    { name: "Below 2.5", min: 0, max: 2.5, color: C.red },
  ].map(group => ({
    name: group.name,
    value: vendors.filter(vendor => {
      const rating = Number(vendor.rating || (vendor.performanceQuality || 0) / 20);
      return rating >= group.min && rating < group.max;
    }).length,
    color: group.color,
  })).filter(group => group.value > 0);

  const categoryPerformance = new Map<string, { spend: number; orders: number; vendors: StoredVendor[] }>();
  for (const vendor of vendors) {
    const category = vendor.category || "Uncategorised";
    const value = categoryPerformance.get(category) || { spend: 0, orders: 0, vendors: [] };
    const orders = vendorOrders(vendor).filter(po => po.status !== "Draft" && po.status !== "Cancelled");
    value.spend += orders.reduce((sum, po) => sum + dashboardAmount(po), 0);
    value.orders += orders.length;
    value.vendors.push(vendor);
    categoryPerformance.set(category, value);
  }
  const performanceCatData = [...categoryPerformance.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .map(([category, data]) => {
      const deliveryScores = data.vendors.map(vendor => Number(vendor.performanceDelivery || 0)).filter(score => score > 0);
      const qualityScores = data.vendors.map(vendor => Number(vendor.rating || (vendor.performanceQuality || 0) / 20)).filter(score => score > 0);
      return {
        category,
        spend: formatCr(data.spend),
        orders: data.orders,
        onTime: deliveryScores.length ? `${(deliveryScores.reduce((sum, score) => sum + score, 0) / deliveryScores.length).toFixed(1)}%` : "—",
        quality: qualityScores.length ? `${(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length).toFixed(1)} / 5` : "—",
        returnRate: "—",
        growth: "—",
        pos: true,
      };
    });

  const productSpend = new Map<string, { spend: number; qty: number }>();
  for (const po of activePOs) {
    const lines = po.items?.length ? po.items : [{
      item: po.item,
      lineSubtotal: po.subtotal,
      qty: po.qty,
    }];
    for (const line of lines) {
      const name = String(line.item || "Unspecified product");
      const value = productSpend.get(name) || { spend: 0, qty: 0 };
      value.spend += Number(line.lineSubtotal || 0);
      value.qty += Number(line.qty || 0);
      productSpend.set(name, value);
    }
  }
  const totalProductSpend = [...productSpend.values()].reduce((sum, value) => sum + value.spend, 0);
  const topProductsData = [...productSpend.entries()]
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, 5)
    .map(([name, value], index) => ({
      rank: index + 1,
      name,
      amount: formatCr(value.spend),
      pct: totalProductSpend ? Number(((value.spend / totalProductSpend) * 100).toFixed(1)) : 0,
    }));

  const recentIssuesData = vendors
    .filter(vendor => Number(vendor.complianceIssues || 0) > 0)
    .sort((a, b) => Number(b.complianceIssues) - Number(a.complianceIssues))
    .slice(0, 5)
    .map(vendor => ({
      issue: `${vendor.name} · ${vendor.complianceIssues} reported compliance issue(s)`,
      date: "Date not recorded",
      status: "Review",
      sc: C.orange,
    }));

  const totalSpend = activePOs.reduce((sum, po) => sum + dashboardAmount(po), 0);
  const deliveredPOs = purchaseOrders.filter(po => po.status === "Delivered" || po.status === "Completed");
  const qualityScores = vendors.map(vendor => Number(vendor.rating || (vendor.performanceQuality || 0) / 20)).filter(score => score > 0);
  const avgQuality = qualityScores.length ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;
  const preferredCount = vendors.filter(vendor => String(vendor.preferredVendor || "").toLowerCase() === "yes").length;
  const totalDelivery = vendors.map(vendor => Number(vendor.performanceDelivery || 0)).filter(score => score > 0);
  const responsivenessScores = vendors
    .map(vendor => ({ vendor: vendor.name, value: Number(vendor.performanceResponsiveness || 0) }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const avgResponsiveness = responsivenessScores.length
    ? responsivenessScores.reduce((sum, row) => sum + row.value, 0) / responsivenessScores.length
    : 0;
  const responsivenessData = responsivenessScores.slice(0, 4).map((row, index) => ({
    label: row.vendor,
    pct: Math.min(100, row.value),
    color: [C.green, C.blue, C.orange, C.purple][index],
  }));
  const now = new Date();
  const currentMonthSpend = activePOs.filter(po => {
    const created = new Date(dashboardDate(po.createdOn || po.createdOnDisplay));
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).reduce((sum, po) => sum + dashboardAmount(po), 0);
  const draftSpend = purchaseOrders
    .filter(po => po.status === "Draft")
    .reduce((sum, po) => sum + dashboardAmount(po), 0);

  return {
    vendors, purchaseOrders, totalSpend, preferredCount, avgQuality, vendorRatingSummary,
    avgDelivery: totalDelivery.length ? totalDelivery.reduce((sum, score) => sum + score, 0) / totalDelivery.length : 0,
    spendByVendorData, vendorRankingData, slaVendorData, slaData, activities, spendCategoryData,
    orderStatusData, recentOrdersData, paymentChartData: monthlyTotals,
    riskData, deliveryPieData: deliveryCounts, qualityPieData: qualityCounts, performanceCatData,
    topProductsData, recentIssuesData, deliveredPOs, responsivenessData, avgResponsiveness,
    currentMonthSpend, draftSpend,
  };
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function VendorDashboard() {
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setDataVersion(version => version + 1);
    const events = [
      "nidoVendorsUpdated",
      "vendorProductsUpdated",
      "priceEngineSettingsUpdated",
      "poCreated",
      "poActivityUpdated",
      "poCancelled",
      "storage",
    ];
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    events.forEach(event => window.addEventListener(event, refresh));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      events.forEach(event => window.removeEventListener(event, refresh));
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
  const live = useMemo(() => buildLiveDashboardData(), [dataVersion]);
  const {
    vendors, purchaseOrders, totalSpend, preferredCount, avgQuality, avgDelivery, vendorRatingSummary,
    spendByVendorData, vendorRankingData, slaVendorData, slaData, activities, spendCategoryData,
    orderStatusData, recentOrdersData, paymentChartData,
    riskData, deliveryPieData, qualityPieData, performanceCatData, topProductsData, recentIssuesData,
    deliveredPOs, responsivenessData, avgResponsiveness, currentMonthSpend, draftSpend,
  } = live;
  const totalOrders = purchaseOrders.length;

  const kpis = [
    { label: "Total Vendors",          value: String(vendors.length), Icon: Users,       color: C.blue,   sub: "Current vendor records" },
    { label: "Active Vendors",         value: String(vendors.filter(v => v.status === "Active").length), Icon: UserCheck, color: C.green, sub: "Current vendor status" },
    { label: "Preferred Vendors",      value: String(preferredCount), Icon: Star,         color: C.orange, sub: "Marked preferred" },
    { label: "Vendor Spend",           value: formatCr(totalSpend), Icon: IndianRupee, color: C.red, sub: `${purchaseOrders.filter(po => po.status !== "Draft" && po.status !== "Cancelled").length} confirmed POs` },
    { label: "Delivery Performance",   value: avgDelivery ? `${avgDelivery.toFixed(1)}%` : "—", Icon: Truck, color: C.cyan, sub: "From vendor records" },
    { label: "Avg Quality Score",      value: avgQuality ? `${avgQuality.toFixed(1)} / 5` : "—", Icon: Award, color: C.purple, sub: `Across ${vendors.length} vendors` },
  ];

  return (
    <div
      className="vendor-dashboard min-h-screen p-2 space-y-1.5 bg-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        .vendor-dashboard .text-\\[7px\\] { font-size: calc(7px + 0.9mm) !important; }
        .vendor-dashboard .text-\\[8px\\] { font-size: calc(8px + 0.9mm) !important; }
        .vendor-dashboard .text-\\[9px\\] { font-size: calc(9px + 0.9mm) !important; }
        .vendor-dashboard .text-\\[10px\\] { font-size: calc(10px + 0.9mm) !important; }
        .vendor-dashboard .text-\\[11px\\] { font-size: calc(11px + 0.9mm) !important; }
        .vendor-dashboard .text-\\[13px\\] { font-size: calc(13px + 0.9mm) !important; }
        .vendor-dashboard .text-xs { font-size: calc(0.75rem + 0.9mm) !important; line-height: calc(1rem + 0.9mm); }
        .vendor-dashboard .text-sm { font-size: calc(0.875rem + 0.9mm) !important; line-height: calc(1.25rem + 0.9mm); }
        .vendor-dashboard .text-2xl { font-size: calc(1.5rem + 0.9mm) !important; line-height: calc(2rem + 0.9mm); }
      `}</style>

      {/* ═══ ROW 1: KPI Cards ═══════════════════════════════════════ */}
      <div className="flex gap-1.5">
        {kpis.map(({ label, value, Icon, color, sub }) => (
          <SCard key={label} className="flex-1 px-3 py-2">
            <div className="flex items-center gap-2">
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: color + "22" }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 truncate leading-tight">{label}</p>
                <p className="text-[13px] font-bold text-gray-800 leading-snug">{value}</p>
                <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>
              </div>
            </div>
          </SCard>
        ))}
      </div>

      {/* ═══ ROW 2: Spend by Vendor + SLA | Ranking | Activities ═══ */}
      <div className="flex gap-1.5">

        {/* Spend by Vendor + SLA Compliance below */}
        <SCard className="flex-[2.2]">
          <SHead title="Spend by Vendor (Top 10)" link="View All" />
          <div className="p-1 pt-1">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={spendByVendorData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 8, fill: "#9CA3AF" }}
                  tickFormatter={(v) => `₹${v}Cr`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#374151" }}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [`₹${v} Cr`, "Spend"]}
                  contentStyle={{ fontSize: 10, padding: "4px 8px", borderRadius: 6 }}
                />
                <Bar dataKey="value" fill={C.blue} radius={[0, 3, 3, 0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vendor delivery score from the live vendor records */}
          <div className="border-t border-gray-100 mt-1">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <p className="text-[10px] font-semibold text-gray-700">Delivery Performance</p>
              <span className="text-[9px] text-blue-500 cursor-pointer hover:underline">View All</span>
            </div>
            <div className="flex gap-3 px-3 pb-3">
              {/* Donut gauge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <PieChart width={84} height={84}>
                    <Pie
                      data={slaData}
                      cx={42} cy={42}
                      innerRadius={28} outerRadius={40}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {slaData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold text-gray-800">{avgDelivery ? `${avgDelivery.toFixed(0)}%` : "—"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#2B2D42" }} />
                    <span className="text-[8px] text-gray-500">Recorded</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                    <span className="text-[8px] text-gray-500">Remaining</span>
                  </div>
                </div>
                <div className="text-center mt-0.5">
                  <p className="text-[9px] font-semibold text-gray-700">Vendor score</p>
                  <p className="text-[8px] text-gray-500">Profile data</p>
                </div>
              </div>

              {/* Vendor-level delivery score and order history */}
              <div className="flex-1 min-w-0">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-[8px] text-gray-500">
                      <th className="text-left py-1 px-1.5 font-medium rounded-l">Vendor</th>
                      <th className="text-left py-1 px-1 font-medium">Category</th>
                      <th className="text-center py-1 px-1 font-medium">Delivery %</th>
                      <th className="text-center py-1 px-1 font-medium">Delivered / POs</th>
                      <th className="text-center py-1 px-1 font-medium rounded-r">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaVendorData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-1 px-1.5 text-[8px] font-medium text-gray-700 max-w-[90px]">
                          <span className="block truncate">{row.vendor}</span>
                        </td>
                        <td className="py-1 px-1 text-[8px] text-gray-500 max-w-[70px]">
                          <span className="block truncate">{row.category}</span>
                        </td>
                        <td className="py-1 px-1 text-center">
                          <span className="text-[8px] font-semibold" style={{ color: row.status === "Recorded" ? C.green : C.gray }}>
                            {row.sla ? `${row.sla}%` : "—"}
                          </span>
                        </td>
                        <td className="py-1 px-1 text-center text-[8px] text-gray-500">
                          {row.resolved}/{row.tickets}
                        </td>
                        <td className="py-1 px-1 text-center">
                          <span
                            className="text-[7px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              color: row.status === "Recorded" ? C.green : C.gray,
                              backgroundColor: (row.status === "Recorded" ? C.green : C.gray) + "18",
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SCard>

        {/* Vendor Performance Ranking — all rows filled */}
        <SCard className="flex-[1.6]">
          <SHead title="Vendor Performance Ranking" link="View All" />
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-500">
                <th className="text-left py-1.5 px-2 font-medium">#</th>
                <th className="text-left py-1.5 px-1 font-medium">Name</th>
                <th className="text-center py-1.5 px-1 font-medium">Cost / 5</th>
                <th className="text-center py-1.5 px-1 font-medium">Quality / 5</th>
                <th className="text-center py-1.5 px-1 font-medium">Delivery / 5</th>
                <th className="text-center py-1.5 px-1 font-medium">Overall / 5</th>
              </tr>
            </thead>
            <tbody>
              {vendorRankingData.map((v, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 px-2 text-[9px] text-gray-400 font-mono">{i + 1}</td>
                  <td className="py-1.5 px-1 text-[9px] font-medium text-gray-700 max-w-[80px]">
                    <span className="block truncate">{v.name}</span>
                  </td>
                  <td className="py-1.5 px-1 text-[9px] text-center text-gray-600">
                    {v.costScore === null ? "—" : `${(v.costScore / 20).toFixed(1)}`}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        color: v.qualityScore === null ? C.gray : qColor(v.qualityScore / 20),
                        backgroundColor: (v.qualityScore === null ? C.gray : qColor(v.qualityScore / 20)) + "20",
                      }}
                    >
                      {v.qualityScore === null ? "—" : (v.qualityScore / 20).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 px-1 text-[9px] text-center text-gray-600">
                    {v.deliveryScore === null ? "—" : (v.deliveryScore / 20).toFixed(1)}
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        color: v.overallScore === null ? C.gray : qColor(v.overallScore / 20),
                        backgroundColor: (v.overallScore === null ? C.gray : qColor(v.overallScore / 20)) + "20",
                      }}
                    >
                      {v.overallScore === null ? "—" : (v.overallScore / 20).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SCard>

        {/* Right column: Recent Activities — stretched full height */}
        <div className="flex flex-col gap-2" style={{ width: 160, minWidth: 160 }}>
          <SCard className="flex-1">
            <SHead title="Recent Activities" />
            <div className="px-2 py-1.5 space-y-2">
              {activities.slice(0, 9).map((a, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: a.color }} />
                  <div className="min-w-0">
                    <p className="text-[8px] font-medium text-gray-700 truncate">{a.text}</p>
                    <p className="text-[8px] text-gray-400 truncate">{a.sub}</p>
                    <p className="text-[8px] text-gray-300">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </SCard>
        </div>
      </div>

      {/* ═══ ROW 3: Spend by Category | Vendor Ratings | Order Status | Recent Vendor Orders ═══ */}
      <div className="flex gap-1.5">

        {/* Spend by Category */}
        <SCard className="flex-[1.15] min-w-[170px]">
          <SHead title="Spend by Category" />
          <div className="p-1">
            {spendCategoryData.length ? (
              <ResponsiveContainer width="100%" height={Math.max(120, spendCategoryData.length * 26 + 20)}>
                <BarChart data={spendCategoryData} layout="vertical" margin={{ top: 4, right: 28, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 8, fill: "#6B7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 8, fill: "#4B5563" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Spend share"]}
                    contentStyle={{ fontSize: 10, borderRadius: 6, borderColor: "#E5E7EB" }}
                  />
                  <Bar dataKey="value" barSize={12} radius={[0, 3, 3, 0]}>
                    {spendCategoryData.map(item => <Cell key={item.name} fill={item.color} />)}
                    <LabelList dataKey="displayValue" position="right" fontSize={8} fill="#4B5563" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-[9px] text-gray-400">
                No category spend recorded
              </div>
            )}
          </div>
        </SCard>

        {/* Vendor ratings */}
        <SCard className="flex-[1.1] min-w-[160px]">
          <SHead title="Vendor Ratings" />
          <div className="p-2">
            <div className="text-center mb-2">
              <span className="text-2xl font-bold text-gray-800">
                {vendorRatingSummary.averageOverallScore === null
                  ? "—"
                  : (vendorRatingSummary.averageOverallScore / 20).toFixed(1)}
              </span>
              <p className="text-[8px] text-gray-500">Overall rating / 5</p>
            </div>
            <div className="space-y-1.5">
              {[
                { name: "Cost", score: vendorRatingSummary.averageCostScore, color: C.blue },
                { name: "Quality", score: vendorRatingSummary.averageQualityScore, color: C.green },
                { name: "Delivery", score: vendorRatingSummary.averageDeliveryScore, color: C.orange },
              ].map(item => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[8px] text-gray-600">{item.name}</span>
                    <span className="text-[8px] font-semibold" style={{ color: item.color }}>
                      {item.score === null ? "—" : `${(item.score / 20).toFixed(1)} / 5`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.score ?? 0}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[8px] text-gray-500 mt-2 text-center">
              Complete ratings: <span className="font-bold text-gray-700">{vendorRatingSummary.completeVendorCount}</span> / {vendorRatingSummary.vendorCount}
            </p>
            <p className="text-[7px] text-gray-400 mt-1 text-center">
              Cost compares landed prices for matching active products. The three dimensions have equal weight.
            </p>
          </div>
        </SCard>

        {/* Order Status */}
        <SCard className="flex-[1.15] min-w-[170px]">
          <SHead title="Order Status" />
          <div className="p-1">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[8px] text-gray-500">Purchase orders</span>
              <span className="text-[8px] font-bold text-gray-700">{totalOrders}</span>
            </div>
            {orderStatusData.length ? (
              <ResponsiveContainer width="100%" height={Math.max(120, orderStatusData.length * 26 + 20)}>
                <BarChart data={orderStatusData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 8, fill: "#6B7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 8, fill: "#4B5563" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} POs`, "Orders"]}
                    contentStyle={{ fontSize: 10, borderRadius: 6, borderColor: "#E5E7EB" }}
                  />
                  <Bar dataKey="value" barSize={12} radius={[0, 3, 3, 0]}>
                    {orderStatusData.map(item => <Cell key={item.name} fill={item.color} />)}
                    <LabelList dataKey="displayValue" position="right" fontSize={8} fill="#4B5563" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-[9px] text-gray-400">
                No purchase orders recorded
              </div>
            )}
          </div>
        </SCard>

        {/* Recent Vendor Orders */}
        <SCard className="flex-[1.2] min-w-[260px]">
          <SHead title="Recent Vendor Orders" link="View All" />
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-500">
                <th className="text-left py-1.5 px-2 font-medium">Vendor</th>
                <th className="text-left py-1.5 px-1 font-medium">Date</th>
                <th className="text-right py-1.5 px-1 font-medium">Amount</th>
                <th className="text-center py-1.5 px-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrdersData.map((r, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 px-2">
                    <p className="text-[9px] font-medium text-gray-700 truncate max-w-[90px]">{r.vendor}</p>
                    <p className="text-[8px] text-gray-400">{r.category}</p>
                  </td>
                  <td className="py-1.5 px-1 text-[9px] text-gray-500">{r.date}</td>
                  <td className="py-1.5 px-1 text-[9px] text-right font-medium text-gray-700">{r.amount}</td>
                  <td className="py-1.5 px-1 text-center">
                    <span
                      className="text-[8px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ color: r.sc, backgroundColor: r.sc + "20" }}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SCard>

      </div>

      {/* ═══ ROW 4: Purchase Order Value | Compliance Issues ═══ */}
      <div className="flex gap-1.5">

        {/* Purchase-order value summary */}
        <SCard className="flex-[1.8]">
          <SHead title="Purchase Order Value" link="View All" />
          <div className="px-3 pt-1.5 flex justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800">{formatCr(draftSpend)}</span>
              <span className="text-[9px] text-gray-500 ml-1">Draft POs</span>
            </div>
            <div>
              <span className="text-xs font-bold text-gray-700">{formatCr(currentMonthSpend)}</span>
              <span className="text-[9px] text-gray-500 ml-1">Confirmed this month</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={72}>
            <BarChart data={paymentChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 8, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, n: string) => [`₹${v.toFixed(2)} Cr`, n === "paid" ? "Confirmed POs" : "Draft POs"]}
                contentStyle={{ fontSize: 9, padding: "2px 6px", borderRadius: 4 }}
              />
              <Bar dataKey="paid"    fill={C.blue}   radius={[2,2,0,0]} barSize={7} />
              <Bar dataKey="pending" fill={C.orange} radius={[2,2,0,0]} barSize={7} />
            </BarChart>
          </ResponsiveContainer>
        </SCard>

        {/* Compliance issues */}
        <SCard className="flex-[1.4]">
          <SHead title="Compliance Issues" link="View All" />
          <div className="p-3 space-y-2">
            {riskData.map((r) => (
              <div key={r.level}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-gray-600">{r.level}</span>
                  <span className="text-[9px] font-medium text-gray-700">{r.count} ({r.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SCard>

      </div>

      {/* ═══ ROW 5: Delivery Performance | Quality Performance | Response Time ═══ */}
      <div className="flex gap-1.5">

        {/* Purchase-order status */}
        <SCard className="flex-1">
          <SHead title="Purchase Order Status" link="View Details" />
          <div className="p-2 flex gap-3 items-center">
            <div className="relative shrink-0">
              <PieChart width={96} height={96}>
                <Pie
                  data={deliveryPieData}
                  cx={48} cy={48}
                  innerRadius={30} outerRadius={45}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {deliveryPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-gray-800">{totalOrders}</span>
                <span className="text-[7px] text-gray-500 leading-tight">Total</span>
                <span className="text-[7px] text-gray-500 leading-tight">POs</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="space-y-1.5">
                {deliveryPieData.map((item) => {
                  const pct = totalOrders ? Math.round((item.value / totalOrders) * 100) : 0;
                  return <div key={item.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[9px] text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-[9px] font-medium text-gray-700">{item.value} ({pct}%)</span>
                  </div>;
                })}
              </div>
              <div className="mt-2 border-t border-gray-100 pt-1.5 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[8px] text-gray-500">Delivered POs</p>
                  <p className="text-xs font-bold text-gray-800">{deliveredPOs.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-gray-500">Total POs</p>
                  <p className="text-xs font-bold text-gray-700">{totalOrders}</p>
                </div>
              </div>
            </div>
          </div>
        </SCard>

        {/* Quality Performance */}
        <SCard className="flex-1">
          <SHead title="Quality Performance" link="View Details" />
          <div className="p-2 flex gap-3 items-center">
            <div className="relative shrink-0">
              <PieChart width={96} height={96}>
                <Pie
                  data={qualityPieData}
                  cx={48} cy={48}
                  innerRadius={30} outerRadius={45}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {qualityPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-gray-800">{qualityPieData.reduce((sum, item) => sum + item.value, 0)}</span>
                <span className="text-[7px] text-gray-500 leading-tight">Rated</span>
                <span className="text-[7px] text-gray-500 leading-tight">Vendors</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="space-y-1.5">
                {qualityPieData.map((item) => {
                  const ratedVendors = qualityPieData.reduce((sum, group) => sum + group.value, 0);
                  const pct = ratedVendors ? Math.round((item.value / ratedVendors) * 100) : 0;
                  return <div key={item.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[9px] text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-[9px] font-medium text-gray-700">{item.value} ({pct}%)</span>
                  </div>;
                })}
              </div>
              <div className="mt-2 border-t border-gray-100 pt-1.5 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[8px] text-gray-500">Avg Quality Score</p>
                  <p className="text-xs font-bold text-gray-800">{avgQuality ? `${avgQuality.toFixed(1)} / 5` : "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-gray-500">Vendors with scores</p>
                  <p className="text-xs font-bold text-gray-700">{qualityPieData.reduce((sum, item) => sum + item.value, 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </SCard>

        {/* Vendor responsiveness score */}
        <SCard className="flex-[1.4]">
          <SHead title="Vendor Responsiveness" link="View Details" />
          <div className="p-3">
            <div className="space-y-2.5">
              {responsivenessData.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-600 w-20 shrink-0 truncate" title={item.label}>{item.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold text-gray-700 w-9 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-gray-100 pt-2 flex justify-between items-end">
              <div>
                <p className="text-[8px] text-gray-500">Average recorded score</p>
                <p className="text-sm font-bold text-gray-800">{avgResponsiveness ? `${avgResponsiveness.toFixed(1)}%` : "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-gray-500">Scores recorded</p>
                <p className="text-xs font-bold text-gray-700">{responsivenessData.length}</p>
              </div>
            </div>
          </div>
        </SCard>
      </div>

      {/* ═══ ROW 6: Performance by Category ═══════════════════════════ */}
      <SCard>
        <SHead title="Performance by Category" />
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-[9px] text-gray-500">
              <th className="text-left py-2 px-3 font-medium">Category</th>
              <th className="text-right py-2 px-3 font-medium">Total Spend</th>
              <th className="text-center py-2 px-3 font-medium">Orders</th>
              <th className="text-center py-2 px-3 font-medium">Delivery Score</th>
              <th className="text-center py-2 px-3 font-medium">Quality</th>
              <th className="text-center py-2 px-3 font-medium">Return Rate</th>
              <th className="text-center py-2 px-3 font-medium">Growth</th>
            </tr>
          </thead>
          <tbody>
            {performanceCatData.map((row, i) => (
              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-3 text-[10px] font-semibold text-gray-700">{row.category}</td>
                <td className="py-2 px-3 text-[10px] text-right text-gray-700">{row.spend}</td>
                <td className="py-2 px-3 text-[10px] text-center text-gray-600">{row.orders}</td>
                <td className="py-2 px-3 text-[10px] text-center text-gray-600">{row.onTime}</td>
                <td className="py-2 px-3 text-[10px] text-center text-gray-600">{row.quality}</td>
                <td className="py-2 px-3 text-[10px] text-center text-gray-600">{row.returnRate}</td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                      row.growth === "—"
                        ? "text-gray-500 bg-gray-100"
                        : row.pos
                          ? "text-green-700 bg-green-100"
                          : "text-red-700 bg-red-100"
                    }`}
                  >
                    {row.growth}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SCard>

      {/* ═══ ROW 7: Top Performing Products | Recent Issues ══════════════ */}
      <div className="flex gap-2 pb-3">

        {/* Top Performing Products */}
        <SCard className="flex-1">
          <SHead title="Top Performing Products" link="View All" />
          <p className="text-[9px] text-gray-500 px-3 pt-1">By Spend</p>
          <table className="w-full mt-0.5">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-500">
                <th className="text-left py-1.5 px-3 font-medium">#</th>
                <th className="text-left py-1.5 px-2 font-medium">Product Name</th>
                <th className="text-right py-1.5 px-3 font-medium">Amount</th>
                <th className="text-right py-1.5 px-3 font-medium">% of Spend</th>
              </tr>
            </thead>
            <tbody>
              {topProductsData.map((p) => (
                <tr key={p.rank} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-[10px] text-gray-500">{p.rank}</td>
                  <td className="py-2 px-2 text-[10px] font-medium text-gray-700">{p.name}</td>
                  <td className="py-2 px-3 text-[10px] text-right text-gray-700">{p.amount}</td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-[9px] font-semibold text-blue-600">{p.pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SCard>

        {/* Recent Issues */}
        <SCard className="flex-1">
          <SHead title="Vendor Compliance Follow-up" link="View All" />
          <table className="w-full mt-0.5">
            <thead>
              <tr className="bg-gray-50 text-[9px] text-gray-500">
                <th className="text-left py-1.5 px-3 font-medium">Issue</th>
                <th className="text-center py-1.5 px-3 font-medium">Date</th>
                <th className="text-center py-1.5 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentIssuesData.map((issue, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 text-[10px] text-gray-700">{issue.issue}</td>
                  <td className="py-2 px-3 text-[10px] text-center text-gray-500">{issue.date}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: issue.sc, backgroundColor: issue.sc + "20" }}
                    >
                      {issue.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SCard>
      </div>

    </div>
  );
}
