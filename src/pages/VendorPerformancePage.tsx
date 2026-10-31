import { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, FileBarChart, Search, Star, Clock, ChevronDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getAllPOs, type StoredPO } from "@/lib/purchaseOrderStore";
import { belongsToVendor } from "@/lib/vendorScope";
import type { StoredVendor } from "@/lib/vendorDataStore";

/* ─── Dropdown periods ──────────────────────────────────────────────────── */
type Period = "Weekly" | "Monthly" | "Quarterly" | "Yearly";
const PERIODS: Period[] = ["Weekly", "Monthly", "Quarterly", "Yearly"];

/* ─── Spend Trend data ──────────────────────────────────────────────────── */
const SPEND_DATA: Record<Period, { label: string; thisYear: number; lastYear: number }[]> = {
  Monthly: [
    { label: "Jan", thisYear: 80, lastYear: 60 }, { label: "Feb", thisYear: 105, lastYear: 75 },
    { label: "Mar", thisYear: 170, lastYear: 95 }, { label: "Apr", thisYear: 155, lastYear: 115 },
    { label: "May", thisYear: 165, lastYear: 120 }, { label: "Jun", thisYear: 180, lastYear: 130 },
    { label: "Jul", thisYear: 175, lastYear: 140 }, { label: "Aug", thisYear: 195, lastYear: 150 },
    { label: "Sep", thisYear: 185, lastYear: 155 }, { label: "Oct", thisYear: 200, lastYear: 160 },
    { label: "Nov", thisYear: 195, lastYear: 165 }, { label: "Dec", thisYear: 210, lastYear: 170 },
  ],
  Weekly: [
    { label: "W1", thisYear: 42, lastYear: 32 }, { label: "W2", thisYear: 55, lastYear: 40 },
    { label: "W3", thisYear: 48, lastYear: 35 }, { label: "W4", thisYear: 60, lastYear: 45 },
    { label: "W5", thisYear: 52, lastYear: 38 }, { label: "W6", thisYear: 65, lastYear: 50 },
    { label: "W7", thisYear: 58, lastYear: 44 }, { label: "W8", thisYear: 70, lastYear: 52 },
    { label: "W9", thisYear: 63, lastYear: 48 }, { label: "W10", thisYear: 72, lastYear: 56 },
    { label: "W11", thisYear: 68, lastYear: 52 }, { label: "W12", thisYear: 75, lastYear: 60 },
  ],
  Quarterly: [
    { label: "Q1 2025", thisYear: 355, lastYear: 230 },
    { label: "Q2 2025", thisYear: 500, lastYear: 365 },
    { label: "Q3 2025", thisYear: 555, lastYear: 445 },
    { label: "Q4 2025", thisYear: 605, lastYear: 495 },
  ],
  Yearly: [
    { label: "2021", thisYear: 620, lastYear: 480 }, { label: "2022", thisYear: 780, lastYear: 620 },
    { label: "2023", thisYear: 920, lastYear: 780 }, { label: "2024", thisYear: 1100, lastYear: 920 },
    { label: "2025", thisYear: 1380, lastYear: 1100 }, { label: "2026", thisYear: 1245, lastYear: 1380 },
  ],
};

/* ─── Performance Trend data ──────────────────────────────────────────────── */
const PERF_DATA: Record<Period, { label: string; ontime: number; quality: number }[]> = {
  Monthly: [
    { label: "Jan", ontime: 92, quality: 4.5 }, { label: "Feb", ontime: 88, quality: 4.4 },
    { label: "Mar", ontime: 91, quality: 4.6 }, { label: "Apr", ontime: 94, quality: 4.5 },
    { label: "May", ontime: 93, quality: 4.7 }, { label: "Jun", ontime: 95, quality: 4.6 },
    { label: "Jul", ontime: 94, quality: 4.7 }, { label: "Aug", ontime: 96, quality: 4.8 },
    { label: "Sep", ontime: 95, quality: 4.6 }, { label: "Oct", ontime: 93, quality: 4.7 },
    { label: "Nov", ontime: 94, quality: 4.6 }, { label: "Dec", ontime: 92, quality: 4.5 },
  ],
  Weekly: [
    { label: "W1", ontime: 90, quality: 4.4 }, { label: "W2", ontime: 93, quality: 4.5 },
    { label: "W3", ontime: 88, quality: 4.3 }, { label: "W4", ontime: 95, quality: 4.6 },
    { label: "W5", ontime: 92, quality: 4.5 }, { label: "W6", ontime: 96, quality: 4.7 },
    { label: "W7", ontime: 94, quality: 4.6 }, { label: "W8", ontime: 91, quality: 4.4 },
    { label: "W9", ontime: 95, quality: 4.7 }, { label: "W10", ontime: 93, quality: 4.5 },
    { label: "W11", ontime: 97, quality: 4.8 }, { label: "W12", ontime: 94, quality: 4.6 },
  ],
  Quarterly: [
    { label: "Q1", ontime: 90, quality: 4.4 }, { label: "Q2", ontime: 93, quality: 4.6 },
    { label: "Q3", ontime: 95, quality: 4.7 }, { label: "Q4", ontime: 94, quality: 4.6 },
  ],
  Yearly: [
    { label: "2021", ontime: 87, quality: 4.1 }, { label: "2022", ontime: 89, quality: 4.2 },
    { label: "2023", ontime: 91, quality: 4.4 }, { label: "2024", ontime: 93, quality: 4.5 },
    { label: "2025", ontime: 91, quality: 4.4 }, { label: "2026", ontime: 94, quality: 4.6 },
  ],
};

