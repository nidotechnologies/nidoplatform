import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight, ArrowLeft, Lock, CreditCard, Landmark, Wallet,
  Banknote, Building2, Info, Smartphone, QrCode, AlertCircle, CheckCircle2, Check
} from "lucide-react";
import { toast } from "sonner";
import CheckoutStepper from "./CheckoutStepper";
import OrderSummaryPanel from "./OrderSummaryPanel";
import { isValidPhoneNumber } from "@/lib/phoneValidation";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getClientContract } from "@/lib/clientDataStore";

const PAYMENT_METHODS = [
  { id: "card",       label: "Credit / Debit Card",  sub: "Visa, Mastercard, Rupay",       icon: CreditCard, badge: null    },
  { id: "netbanking", label: "Net Banking",           sub: "All major banks",               icon: Landmark,   badge: null    },
  { id: "upi",        label: "UPI",                   sub: "Pay using any UPI app",         icon: null,       badge: "UPI"   },
  { id: "wallets",    label: "Wallets",               sub: "PhonePe, Paytm, Amazon Pay",    icon: Wallet,     badge: null    },
  { id: "neft",       label: "NEFT / RTGS",           sub: "Direct bank transfer",          icon: Banknote,   badge: null    },
  { id: "ban",        label: "Company BAN",           sub: "Billed to company account",     icon: Building2,  badge: null    },
];

const NET_BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
  "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda",
  "Yes Bank", "IndusInd Bank", "IDFC First Bank", "Canara Bank", "Union Bank of India",
];

const WALLETS = [
  { id: "phonepe",   label: "PhonePe",    color: "bg-purple-600" },
  { id: "paytm",     label: "Paytm",      color: "bg-blue-500"   },
  { id: "amazonpay", label: "Amazon Pay", color: "bg-orange-500" },
  { id: "googlepay", label: "Google Pay", color: "bg-green-500"  },
  { id: "mobikwik",  label: "MobiKwik",   color: "bg-sky-500"    },
];

function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatPrice(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function SecurityNote() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-2.5">
      <Lock size={12} className="text-gray-400 shrink-0" />
      Your payment information is secure and encrypted
    </div>
  );
}

function FieldInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        {...props}
        className={`w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors ${props.className ?? ""}`}
      />
    </div>
  );
}

type PaymentState = {
  paymentMethod: string;
  cardNumber: string; cardName: string; expiryDate: string; cvv: string; saveCard: boolean;
  netBankingBank: string;
  upiId: string;
  selectedWallet: string; walletMobile: string;
  neftAccountName: string; neftAccountNumber: string; neftIfscCode: string; neftBankName: string;
};

const PAYMENT_SELECTION_KEY = "nido_payment_selection";
const PAYMENT_TERMS_KEY = "nido_payment_terms";
const PAYMENT_TERM_MODE_KEY = "nido_payment_term_mode";

function getClientAgreementPaymentTerm(clientId: string): string {
  if (!clientId) return "";

  const contractTerms = getClientContract(clientId)?.data.commercialTerms;
  if (contractTerms && typeof contractTerms === "object" && "paymentTerms" in contractTerms) {
    const term = (contractTerms as { paymentTerms?: unknown }).paymentTerms;
    if (typeof term === "string" && term.trim()) return term.trim();
  }

  return "";
}

function paymentStorageKey(key: string, clientId: string): string {
  return clientId ? `${key}:${encodeURIComponent(clientId)}` : key;
}

const DEFAULT_PAYMENT_STATE: PaymentState = {
  paymentMethod: "card",
  cardNumber: "", cardName: "", expiryDate: "", cvv: "", saveCard: true,
  netBankingBank: "",
  upiId: "",
  selectedWallet: "", walletMobile: "",
  neftAccountName: "", neftAccountNumber: "", neftIfscCode: "", neftBankName: "",
};

function loadPaymentState(): PaymentState {
  try {
    const saved = JSON.parse(localStorage.getItem(PAYMENT_SELECTION_KEY) || "null");
    if (saved && typeof saved === "object") {
      return { ...DEFAULT_PAYMENT_STATE, ...saved };
    }
  } catch {
    // Ignore malformed checkout state and start with the defaults.
  }
  return DEFAULT_PAYMENT_STATE;
}

