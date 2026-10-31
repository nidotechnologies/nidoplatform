import { useLocation, useNavigate } from "react-router-dom";
import {
  TrendingUp,
  ShoppingCart,
  Building2,
  Users,
  Package,
  DollarSign,
  HeadphonesIcon,
  Clock,
  CheckSquare,
  Receipt,
  FileSearch,
  Wrench,
  ShieldCheck,
} from "lucide-react";

export type ReportModuleId =
  | "sales"
  | "procurement"
  | "vendors"
  | "clients"
  | "catalog-products"
  | "internal-stakeholders"
  | "external-stakeholders"
  | "risk-compliance"
  | "inventory"
  | "finance"
  | "support"
  | "sla"
  | "approvals"
  | "tax"
  | "audit"
  | "custom";

export const REPORT_MODULES: {
  id: ReportModuleId;
  label: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  ring: string;
  activeText: string;
}[] = [
  {
    id: "sales",
    label: "Sales Reports",
    description: "Quotes, orders, invoices & revenue",
    path: "/reports/sales",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "bg-emerald-50 text-emerald-600",
    ring: "ring-emerald-400",
    activeText: "text-emerald-700",
  },
  {
    id: "procurement",
    label: "Procurement",
    description: "POs, spend & approval cycles",
    path: "/reports/procurement",
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "bg-purple-50 text-purple-600",
    ring: "ring-purple-400",
    activeText: "text-purple-700",
  },
  {
    id: "vendors",
    label: "Vendor Performance",
    description: "Ratings, spend & delivery metrics",
    path: "/reports/vendors",
    icon: <Building2 className="w-5 h-5" />,
    color: "bg-indigo-50 text-indigo-600",
    ring: "ring-indigo-400",
    activeText: "text-indigo-700",
  },
  {
    id: "clients",
    label: "Client Reports",
    description: "Revenue, contracts & activity",
    path: "/reports/clients",
    icon: <Users className="w-5 h-5" />,
    color: "bg-teal-50 text-teal-600",
    ring: "ring-teal-400",
    activeText: "text-teal-700",
  },
  {
    id: "catalog-products",
    label: "Catalog & Product",
    description: "Catalog, SKU, MPC, pricing & inventory",
    path: "/reports/domain/catalog-products",
    icon: <Package className="w-5 h-5" />,
    color: "bg-orange-50 text-orange-600",
    ring: "ring-orange-400",
    activeText: "text-orange-700",
  },
  {
    id: "internal-stakeholders",
    label: "Internal Stakeholders",
    description: "Employees, teams, roles & workload",
    path: "/reports/domain/internal-stakeholders",
    icon: <Users className="w-5 h-5" />,
    color: "bg-blue-50 text-blue-600",
    ring: "ring-blue-400",
    activeText: "text-blue-700",
  },
  {
    id: "external-stakeholders",
    label: "External Stakeholders",
    description: "Clients, vendors, partners & third parties",
    path: "/reports/domain/external-stakeholders",
    icon: <Building2 className="w-5 h-5" />,
    color: "bg-teal-50 text-teal-600",
    ring: "ring-teal-400",
    activeText: "text-teal-700",
  },
  {
    id: "inventory",
    label: "Inventory Reports",
    description: "Stock levels, movements & alerts",
    path: "/reports/inventory",
    icon: <Package className="w-5 h-5" />,
    color: "bg-orange-50 text-orange-600",
    ring: "ring-orange-400",
    activeText: "text-orange-700",
  },
  {
    id: "finance",
    label: "Finance Reports",
    description: "P&L, cash flow & receivables",
    path: "/reports/finance",
    icon: <DollarSign className="w-5 h-5" />,
    color: "bg-green-50 text-green-600",
    ring: "ring-green-400",
    activeText: "text-green-700",
  },
  {
    id: "support",
    label: "Support Reports",
    description: "Tickets, resolution & SLA",
    path: "/reports/support",
    icon: <HeadphonesIcon className="w-5 h-5" />,
    color: "bg-rose-50 text-rose-600",
    ring: "ring-rose-400",
    activeText: "text-rose-700",
  },
  {
    id: "sla",
    label: "SLA Reports",
    description: "Compliance, breaches & trends",
    path: "/reports/sla",
    icon: <Clock className="w-5 h-5" />,
    color: "bg-cyan-50 text-cyan-600",
    ring: "ring-cyan-400",
    activeText: "text-cyan-700",
  },
  {
    id: "risk-compliance",
    label: "Risk & Compliance",
    description: "Compliance, risk & regulatory records",
    path: "/reports/domain/risk-compliance",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "bg-red-50 text-red-600",
    ring: "ring-red-400",
    activeText: "text-red-700",
  },
  {
    id: "approvals",
    label: "Approval Reports",
    description: "Pending, approved & rejected",
    path: "/reports/approvals",
    icon: <CheckSquare className="w-5 h-5" />,
    color: "bg-amber-50 text-amber-600",
    ring: "ring-amber-400",
    activeText: "text-amber-700",
  },
  {
    id: "tax",
    label: "Tax Reports",
    description: "GST, CGST, SGST & ITC summary",
    path: "/reports/tax",
    icon: <Receipt className="w-5 h-5" />,
    color: "bg-pink-50 text-pink-600",
    ring: "ring-pink-400",
    activeText: "text-pink-700",
  },
  {
    id: "audit",
    label: "Audit Reports",
    description: "User activity & system logs",
    path: "/reports/audit",
    icon: <FileSearch className="w-5 h-5" />,
    color: "bg-gray-100 text-gray-600",
    ring: "ring-gray-400",
    activeText: "text-gray-700",
  },
  {
    id: "custom",
    label: "Custom Reports",
    description: "Create, schedule & manage reports",
    path: "/reports",
    icon: <Wrench className="w-5 h-5" />,
    color: "bg-violet-50 text-violet-600",
    ring: "ring-violet-400",
    activeText: "text-violet-700",
  },
];

export default function ReportModuleNav({
  activeModule,
  onSelect,
}: {
  activeModule?: ReportModuleId | string | null;
  onSelect?: (id: ReportModuleId) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">Report modules</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Select a module to view its analytics
          </p>
        </div>
        {!onSelect && (
          <span className="hidden sm:inline-flex text-[11px] text-gray-400">
            Reports &amp; BI
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
        {REPORT_MODULES.map((module) => {
          const isActive = onSelect
            ? activeModule === module.id
            : module.id === "custom"
              ? location.pathname === "/reports"
              : location.pathname.startsWith(module.path);

          return (
            <button
              key={module.id}
              type="button"
              onClick={() =>
                onSelect ? onSelect(module.id) : navigate(module.path)
              }
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left group ${
                isActive
                  ? `border-current ${module.ring.replace("ring-", "border-")} shadow-sm bg-white`
                  : "border-gray-100 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg ${module.color} flex items-center justify-center shrink-0`}
              >
                {module.icon}
              </div>
              <div className="min-w-0 w-full">
                <p
                  className={`text-xs font-semibold leading-tight ${
                    isActive ? module.activeText : "text-gray-800"
                  }`}
                >
                  {module.label}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
                  {module.description}
                </p>
              </div>
              {isActive && (
                <span className={`text-[10px] font-semibold ${module.activeText}`}>
                  ▲ open
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}