/* ─── Donut chart component ─────────────────────────────────────────────── */
function DonutChart({ segments, centerLabel, centerSub }: {
  segments: { name: string; value: number; color: string; pct: string }[];
  centerLabel: string; centerSub: string;
}) {
  const data = segments.map(s => ({ name: s.name, value: s.value }));
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-28 h-28 flex-shrink-0">
        <PieChart width={112} height={112}>
          <Pie data={data} cx={52} cy={52} innerRadius={32} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
            {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-base font-bold text-gray-800 leading-none">{centerLabel}</span>
          <span className="text-[10px] text-gray-400 leading-tight text-center">{centerSub}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-600 whitespace-nowrap">{s.name}</span>
            <span className="text-xs font-semibold text-gray-700 ml-1">{s.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Period dropdown ───────────────────────────────────────────────────── */
function PeriodSelect({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value as Period)}
        className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
        {PERIODS.map(p => <option key={p}>{p}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

/* ─── Custom tooltip ────────────────────────────────────────────────────── */
function SpendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: ₹{p.value}L</p>
      ))}
    </div>
  );
}

function PerfTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name.includes("On-time") ? "%" : "/5"}</p>
      ))}
    </div>
  );
}

/* ─── Progress bar row ──────────────────────────────────────────────────── */
function ResponseRow({ label, pct, color, iconBg }: { label: string; pct: number; color: string; iconBg: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Clock className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <span className="text-sm text-gray-600 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-12 text-right">{pct}%</span>
    </div>
  );
}

/* ─── Category table ────────────────────────────────────────────────────── */
const CATEGORIES = [
  { name: "Laptops",      spend: "₹5.62 Cr", orders: 56, ontime: "95.6%", quality: "4.7 / 5", returns: "0.6%", vsLastYear: "+12.2%", up: true },
  { name: "Monitors",     spend: "₹2.18 Cr", orders: 41, ontime: "93.2%", quality: "4.5 / 5", returns: "0.9%", vsLastYear: "+8.7%",  up: true },
  { name: "Accessories",  spend: "₹1.74 Cr", orders: 32, ontime: "96.9%", quality: "4.8 / 5", returns: "0.7%", vsLastYear: "+15.4%", up: true },
  { name: "Networking",   spend: "₹1.52 Cr", orders: 18, ontime: "92.1%", quality: "4.3 / 5", returns: "1.2%", vsLastYear: "-3.2%",  up: false },
  { name: "Peripherals",  spend: "₹1.39 Cr", orders: 9,  ontime: "91.3%", quality: "4.2 / 5", returns: "1.5%", vsLastYear: "-5.6%",  up: false },
];

function vendorSpendTrend(orders: StoredPO[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const spend = orders
      .filter(order => {
        const created = new Date(order.createdOn);
        return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
      })
      .reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    return {
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      thisYear: Math.round(spend / 100000),
      lastYear: 0,
    };
  });
}

