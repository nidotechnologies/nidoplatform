import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  Wrench,
  Recycle,
  CalendarDays,
  ShoppingCart,
} from "lucide-react";

const SERVICE_CARDS = [
  {
    title: "AMC",
    subtitle: "Annual Maintenance Contract",
    description: "Comprehensive maintenance coverage to ensure optimal performance and reliability.",
    icon: ShieldCheck,
    href: "/services/amc/new",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    titleColor: "text-blue-600",
    dotColor: "bg-blue-500",
    blobColor: "bg-blue-100",
    btnBorder: "border-blue-300",
    btnText: "text-blue-600",
    btnHover: "hover:bg-blue-50",
    features: ["Preventive Maintenance", "Breakdown Support", "Parts & Labor Coverage", "Priority Support"],
  },
  {
    title: "Repair Service",
    subtitle: "",
    description: "On-demand repair services for quick resolution of equipment issues.",
    icon: Wrench,
    href: "/services/repair/new",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    titleColor: "text-orange-500",
    dotColor: "bg-orange-400",
    blobColor: "bg-orange-100",
    btnBorder: "border-orange-300",
    btnText: "text-orange-500",
    btnHover: "hover:bg-orange-50",
    features: ["Diagnosis & Troubleshooting", "On-site / Off-site Repair", "Genuine Parts Replacement", "Service Report"],
  },
  {
    title: "Recycle / Disposal",
    subtitle: "",
    description: "Environmentally responsible recycling and disposal of electronic equipment.",
    icon: Recycle,
    href: "/services/recycle/new",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-600",
    dotColor: "bg-emerald-500",
    blobColor: "bg-emerald-100",
    btnBorder: "border-emerald-300",
    btnText: "text-emerald-600",
    btnHover: "hover:bg-emerald-50",
    features: ["Secure Data Destruction", "Environment Friendly", "Compliance & Certification", "Pickup & Disposal"],
  },
  {
    title: "Rental Service",
    subtitle: "",
    description: "Flexible rental solutions for short-term and long-term equipment needs.",
    icon: CalendarDays,
    href: "/services/rental/new",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    titleColor: "text-violet-600",
    dotColor: "bg-violet-500",
    blobColor: "bg-violet-100",
    btnBorder: "border-violet-300",
    btnText: "text-violet-600",
    btnHover: "hover:bg-violet-50",
    features: ["Short-term Rentals", "Long-term Leasing", "Flexible Tenure", "Maintenance Included"],
  },
  {
    title: "Regular Purchase",
    subtitle: "",
    description: "Daily essentials and consumables for smooth business operations.",
    icon: ShoppingCart,
    href: "/services/purchase/new",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    titleColor: "text-teal-600",
    dotColor: "bg-teal-500",
    blobColor: "bg-teal-100",
    btnBorder: "border-teal-300",
    btnText: "text-teal-600",
    btnHover: "hover:bg-teal-50",
    features: ["Pantry Items", "Water Cans", "Cleaning Supplies", "Other Daily Essentials"],
  },
];

export default function ServicesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.success("Services page loaded");
  }, []);

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:px-6 md:py-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100 opacity-60 blur-3xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-teal-100 opacity-50 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="max-w-5xl space-y-2">
            <div className="w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-blue-600 text-[11px] font-semibold">
              Services Hub
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-800 md:text-3xl">
              One Place for AMC, Repair Service, Recycle / Disposal, Rental Service and Regular Purchase
            </h1>
            <p className="max-w-4xl text-xs leading-relaxed text-slate-500 md:text-sm">
              Manage all your service requests through a single platform with faster approvals, seamless tracking, and complete lifecycle management.
            </p>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SERVICE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => navigate(card.href)}
              className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
            >
              {/* Top-right accent blob */}
              <div className={`absolute -top-4 -right-4 h-20 w-20 rounded-full ${card.blobColor} opacity-60 blur-2xl pointer-events-none`} />

              {/* Icon */}
              <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBg} mb-4`}>
                <Icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>

              {/* Title */}
              <div className="mb-2">
                <h2 className={`text-base font-bold leading-snug ${card.titleColor}`}>
                  {card.title}
                </h2>
                {card.subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5">({card.subtitle})</p>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {card.description}
              </p>

              {/* Feature list */}
              <ul className="space-y-2 flex-1 mb-5">
                {card.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${card.dotColor}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Create pill button */}
              <button
                className={`w-fit flex items-center gap-1.5 rounded-full border ${card.btnBorder} ${card.btnText} ${card.btnHover} px-4 py-1.5 text-xs font-semibold transition-colors`}
              >
                Create <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
