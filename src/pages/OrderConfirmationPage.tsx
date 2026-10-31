import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Copy, Check, MapPin, CreditCard } from "lucide-react";
import FloatingCartButton from "@/components/FloatingCartButton";
import { getSlabDiscountPct } from "@/lib/priceEngineStore";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/formatters";
import { getCartTaxRate, getCartUnitPriceInclusive } from "@/lib/vendorCartPricing";
import { isDigitalOnlyProduct } from "@/lib/productTypeRules";
import ProductConfigurationSummary from "@/components/shared/ProductConfigurationSummary";

// ── Types ─────────────────────────────────────────────────────────────────────

type GstSlab = { rate: number; taxable: number; gst: number };

type ConfirmationState = {
  orderNumber: string;
  orderDate: string;
  items: {
    id: number;
    name: string;
    image: string;
    priceNum: number;
    quantity: number;
    category?: string;
    productType?: string;
    physicalType?: string;
    fulfillmentType?: "physical" | "digital" | "hybrid";
    commercialTerms?: { productType?: string } | null;
    specs?: string[];
    clientId?: string;
    checkoutUnitPriceInclusive?: number;
    selectedVendorId?: string;
    selectedVendorName?: string;
    vendorPrice?: number;
    vendorProductCode?: string;
    gstSnapshot?: number;
    configuration?: Record<string, string>;
    configurationPriceAdjustment?: number;
  }[];
  subtotal: number;
  gst: number;
  gstSlabs?: GstSlab[];
  shipping: number;
  platformFee?: number;
  total: number;
  address: { label: string; line1: string; line2: string; city?: string; state?: string; zip?: string; line3?: string; phone: string } | null;
  paymentMethod: string;
  cardLast4: string;
  paymentTerms: string;
  clientEmail: string;
  clientName: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return formatCurrency(n, undefined, { decimals: 0 });
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrderConfirmationPage() {
  useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [copied, setCopied] = useState(false);
  const isPortalFlow = location.pathname.startsWith("/portal/");
  const ordersPath = isPortalFlow ? "/portal/orders" : "/orders";
  const shopPath = isPortalFlow ? "/portal/catalog" : "/shop";

  const state = location.state as ConfirmationState | null;

  // Fallback if page is accessed directly without state
  const orderNumber = state?.orderNumber ?? orderId ?? "—";
  const items = state?.items ?? [];
  const subtotal = state?.subtotal ?? 0;
  const gst = state?.gst ?? 0;
  const gstSlabs: GstSlab[] = state?.gstSlabs ?? [];
  const shipping = state?.shipping ?? 0;
  const platformFee = state?.platformFee ?? 0;
  const total = state?.total ?? 0;
  const address = state?.address ?? null;
  const clientEmail = state?.clientEmail ?? "—";
  const clientName = state?.clientName ?? "—";
  const paymentMethod = state?.paymentMethod ?? "Credit Card";
  const paymentDetail = (state as any)?.paymentDetail ?? "";
  const paymentTerms = state?.paymentTerms ?? "Net 30 (Payment due in 30 days)";
  const orderDate = state?.orderDate ?? new Date().toISOString().split("T")[0];
  const isDigitalOnlyOrder = items.length > 0 && items.every((item) => isDigitalOnlyProduct(item));

  const handleCopy = () => {
    navigator.clipboard.writeText(orderNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <FloatingCartButton />

      {/* ── Hero banner ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 40%, #c7d2fe 100%)",
          minHeight: 140,
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -left-10 top-0 w-64 h-64 rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute right-20 -top-10 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="absolute left-1/2 bottom-0 w-48 h-48 rounded-full bg-blue-200/30 blur-2xl" />
        </div>

        <div className="relative   px-2 pt-8 pb-8">
          <div className="flex items-center justify-center flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-md shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Thank You For Your Order!</h1>
                <p className="text-sm text-gray-600 mt-0.5">Your order has been successfully placed.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="  px-2 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-2 items-start">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Confirmation card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-2">
              <div className="mb-4">
                <p className="text-base font-semibold text-gray-900">
                  Order ID:{" "}
                  <span className="text-blue-600 font-bold">#{orderNumber}</span>
                </p>
              </div>

              <p className="text-sm text-gray-700 mb-1">Your order has been successfully placed.</p>
              <p className="text-sm text-gray-500 mb-5">
                A confirmation email has been sent to{" "}
                <a href={`mailto:${clientEmail}`} className="text-blue-600 hover:underline font-medium">
                  {clientEmail}
                </a>
              </p>

              <button
                onClick={() => navigate(`${ordersPath}/${orderId}`)}
                className="w-full max-w-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-3 text-sm transition-colors mb-6"
              >
                Track Order
              </button>

              <ul className="space-y-3 text-sm text-gray-600 mb-8">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                  <span>
                    Check{" "}
                    <strong className="text-gray-800">your order status</strong> or{" "}
                    <strong className="text-gray-800">track</strong> your shipping progress.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                  <span>
                    Order updates and shipment details will be sent to{" "}
                    <a href={`mailto:${clientEmail}`} className="text-blue-600 hover:underline">
                      {clientEmail}
                    </a>
                  </span>
                </li>
              </ul>

              <button
                onClick={() => navigate(shopPath)}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to Catalog
              </button>
            </div>

          </div>

          {/* ── Right column: Order Details panel ── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-2 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Order Details</h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                title="Copy order ID"
              >
                {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                <span>{copied ? "Copied!" : `#${orderNumber}`}</span>
              </button>
            </div>

            {/* Order date */}
            <div className="px-2 pt-4 pb-2">
              <p className="text-xs text-gray-400">Order Date: <span className="text-gray-600 font-medium">{formatDate(orderDate)}</span></p>
            </div>

            {/* Line items */}
            <div className="px-2 pb-3 space-y-2">
              {items.length > 0 ? (
                items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm gap-3">
                    <div className="text-gray-700 flex-1 min-w-0">
                      <span className="truncate block">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-400">Qty: {item.quantity}</span>
                      )}
                      <ProductConfigurationSummary
                        configuration={item.configuration}
                        priceAdjustment={item.configurationPriceAdjustment}
                      />
                    </div>
                    <span className="text-gray-800 font-medium shrink-0">
                      {(() => {
                        if (typeof item.checkoutUnitPriceInclusive === "number") {
                          return formatPrice(item.checkoutUnitPriceInclusive * item.quantity);
                        }
                        const discountPct = item.clientId ? getSlabDiscountPct(item.clientId, item.category || "", item.quantity) : 0;
                        const vendorInclusivePrice = getCartUnitPriceInclusive(item, getCartTaxRate(item) ?? 0);
                        const effectivePrice = discountPct > 0 ? vendorInclusivePrice * (1 - discountPct / 100) : vendorInclusivePrice;
                        return formatPrice(effectivePrice * item.quantity);
                      })()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400 italic">No items</div>
              )}
            </div>

            {/* Subtotal / GST / Total */}
            <div className="px-2 py-3 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sub-total (excl. GST)</span>
                <span className="text-gray-700 font-medium">{formatPrice(subtotal)}</span>
              </div>
              {gstSlabs.length > 0 ? (
                gstSlabs.map(sl => (
                  <div key={sl.rate} className="flex justify-between text-sm">
                    <span className="text-gray-500">GST ({sl.rate}%)</span>
                    <span className="text-gray-700 font-medium">{formatPrice(sl.gst)}</span>
                  </div>
                ))
              ) : gst > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GST</span>
                  <span className="text-gray-700 font-medium">{formatPrice(gst)}</span>
                </div>
              ) : null}
              {shipping > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping / delivery</span>
                  <span className="text-gray-700 font-medium">{formatPrice(shipping)}</span>
                </div>
              )}
              {platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Platform fee</span>
                  <span className="text-gray-700 font-medium">{formatPrice(platformFee)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-gray-100 pt-2 mt-1">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-sm font-bold text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Delivery Address */}
            {isDigitalOnlyOrder ? (
              <div className="px-2 py-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Check size={14} className="text-violet-600" />
                  <span className="text-sm font-semibold text-gray-800">Digital Delivery</span>
                </div>
                <p className="pl-5 text-xs text-gray-500">No physical delivery address is required for this digital order.</p>
              </div>
            ) : (
              <div className="px-2 py-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">Delivery Address</span>
                </div>
                {address ? (
                  <div className="text-sm text-gray-600 space-y-0.5 pl-5">
                    <p className="font-medium text-gray-800">{address.label}</p>
                    <p>{address.line1}</p>
                    {address.line2 && <p>{address.line2}</p>}
                    {(address.city || address.state || address.zip) && (
                      <p>{[address.city, address.state, address.zip].filter(Boolean).join(", ")}</p>
                    )}
                    {address.line3 && <p>{address.line3}</p>}
                    <p className="text-gray-400 text-xs mt-1">{address.phone}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pl-5">No address provided</p>
                )}
              </div>
            )}

            {/* Payment */}
            <div className="px-2 py-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">Payment</span>
              </div>
              <div className="pl-5 space-y-1">
                <p className="text-sm text-gray-700">{paymentMethod}</p>
                {paymentDetail && <p className="text-xs text-gray-500">{paymentDetail}</p>}
                <p className="text-xs text-gray-400">{paymentTerms}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