function vendorPerfTrend(orders: StoredPO[], quality: number) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const monthOrders = orders.filter(order => {
      const created = new Date(order.createdOn);
      return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
    });
    const delivered = monthOrders.filter(order => order.status === "Delivered").length;
    return {
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      ontime: monthOrders.length ? Math.round((delivered / monthOrders.length) * 100) : 0,
      quality: quality / 20,
    };
  });
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function VendorPerformancePage({ vendor }: { vendor?: StoredVendor } = {}) {
  const [spendPeriod, setSpendPeriod]   = useState<Period>("Monthly");
  const [perfPeriod,  setPerfPeriod]    = useState<Period>("Monthly");
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setDataVersion(value => value + 1);
    window.addEventListener("poCreated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("poCreated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const vendorOrders = useMemo(
    () => vendor ? getAllPOs().filter(order => belongsToVendor(order, { vendorId: vendor.id, vendorName: vendor.name })) : [],
    [vendor, dataVersion],
  );
  const scoped = Boolean(vendor);
  const qualityScore = vendor?.performanceQuality ?? (vendor?.rating ? vendor.rating * 20 : 0);
  const totalSpend = vendorOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const completedOrders = vendorOrders.filter(order => order.status !== "Draft" && order.status !== "Cancelled");
  const deliveredOrders = completedOrders.filter(order => order.status === "Delivered").length;
  const onTime = completedOrders.length ? Math.round((deliveredOrders / completedOrders.length) * 100) : 0;

  const spendData = scoped
    ? (spendPeriod === "Monthly" ? vendorSpendTrend(vendorOrders) : [])
    : SPEND_DATA[spendPeriod];
  const perfData  = scoped
    ? (perfPeriod === "Monthly" ? vendorPerfTrend(vendorOrders, qualityScore) : [])
    : PERF_DATA[perfPeriod];

  const stats = [
    { icon: <Users className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", label: "Total Spend", value: scoped ? `₹${totalSpend.toLocaleString("en-IN")}` : "₹12.45 Cr", trend: scoped ? "Live purchase-order total" : "+12.6% vs last year", up: true },
    { icon: <FileBarChart className="w-5 h-5 text-teal-500" />, bg: "bg-teal-50", label: "Total Orders", value: scoped ? String(completedOrders.length) : "156", trend: scoped ? "Live purchase-order count" : "+8.3% vs last year", up: true },
    { icon: <Search className="w-5 h-5 text-blue-500" />, bg: "bg-blue-50", label: "On-time Delivery", value: scoped ? `${onTime}%` : "94.2%", trend: scoped ? "Delivered orders" : "+3.5% vs last year", up: true },
    { icon: <Star className="w-5 h-5 text-purple-500" />, bg: "bg-purple-50", label: "Quality Score", value: scoped ? `${(qualityScore / 20).toFixed(1)} / 5` : "4.6 / 5", trend: scoped ? "Vendor score" : "+0.4 vs last year", up: true },
    { icon: <Clock className="w-5 h-5 text-orange-400" />, bg: "bg-orange-50", label: "Avg. Response Time", value: scoped ? "—" : "12.5 Hrs", trend: scoped ? "Not recorded" : "↓2.1 hrs vs last year", up: false },
  ];

  const deliverySegments = [
    { name: "On-time", value: scoped ? deliveredOrders : 147, color: "#22c55e", pct: `${scoped ? deliveredOrders : 147} (${scoped ? onTime : 94.2}%)` },
    { name: "Late", value: scoped ? Math.max(0, completedOrders.length - deliveredOrders) : 7, color: "#f97316", pct: `${scoped ? Math.max(0, completedOrders.length - deliveredOrders) : 7}` },
    { name: "Early", value: scoped ? 0 : 2, color: "#3b82f6", pct: `${scoped ? 0 : 2}` },
  ];

  const qualitySegments = [
    { name: scoped ? "Vendor score" : "Excellent (5)", value: scoped ? (qualityScore ? 1 : 0) : 82, color: "#22c55e", pct: scoped ? `${qualityScore ? 1 : 0}` : "82 (52.6%)" },
    { name: "Good (4)", value: scoped ? 0 : 61, color: "#3b82f6", pct: scoped ? "0" : "61 (39.1%)" },
    { name: "Average (3)", value: scoped ? 0 : 10, color: "#f59e0b", pct: scoped ? "0" : "10 (6.4%)" },
    { name: "Poor (1-2)", value: scoped ? 0 : 3, color: "#ef4444", pct: scoped ? "0" : "3 (1.9%)" },
  ];

  const categoryRows = scoped
    ? [{
        name: vendor?.category || "Uncategorized",
        spend: `₹${totalSpend.toLocaleString("en-IN")}`,
        orders: completedOrders.length,
        ontime: `${onTime}%`,
        quality: `${(qualityScore / 20).toFixed(1)} / 5`,
        returns: "—",
        vsLastYear: "—",
        up: true,
      }]
    : CATEGORIES;

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="max-w-[1280px]px-2 py-2 space-y-4">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-5 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>{s.icon}</div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">{s.label}</p>
              <p className="text-xl font-bold text-gray-900 mb-0.5">{s.value}</p>
              <p className={`text-xs font-medium flex items-center gap-0.5 ${s.up ? "text-green-600" : "text-red-500"}`}>
                {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {s.trend}
              </p>
            </div>
          ))}
        </div>

        {/* ── Two trend charts ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Spend Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Spend Trend</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-5 border-t-2 border-blue-500 inline-block" />This Year (2026)</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-5 border-t-2 border-dashed border-gray-400 inline-block" />Last Year (2025)</span>
                </div>
              </div>
              <PeriodSelect value={spendPeriod} onChange={setSpendPeriod} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={spendData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 100 ? `₹${(v / 100).toFixed(1)}Cr` : `₹${v}L`} />
                <Tooltip content={<SpendTooltip />} />
                <Line type="monotone" dataKey="thisYear" name="This Year" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="lastYear" name="Last Year" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Performance Trend</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-5 border-t-2 border-blue-500 inline-block" />On-time Delivery (%)</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-5 border-t-2 border-green-500 inline-block" />Quality Score (/5)</span>
                </div>
              </div>
              <PeriodSelect value={perfPeriod} onChange={setPerfPeriod} />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={perfData} margin={{ top: 4, right: 30, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<PerfTooltip />} />
                <Line yAxisId="left"  type="monotone" dataKey="ontime"  name="On-time Delivery" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="quality" name="Quality Score"     stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 3 performance panels ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Delivery Performance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Delivery Performance</h3>
              <button className="text-xs text-blue-600 font-medium hover:underline">View Details</button>
            </div>
            <DonutChart segments={deliverySegments} centerLabel={String(scoped ? completedOrders.length : 156)} centerSub="Total Orders" />
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Average Delivery Time</p>
                <p className="text-xl font-bold text-gray-900">{scoped ? "—" : "3.2 Days"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">vs Last Year</p>
                <p className="text-sm font-semibold text-green-600 flex items-center gap-0.5 justify-end">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {scoped ? "—" : "0.6 Days"}
                </p>
              </div>
            </div>
          </div>

          {/* Quality Performance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Quality Performance</h3>
              <button className="text-xs text-blue-600 font-medium hover:underline">View Details</button>
            </div>
            <DonutChart segments={qualitySegments} centerLabel={String(scoped ? completedOrders.length : 156)} centerSub="Total Orders" />
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Average Quality Score</p>
                <p className="text-xl font-bold text-gray-900">{scoped ? `${(qualityScore / 20).toFixed(1)} / 5` : "4.6 / 5"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">vs Last Year</p>
                <p className="text-sm font-semibold text-green-600 flex items-center gap-0.5 justify-end">
                  <ArrowUpRight className="w-3.5 h-3.5" /> {scoped ? "—" : "0.4"}
                </p>
              </div>
            </div>
          </div>

          {/* Response Time Performance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800">Response Time Performance</h3>
              <button className="text-xs text-blue-600 font-medium hover:underline">View Details</button>
            </div>
            {scoped ? (
              <p className="py-6 text-sm text-gray-400">No response-time records for this vendor.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <ResponseRow label="Within 4 Hrs" pct={68.2} color="#22c55e" iconBg="bg-green-50" />
                <ResponseRow label="4 – 24 Hrs" pct={25.6} color="#3b82f6" iconBg="bg-blue-50" />
                <ResponseRow label="24 – 48 Hrs" pct={4.3} color="#f59e0b" iconBg="bg-yellow-50" />
                <ResponseRow label="> 48 Hrs" pct={1.9} color="#ef4444" iconBg="bg-red-50" />
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Average Response Time</p>
                <p className="text-xl font-bold text-gray-900">{scoped ? "—" : "12.5 Hrs"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">vs Last Year</p>
                <p className="text-sm font-semibold text-green-600 flex items-center gap-0.5 justify-end">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {scoped ? "—" : "2.1 Hrs"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Performance by Category</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                {["Category", "Total Spend", "Orders", "On-time Delivery", "Quality Score", "Returns Rate", "vs Last Year"].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categoryRows.map(c => (
                <tr key={c.name} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{c.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.spend}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.orders}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.ontime}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.quality}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.returns}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-semibold flex items-center gap-0.5 ${c.up ? "text-green-600" : "text-red-500"}`}>
                      {c.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {c.vsLastYear}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-2 border-t border-gray-100 text-right">
            <p className="text-xs text-gray-400">Showing 1 to {categoryRows.length} of {categoryRows.length} categories</p>
          </div>
        </div>

      </div>
    </div>
  );
}