function CardPanel({ state, onChange }: { state: PaymentState; onChange: (d: Partial<PaymentState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
        <div className="relative">
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            value={state.cardNumber}
            onChange={(e) => onChange({ cardNumber: formatCardNumber(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 pr-10"
          />
          <CreditCard size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      <FieldInput label="Name on Card" type="text" placeholder="John Doe" value={state.cardName} onChange={(e) => onChange({ cardName: (e.target as HTMLInputElement).value })} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
          <input
            type="text" placeholder="MM / YY" value={state.expiryDate} maxLength={7}
            onChange={(e) => {
              let val = e.target.value.replace(/\D/g, "");
              if (val.length >= 3) val = val.slice(0, 2) + " / " + val.slice(2, 4);
              onChange({ expiryDate: val });
            }}
            className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
          <div className="relative">
            <input
              type="password" placeholder="123" value={state.cvv} maxLength={4}
              onChange={(e) => onChange({ cvv: e.target.value.replace(/\D/g, "") })}
              className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 pr-10"
            />
            <Info size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={state.saveCard} onChange={(e) => onChange({ saveCard: e.target.checked })} className="w-4 h-4 accent-blue-600" />
        <span className="text-sm text-gray-700">Save card for faster payments</span>
      </label>
      <SecurityNote />
    </div>
  );
}

function NetBankingPanel({ state, onChange }: { state: PaymentState; onChange: (d: Partial<PaymentState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Select Your Bank</label>
        <select value={state.netBankingBank} onChange={(e) => onChange({ netBankingBank: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
          <option value="">-- Choose a bank --</option>
          {NET_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {NET_BANKS.slice(0, 6).map((bank) => (
          <button key={bank} onClick={() => onChange({ netBankingBank: bank })}
            className={`flex items-center gap-1.5 border rounded-lg px-2 py-2 text-xs font-medium transition-colors ${state.netBankingBank === bank ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
            <Landmark size={11} className="shrink-0" />
            <span className="truncate">{bank.replace("Bank", "").trim()}</span>
          </button>
        ))}
      </div>
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-2.5 text-xs text-amber-700">
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        You will be redirected to your bank's secure login page to complete the payment.
      </div>
      <SecurityNote />
    </div>
  );
}

function UpiPanel({ state, onChange }: { state: PaymentState; onChange: (d: Partial<PaymentState>) => void }) {
  const valid = state.upiId.includes("@");
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">UPI ID</label>
        <div className="relative">
          <input type="text" placeholder="yourname@upi" value={state.upiId} onChange={(e) => onChange({ upiId: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 pr-10" />
          {state.upiId && <CheckCircle2 size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 ${valid ? "text-green-500" : "text-gray-300"}`} />}
        </div>
        <p className="text-xs text-gray-400 mt-1">e.g. 9876543210@okaxis, name@paytm, name@ybl</p>
      </div>
      <div className="text-center text-xs text-gray-400 font-medium">— OR —</div>
      <div className="border border-dashed border-gray-200 rounded-xl p-2 flex flex-col items-center gap-3">
        <QrCode size={56} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Scan QR Code</p>
        <p className="text-xs text-gray-400 text-center">Open any UPI app and scan the QR code to pay</p>
        <div className="flex gap-2 mt-1">
          {["PhonePe", "GPay", "Paytm", "BHIM"].map((app) => (
            <span key={app} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{app}</span>
          ))}
        </div>
      </div>
      <SecurityNote />
    </div>
  );
}

function WalletsPanel({ state, onChange }: { state: PaymentState; onChange: (d: Partial<PaymentState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Select Wallet</p>
        <div className="grid grid-cols-2 gap-2">
          {WALLETS.map((w) => (
            <button key={w.id} onClick={() => onChange({ selectedWallet: w.id })}
              className={`flex items-center gap-3 border rounded-xl p-2 transition-colors ${state.selectedWallet === w.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className={`w-8 h-8 rounded-lg ${w.color} flex items-center justify-center shrink-0`}>
                <Wallet size={14} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{w.label}</p>
                {state.selectedWallet === w.id && <p className="text-xs text-blue-600">Selected</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
      {state.selectedWallet && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Registered Mobile Number</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">+91</span>
            <input type="tel" placeholder="9876543210" maxLength={10} value={state.walletMobile}
              onChange={(e) => onChange({ walletMobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              className="w-full border border-gray-200 rounded-lg pl-12 pr-10 py-2.5 text-sm outline-none focus:border-blue-400" />
            <Smartphone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Enter the mobile number linked to your {WALLETS.find((w) => w.id === state.selectedWallet)?.label} account</p>
        </div>
      )}
      <SecurityNote />
    </div>
  );
}

function NeftPanel({ state, onChange }: { state: PaymentState; onChange: (d: Partial<PaymentState>) => void }) {
  return (
    <div className="space-y-4">
      <FieldInput label="Account Holder Name" type="text" placeholder="Full name as on bank account" value={state.neftAccountName} onChange={(e) => onChange({ neftAccountName: (e.target as HTMLInputElement).value })} />
      <FieldInput label="Account Number" type="text" placeholder="Enter your account number" value={state.neftAccountNumber} onChange={(e) => onChange({ neftAccountNumber: (e.target as HTMLInputElement).value.replace(/\D/g, "") })} />
      <div className="flex gap-3">
        <div className="flex-1">
          <FieldInput label="IFSC Code" type="text" placeholder="SBIN0001234" value={state.neftIfscCode} onChange={(e) => onChange({ neftIfscCode: (e.target as HTMLInputElement).value.toUpperCase() })} />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
          <select value={state.neftBankName} onChange={(e) => onChange({ neftBankName: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">-- Select bank --</option>
            {NET_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2 py-2.5 text-xs text-blue-700">
        <Info size={13} className="shrink-0 mt-0.5" />
        NEFT transfers are processed within 2–4 hours on working days. RTGS is processed in real-time for amounts above ₹2 lakh.
      </div>
      <SecurityNote />
    </div>
  );
}

function CompanyBanPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[180px] gap-2 text-center py-6">
      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
        <Building2 size={26} className="text-blue-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-1">Company BAN</p>
        <p className="text-sm text-gray-500 max-w-[220px] leading-relaxed">
          This order will be billed directly to your company account.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-2.5 w-full justify-center">
        <Lock size={12} className="text-gray-400 shrink-0" />
        Billing is managed by your company's IT / Finance team
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: cart } = useCart();
  const { user, isClientPortalUser } = useAuth();
  const cartClientId = cart.find((item) => item.clientId)?.clientId || "";
  const clientId = isClientPortalUser
    ? user?.clientId || cartClientId
    : localStorage.getItem("nido_shop_selected_client") || cartClientId;
  const agreementPaymentTerm = getClientAgreementPaymentTerm(clientId);
  const isPortalFlow = location.pathname.startsWith("/portal/");
  const catalogPath = isPortalFlow ? "/portal/catalog" : "/shop";
  const cartPath = isPortalFlow ? "/portal/shop/cart" : "/shop/cart";
  const checkoutPath = isPortalFlow ? "/portal/shop/checkout" : "/shop/checkout";
  const reviewPath = isPortalFlow ? "/portal/shop/checkout/review" : "/shop/checkout/review";
  const [state, setState] = useState<PaymentState>(loadPaymentState);
  const [paymentTermMode, setPaymentTermMode] = useState<"postpaid" | "prepaid">(() => {
    if (agreementPaymentTerm) return "postpaid";
    const savedMode = localStorage.getItem(paymentStorageKey(PAYMENT_TERM_MODE_KEY, clientId))
      || localStorage.getItem(PAYMENT_TERM_MODE_KEY);
    const savedTerms = localStorage.getItem(paymentStorageKey(PAYMENT_TERMS_KEY, clientId))
      || localStorage.getItem(PAYMENT_TERMS_KEY);
    return savedMode === "prepaid" || savedTerms === "Prepaid" ? "prepaid" : "postpaid";
  });
  const paymentTerms = agreementPaymentTerm;

  useEffect(() => {
    localStorage.setItem(paymentStorageKey(PAYMENT_TERMS_KEY, clientId), paymentTerms);
    localStorage.setItem(paymentStorageKey(PAYMENT_TERM_MODE_KEY, clientId), paymentTermMode);
    localStorage.setItem(PAYMENT_TERMS_KEY, paymentTermMode === "prepaid" ? "Prepaid" : paymentTerms);
    localStorage.setItem(PAYMENT_TERM_MODE_KEY, paymentTermMode);
  }, [clientId, paymentTermMode, paymentTerms]);

  const onChange = (d: Partial<PaymentState>) => {
    setState((prev) => {
      const next = { ...prev, ...d };
      localStorage.setItem(PAYMENT_SELECTION_KEY, JSON.stringify(next));
      return next;
    });
  };
  const visiblePaymentMethods = paymentTermMode === "postpaid"
    ? PAYMENT_METHODS.filter((method) => method.id === "ban")
    : PAYMENT_METHODS.filter((method) => method.id !== "ban");
  const activePaymentMethod = paymentTermMode === "postpaid"
    ? "ban"
    : state.paymentMethod === "ban"
      ? "card"
      : state.paymentMethod;

  function renderDetailsPanel() {
    switch (activePaymentMethod) {
      case "card":       return <CardPanel state={state} onChange={onChange} />;
      case "netbanking": return <NetBankingPanel state={state} onChange={onChange} />;
      case "upi":        return <UpiPanel state={state} onChange={onChange} />;
      case "wallets":    return <WalletsPanel state={state} onChange={onChange} />;
      case "neft":       return <NeftPanel state={state} onChange={onChange} />;
      case "ban":        return <CompanyBanPanel />;
      default:
        return (
          <div className="flex-1 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm h-40">
            Select a payment method to continue
          </div>
        );
    }
  }

  const panelTitle: Record<string, string> = {
    card: "Card Details", netbanking: "Net Banking", upi: "UPI Payment",
    wallets: "Wallet Payment", neft: "NEFT / RTGS Details", ban: "Company BAN",
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
          <span className="text-gray-900 font-medium">Payment</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Payment</h1>
        <p className="text-sm text-gray-500 mb-6">Choose a payment method and complete your purchase securely</p>

        <CheckoutStepper current={2} />

        <div className="flex gap-2 items-start">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Payment terms */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 text-base mb-1">Payment Terms</h2>
              <p className="text-xs text-gray-500 mb-3">Choose how this order will be settled.</p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  {
                    value: "postpaid" as const,
                    label: "Postpaid",
                    description: "Use the payment terms agreed in the client contract.",
                    icon: Building2,
                  },
                  {
                    value: "prepaid" as const,
                    label: "Prepaid",
                    description: "Pay securely now before the order is processed.",
                    icon: Check,
                  },
                ]).map((option) => {
                  const selected = paymentTermMode === option.value;
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentTermMode"
                        className="accent-blue-600 shrink-0"
                        checked={selected}
                        onChange={() => {
                          setPaymentTermMode(option.value);
                          localStorage.setItem(PAYMENT_TERM_MODE_KEY, option.value);
                          if (option.value === "prepaid") {
                            localStorage.setItem(PAYMENT_TERMS_KEY, "Prepaid");
                             onChange({ paymentMethod: state.paymentMethod === "ban" ? "card" : state.paymentMethod });
                          } else {
                            localStorage.setItem(PAYMENT_TERMS_KEY, paymentTerms);
                             onChange({ paymentMethod: "ban" });
                          }
                        }}
                      />
                      <Icon size={16} className={selected ? "text-blue-600 shrink-0" : "text-gray-400 shrink-0"} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {paymentTermMode === "postpaid" ? (
                <div className="mt-3">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Contract payment term</label>
                  <select
                    value={agreementPaymentTerm}
                    disabled={!agreementPaymentTerm}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-400"
                  >
                    {agreementPaymentTerm
                      ? <option value={agreementPaymentTerm}>{agreementPaymentTerm}</option>
                      : <option value="">No payment term saved in this client’s contract</option>}
                  </select>
                  <p className="mt-2 text-[11px] text-gray-500">
                    {agreementPaymentTerm
                      ? "Fetched from this client’s saved contract and cannot be changed here."
                      : "Add a payment term to this client’s contract to use postpaid billing."}
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  <Check size={13} className="shrink-0" />
                  Pay by card, UPI / QR code, net banking, NEFT / RTGS, or wallets on the next step.
                </div>
              )}
            </div>

            {/* Payment methods + details */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 text-base mb-4">Select Payment Method</h2>
              <div className="flex gap-4">
                {/* Methods list */}
                <div className="space-y-2.5 w-60 shrink-0">
                   {visiblePaymentMethods.map((m) => (
                    <label key={m.id}
                       className={`flex items-center gap-3 p-2 border rounded-xl cursor-pointer transition-colors ${activePaymentMethod === m.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="payment" className="accent-blue-600 shrink-0"
                         checked={activePaymentMethod === m.id}
                        onChange={() => onChange({ paymentMethod: m.id })} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.label}</p>
                        <p className="text-xs text-gray-500 truncate">{m.sub}</p>
                      </div>
                      {m.badge && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium shrink-0">{m.badge}</span>}
                      {m.icon && !m.badge && <m.icon size={15} className="text-gray-400 shrink-0" />}
                    </label>
                  ))}
                </div>
                {/* Details panel */}
                <div className="flex-1 border border-gray-200 rounded-xl p-5">
                   <h3 className="font-semibold text-gray-900 text-sm mb-4">{panelTitle[activePaymentMethod] ?? "Payment Details"}</h3>
                  {renderDetailsPanel()}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => navigate(checkoutPath)}
                className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <ArrowLeft size={15} />
                Back to Delivery
              </button>
              <button onClick={() => {
                   if (activePaymentMethod === "wallets" && !isValidPhoneNumber(state.walletMobile)) {
                    toast.error("Registered mobile number must contain exactly 10 digits.");
                    return;
                  }
                   localStorage.setItem(PAYMENT_SELECTION_KEY, JSON.stringify({
                     ...state,
                     paymentMethod: activePaymentMethod,
                   }));
                  navigate(reviewPath);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-2 py-2 text-sm transition-colors">
                Review Order
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Right */}
          <OrderSummaryPanel showItemList />
        </div>
      </div>
    </div>
  );
}
