  import { useState, useEffect } from "react";
  import { getPrefix } from "@/lib/configService";
  import { Navigate, useLocation, useNavigate } from "react-router-dom";
  import { ChevronRight, ArrowLeft, Pencil, MapPin, CreditCard, Landmark, Wallet, Banknote, Building2, Lock } from "lucide-react";
  import CheckoutStepper from "./CheckoutStepper";
  import OrderSummaryPanel from "./OrderSummaryPanel";
  import { useCart } from "@/contexts/CartContext";
import { calculateCartPricing } from "@/lib/cartPricing";
  import { useMyOrders, type OrderCartItem } from "@/contexts/MyOrdersContext";
import { createApprovalRequest } from "@/lib/approvalEngine";
  import { reserveVendorStock } from "@/lib/vendorStore";
  import { useI18n } from "@/i18n/I18nProvider";
  import { formatCurrency } from "@/lib/formatters";
import {
  DELIVERY_INSTRUCTIONS_KEY,
  ORDER_NOTES_KEY,
  limitCheckoutNote,
} from "@/lib/checkoutNotes";
import { useAuth } from "@/contexts/AuthContext";
import { getOrderRequesterOptions, ORDER_REQUESTER_KEY, normalizeOrderRequester, resolveOrderRequester } from "@/lib/orderRequester";
import { getPortalUsersByClient } from "@/lib/portalUserStore";
import { getClientForPortal, getClients } from "@/lib/clientStore";
import { createDraftPOsForOrder } from "@/lib/orderPurchaseOrderService";
import { isDigitalOnlyProduct } from "@/lib/productTypeRules";
import ProductConfigurationSummary from "@/components/shared/ProductConfigurationSummary";
import { getProductSpecLines } from "@/lib/productConfiguration";

  // ── Address helpers (mirrors CheckoutPage) ─────────────────────────────────────

  interface DeliveryAddress {
    id: number;
    label: string;
    line1: string;
    line2: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    phone: string;
    attention?: string;
    attentionName?: string;
    isDefault: boolean;
  }

  function loadAddresses(clientId: string): DeliveryAddress[] {
    try {
      const raw = localStorage.getItem(`nido_delivery_addresses_${clientId}`);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  function selectedAddressKey(clientId: string) {
    return `nido_selected_delivery_address_${clientId}`;
  }

  function formatPrice(n: number) {
    return formatCurrency(n, undefined, { decimals: 0 });
  }

  export default function ReviewPage() {
    const navigate = useNavigate();
    const location = useLocation();
    useI18n();
    const { items: cart, consumeCart } = useCart();
    const { addOrder } = useMyOrders();
    const { user, isClientPortalUser } = useAuth();
    const isPortalFlow = location.pathname.startsWith("/portal/");
    const catalogPath = isPortalFlow ? "/portal/catalog" : "/shop";
    const cartPath = isPortalFlow ? "/portal/shop/cart" : "/shop/cart";
    const checkoutPath = isPortalFlow ? "/portal/shop/checkout" : "/shop/checkout";
    const paymentPath = isPortalFlow ? "/portal/shop/checkout/payment" : "/shop/checkout/payment";
    const orderConfirmationPath = isPortalFlow ? "/portal/shop/order-confirmation" : "/shop/order-confirmation";

    const clientId = isClientPortalUser
      ? (user?.clientId || cart.find((item) => item.clientId)?.clientId || "")
      : (localStorage.getItem("nido_shop_selected_client") || "");
    const requesterStorageKey = isClientPortalUser && user?.id
      ? `${ORDER_REQUESTER_KEY}:${user.id}`
      : ORDER_REQUESTER_KEY;
    const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
    const [deliveryInstructions, setDeliveryInstructions] = useState("");

    useEffect(() => {
      const loadedAddresses = loadAddresses(clientId);
      setAddresses(loadedAddresses);
      const savedId = Number(localStorage.getItem(selectedAddressKey(clientId)));
      const savedAddress = Number.isFinite(savedId)
        ? loadedAddresses.find((address) => address.id === savedId)
        : undefined;
      const nextAddressId = savedAddress?.id
        ?? loadedAddresses.find((address) => address.isDefault)?.id
        ?? loadedAddresses[0]?.id
        ?? null;
      setSelectedAddressId(nextAddressId);
      setDeliveryInstructions(limitCheckoutNote(localStorage.getItem(DELIVERY_INSTRUCTIONS_KEY) || ""));
    }, [clientId]);

    const requiresDeliveryDetails = cart.some((item) => !isDigitalOnlyProduct(item));
    const selectedAddr = requiresDeliveryDetails
      ? addresses.find((a) => a.id === selectedAddressId) ?? null
      : null;

    // Read saved payment terms (selected on the checkout page)
    const paymentTermsStorageKey = clientId
      ? `nido_payment_terms:${encodeURIComponent(clientId)}`
      : "nido_payment_terms";
    const paymentTermModeStorageKey = clientId
      ? `nido_payment_term_mode:${encodeURIComponent(clientId)}`
      : "nido_payment_term_mode";
    const selectedPaymentTerms = clientId
      ? localStorage.getItem(paymentTermsStorageKey) ?? ""
      : localStorage.getItem(paymentTermsStorageKey) || "Net 30";
    const selectedPaymentTermMode = localStorage.getItem(paymentTermModeStorageKey)
      || localStorage.getItem("nido_payment_term_mode")
      || (selectedPaymentTerms === "Prepaid" ? "prepaid" : "postpaid");
    const paymentTermsLabel = (() => {
      if (selectedPaymentTermMode === "prepaid") {
        return "Prepaid (Payment before order processing)";
      }
      const map: Record<string, string> = {
        "Net 30": "Net 30 (Payment due in 30 days)",
        "Net 45": "Net 45 (Payment due in 45 days)",
        "Net 60": "Net 60 (Payment due in 60 days)",
        "Net 90": "Net 90 (Payment due in 90 days)",
        "Immediate": "Immediate (Payment on delivery)",
        "Advance": "Advance (Payment before dispatch)",
      };
      return map[selectedPaymentTerms] || selectedPaymentTerms;
    })();

    // Read saved payment selection
    const savedPayment: Record<string, string> = (() => {
      try { return JSON.parse(localStorage.getItem("nido_payment_selection") || "{}"); } catch { return {}; }
    })();
    const paymentMethodId: string = savedPayment.paymentMethod || "card";

    const PAYMENT_LABELS: Record<string, string> = {
      card: "Credit / Debit Card",
      netbanking: "Net Banking",
      upi: "UPI",
      wallets: "Wallet",
      neft: "NEFT / RTGS",
      ban: "Company BAN",
    };
    const WALLET_NAMES: Record<string, string> = {
      phonepe: "PhonePe", paytm: "Paytm", amazonpay: "Amazon Pay",
      googlepay: "Google Pay", mobikwik: "MobiKwik",
    };

    function getPaymentSummary() {
      const label = PAYMENT_LABELS[paymentMethodId] ?? paymentMethodId;
      switch (paymentMethodId) {
        case "card": {
          const last4 = savedPayment.cardNumber?.replace(/\s/g, "").slice(-4) || "";
          const name = savedPayment.cardName || "";
          return { label, detail: last4 ? `**** **** **** ${last4}${name ? ` • ${name}` : ""}` : "Card details entered" };
        }
        case "netbanking":
          return { label, detail: savedPayment.netBankingBank || "Bank selected" };
        case "upi":
          return { label, detail: savedPayment.upiId || "UPI ID entered" };
        case "wallets": {
          const wName = WALLET_NAMES[savedPayment.selectedWallet] ?? savedPayment.selectedWallet ?? "Wallet selected";
          const mob = savedPayment.walletMobile ? ` • +91 ${savedPayment.walletMobile}` : "";
          return { label, detail: `${wName}${mob}` };
        }
        case "neft":
          return { label, detail: savedPayment.neftAccountName ? `${savedPayment.neftAccountName} • ${savedPayment.neftBankName || ""}` : "Bank account entered" };
        case "ban":
          return { label, detail: "Billed to company account" };
        default:
          return { label, detail: "" };
      }
    }

    function getPaymentIcon() {
      switch (paymentMethodId) {
        case "card":       return <CreditCard size={14} className="text-white" />;
        case "netbanking": return <Landmark size={14} className="text-white" />;
        case "wallets":    return <Wallet size={14} className="text-white" />;
        case "neft":       return <Banknote size={14} className="text-white" />;
        case "ban":        return <Building2 size={14} className="text-white" />;
        default:           return <CreditCard size={14} className="text-white" />;
      }
    }

    const paymentSummary = getPaymentSummary();

    const cartPricing = calculateCartPricing(cart);
    const {
      slabs: gstSlabs,
      totalGst,
      preTaxSubtotal: subtotal,
      shippingDeliveryFee,
      platformFee,
      grandTotal: totalAmount,
    } = cartPricing;
    const handlePlaceOrder = async () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const itemsSnapshot = cart.map((i, index) => ({
        ...i,
        checkoutUnitPriceInclusive: cartPricing.lines[index].checkoutUnitPriceInclusive,
        checkoutUnitPriceExclGst: cartPricing.lines[index].checkoutUnitPriceExclGst,
        checkoutGstRate: cartPricing.lines[index].taxRate,
      }));
      const orderNotes = limitCheckoutNote(localStorage.getItem(ORDER_NOTES_KEY) || "").trim();
      const orderDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const orderTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const formattedTotal = formatCurrency(totalAmount);
      const poRef = Date.now().toString().slice(-6);
      const requesterOptions = getOrderRequesterOptions(
        getPortalUsersByClient(cart[0]?.clientId || clientId).filter(user => user.status === "active"),
      );
      const selectedRequesterValue = normalizeOrderRequester(localStorage.getItem(requesterStorageKey));
      const requester = resolveOrderRequester(
        selectedRequesterValue,
        user?.name,
        requesterOptions,
      );
      const orderedBy = user?.name?.trim() || "Owner";
      const orderedFor = requesterOptions.find(option => option.value === selectedRequesterValue)?.label
        || "Ordered by self";
      const selectedClientId = cart[0]?.clientId || clientId || "";
      const selectedClient = isClientPortalUser
        ? getClientForPortal(selectedClientId)
        : getClients().find(candidate => candidate.id === selectedClientId);
      const clientName = selectedClient?.name || user?.clientName || selectedClientId || "—";

      const orderNumber = addOrder({
        clientId: selectedClientId,
        client: clientName,
        clientColor: "#2563eb",
        clientInitial: "N",
        poNumber: `${getPrefix("purchaseOrder") || "PO-"}${poRef}`,
        requester: orderedBy,
        requesterId: user?.id || "",
        requesterEmail: user?.email || "",
        orderedFor,
        // Hold every newly placed order until the centralized approval
        // evaluation completes. Orders without a matching workflow are
        // released immediately below, while matching workflows keep POs
        // blocked until final approval.
        deferPurchaseOrders: true,
        requesterRole: user?.role || "System Owner",
        requesterInitial: orderedBy.charAt(0).toUpperCase() || "O",
        requesterColor: "#6b46c1",
        assigned: "Admin",
        assignedRole: "Admin",
        assignedInitial: "A",
        assignedColor: "#276749",
        orderDate,
        orderTime,
        status: "Processing",
        slaTime: "02:00",
        slaAlert: false,
        totalAmount: formattedTotal,
        totalAmountNum: totalAmount,
        checkoutPricingSnapshot: {
          shippingDeliveryFee,
          platformFeePct: cartPricing.platformFeePct,
        },
        paymentMethod: paymentSummary.label,
        paymentDetail: paymentSummary.detail,
        paymentTerms: paymentTermsLabel,
        orderNotes,
        deliveryAddress: selectedAddr
          ? [selectedAddr.line1, selectedAddr.line2, selectedAddr.city, selectedAddr.state, selectedAddr.zip]
              .filter(Boolean).join(", ")
          : "",
        deliveryDetails: selectedAddr
          ? {
              label: selectedAddr.label,
              attentionName: selectedAddr.attentionName || selectedAddr.attention || "",
              line1: selectedAddr.line1,
              line2: selectedAddr.line2,
              city: selectedAddr.city,
              state: selectedAddr.state,
              country: selectedAddr.country,
              zip: selectedAddr.zip,
              phone: selectedAddr.phone,
              instructions: deliveryInstructions,
            }
          : undefined,
        cartItems: itemsSnapshot.map((i) => ({
          id: i.id,
          name: i.name,
          image: i.image,
          priceNum: i.priceNum,
          quantity: i.quantity,
          category: i.category,
          specs: Array.isArray(i.specs) ? i.specs : i.specs ? [i.specs] : [],
          moq: i.moq,
          productType: i.productType,
          physicalType: i.physicalType,
          fulfillmentType: i.fulfillmentType,
          commercialTerms: i.commercialTerms,
          clientId: i.clientId,
          productCode: i.productCode,
          vendorAllocations: i.vendorAllocations,
          // Vendor snapshot locked at add-to-cart time — travels with the order
          selectedVendorId: i.selectedVendorId,
          selectedVendorName: i.selectedVendorName,
          vendorPrice: i.vendorPrice,
          clientSellingPriceExclGst: i.clientSellingPriceExclGst,
          landedCost: i.landedCost,
          gstSnapshot: i.gstSnapshot,
          checkoutUnitPriceInclusive: i.checkoutUnitPriceInclusive,
          checkoutUnitPriceExclGst: i.checkoutUnitPriceExclGst,
          checkoutGstRate: i.checkoutGstRate,
          hsnSnapshot: i.hsnSnapshot,
          vendorRating: i.vendorRating,
          configuration: i.configuration,
          configurationPriceAdjustment: i.configurationPriceAdjustment,
          stockReservationId: `res_${i.productCode || i.id}_${i.selectedVendorId || "none"}_${Date.now()}`,
        })) satisfies OrderCartItem[],
      });

      // Evaluate the selected client's active portal workflow immediately after
      // the order is created. If no workflow matches, the existing order flow
      // remains unchanged; matching requests become visible in the portal.
      const approvalRequests = await createApprovalRequest({
        module: "Order",
        trigger: "Order created",
        reference: orderNumber,
        amount: totalAmount,
        requestedBy: user?.id || "system",
        requestedByName: orderedBy,
        requestedByRole: user?.role || "",
        userType: user?.userType || "nido_admin",
        clientId: selectedClientId,
        clientName,
        context: {
          amount: totalAmount,
          orderNumber,
          client: selectedClientId,
          requester,
        },
      });
      // If no active workflow matched, release the order immediately so the
      // normal non-approval checkout path is unchanged. Matching NIDO or
      // client workflows keep POs blocked until final approval.
      if (approvalRequests.length === 0) {
        createDraftPOsForOrder(orderNumber, itemsSnapshot.map((item) => ({
          ...item,
          subOrderId: item.subOrderId,
        })), paymentTermsLabel);
      }

      // Reserve stock immediately so the shop shows reduced available qty.
      // physicalStock stays unchanged; only reservedStock increases.
      for (const item of itemsSnapshot) {
        if (!item.productCode) continue;
        for (const alloc of (item.vendorAllocations || [])) {
          if (alloc.vendorId && alloc.allocated > 0) {
            reserveVendorStock(alloc.vendorId, item.productCode, alloc.allocated);
          }
        }
      }

      consumeCart();
      localStorage.removeItem(DELIVERY_INSTRUCTIONS_KEY);
      localStorage.removeItem(ORDER_NOTES_KEY);
      localStorage.removeItem(selectedAddressKey(clientId));
      navigate(`${orderConfirmationPath}/${orderNumber}`, {
        state: {
          orderNumber,
          orderDate: today,
          items: itemsSnapshot,
          subtotal,
          gst: totalGst,
          gstSlabs,
          shipping: shippingDeliveryFee,
          platformFee,
          total: totalAmount,
          address: selectedAddr
            ? { label: selectedAddr.label, line1: selectedAddr.line1, line2: selectedAddr.line2 ?? "", city: selectedAddr.city ?? "", state: selectedAddr.state ?? "", zip: selectedAddr.zip ?? "", phone: selectedAddr.phone }
            : null,
          paymentMethod: paymentSummary.label,
          paymentDetail: paymentSummary.detail,
          paymentTerms: paymentTermsLabel,
          clientEmail: "owner@nidotech.com",
          clientName,
        },
      });
    };

    if (cart.length === 0) {
      return <Navigate to={cartPath} replace />;
    }

    return (
      <div className="min-h-screen bg-white px-2 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
            <button onClick={() => navigate(catalogPath)} className="hover:text-blue-600">Home</button>
            <ChevronRight size={14} />
            <span>Shopping</span>
            <ChevronRight size={14} />
            <button onClick={() => navigate(cartPath)} className="hover:text-blue-600">My Cart</button>
            <ChevronRight size={14} />
            <button onClick={() => navigate(checkoutPath)} className="hover:text-blue-600">Checkout</button>
            <ChevronRight size={14} />
            <button onClick={() => navigate(paymentPath)} className="hover:text-blue-600">Payment</button>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">Review &amp; Place Order</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Review &amp; Place Order</h1>
          <p className="text-sm text-gray-500 mb-6">Please review your order details before placing the order</p>

          <CheckoutStepper current={3} />

          <div className="flex gap-2 items-start">
            {/* Left */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Delivery Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                {requiresDeliveryDetails ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900">Delivery Details</h2>
                      <button onClick={() => navigate(checkoutPath)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <Pencil size={11} /> Edit
                      </button>
                    </div>
                    {selectedAddr ? (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <MapPin size={18} className="text-blue-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">{selectedAddr.label}</span>
                            {selectedAddr.isDefault && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {selectedAddr.line1}
                            {selectedAddr.line2 && <><br />{selectedAddr.line2}</>}
                            <br />{selectedAddr.phone}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No delivery address selected. <button onClick={() => navigate(checkoutPath)} className="text-blue-600 hover:underline">Add one</button></p>
                    )}
                  </>
                ) : (
                  <div>
                    <h2 className="font-semibold text-gray-900">Digital delivery</h2>
                    <p className="mt-1 text-sm text-gray-500">No physical delivery address is required for this order.</p>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 text-sm">Payment Method</h2>
                  <button onClick={() => navigate(paymentPath)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Pencil size={11} /> Edit
                  </button>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-7 bg-blue-600 rounded flex items-center justify-center shrink-0">
                    {getPaymentIcon()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{paymentSummary.label}</p>
                    {paymentSummary.detail && (
                      <p className="text-xs text-gray-500">{paymentSummary.detail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Order Items ({cart.length})</h2>
                  <button onClick={() => navigate(cartPath)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Pencil size={11} /> Edit Cart
                  </button>
                </div>
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">No items in cart</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-3">Item</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2 pr-4">Price</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2 pr-4">Qty</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-2 pr-6">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => {
                        const unitPrice =
                          cartPricing.lines[index]?.checkoutUnitPriceInclusive ?? item.priceNum;
                        return (
                        <tr key={item.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-4 px-6">
                            <div className="flex items-start gap-3">
                              <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg border border-gray-100 shrink-0" />
                              <div>
                                <p className="font-medium text-sm text-gray-900 mb-1">{item.name}</p>
                                <p className="text-xs text-gray-400">{getProductSpecLines(item.specs, item.configuration).join(" • ")}</p>
                                <p className="text-xs text-gray-400 mt-1">MOQ: {item.moq}</p>
                                <ProductConfigurationSummary
                                  configuration={item.configuration}
                                  priceAdjustment={item.configurationPriceAdjustment}
                                  className="mt-2 rounded-md bg-violet-50 px-2.5 py-2"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 pr-4 align-top text-sm font-medium text-gray-900">{formatPrice(unitPrice)}</td>
                          <td className="py-4 pr-4 align-top text-sm text-gray-700">{item.quantity}</td>
                          <td className="py-4 pr-6 align-top text-sm font-semibold text-gray-900">{formatPrice(unitPrice * item.quantity)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => navigate(paymentPath)}
                  className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back to Payment
                </button>
                <button
                  onClick={handlePlaceOrder}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-2 py-2 text-sm transition-colors"
                >
                  <Lock size={15} />
                  Place Order
                </button>
              </div>
            </div>

            {/* Right */}
            <OrderSummaryPanel showItemList={false} />
          </div>
        </div>
      </div>
    );
  }
