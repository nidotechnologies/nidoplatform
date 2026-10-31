import type { AddressDetails } from "@/lib/addressTypes";
import { createEmptyAddress, formatAddressDetails } from "@/lib/addressTypes";

// ── Centralized Configuration Service ─────────────────────────────────────────
// Single source of truth for all platform settings.
// Persists to localStorage. Fires a DOM event on every save so every
// subscriber (ConfigContext, ThemeContext, I18nProvider, etc.) updates
// automatically in real time — no page reload required.

export const CONFIG_STORAGE_KEY = "nido_general_settings";
export const CONFIG_CHANGED_EVENT = "nido:config-changed";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OrgSettings {
  companyName: string;
  displayName: string;
  gstNumber: string;
  panNumber: string;
  cin: string;
  registeredAddress: string;
  billingAddress: string;
  billingAddressDetails: AddressDetails;
  shippingAddressDetails: AddressDetails;
  phone: string;
  supportPhone: string;
  email: string;
  supportEmail: string;
  website: string;
  industry: string;
  fiscalYearStart: string;
  logoUrl: string;
  faviconUrl: string;
}

export interface ThemeSettings {
  mode: "light" | "dark";
  accentColor: "blue" | "purple" | "green" | "orange";
  density: "comfortable" | "compact";
  fontSize: "small" | "medium" | "large";
}

export interface LocalizationSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  currencySymbol: string;
  /** Stored monetary amounts use this base currency. */
  baseCurrency: string;
  /** Target-currency units received for one unit of baseCurrency. */
  exchangeRates: Record<string, number>;
  exchangeRatesUpdatedAt: string;
  numberFormat: string;
  weekStartDay: string;
  measurementUnit: string;
}

export interface ProcurementSettings {
  defaultCurrency: string;
  defaultPaymentTerms: string;
  defaultDeliveryTerms: string;
  defaultShippingMethod: string;
  defaultGstPercent: string;
  defaultLeadTimeDays: string;
  defaultMOQ: string;
  defaultQuoteValidityDays: string;
  defaultOrderPriority: string;
  approvalThreshold: string;
  autoApproveUnderThreshold: boolean;
  requireVendorQuoteComparison: boolean;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  pushNotifications: boolean;
  orderStatusChanges: boolean;
  approvalRequests: boolean;
  budgetAlerts: boolean;
  weeklySummary: boolean;
  contractRenewalAlerts: boolean;
  slaAlerts: boolean;
  invoiceNotifications: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: string;
  passwordExpiryDays: string;
  maxLoginAttempts: string;
  accountLockDurationMinutes: string;
  requireStrongPasswords: boolean;
  ipAllowlist: string;
  auditLogging: boolean;
  fileUploadLimitMB: string;
  allowedFileTypes: string;
}

export interface PrefixEntry {
  key: string;       // internal key e.g. "purchaseOrder"
  label: string;     // display name e.g. "Purchase Order"
  value: string;     // the actual prefix string e.g. "PO-"
  description: string;
  builtIn: boolean;  // built-in entries cannot be deleted
}

export interface GeneralSettings {
  organization: OrgSettings;
  theme: ThemeSettings;
  localization: LocalizationSettings;
  procurement: ProcurementSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  prefixes: PrefixEntry[];
}

// ── Defaults ───────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: GeneralSettings = {
  organization: {
    companyName: "Nido Tech Pvt. Ltd.",
    displayName: "Nido Tech",
    gstNumber: "27AACCN1234A1Z5",
    panNumber: "AACCN1234A",
    cin: "",
    registeredAddress: "",
    billingAddress: "",
    billingAddressDetails: createEmptyAddress(),
    shippingAddressDetails: createEmptyAddress(),
    phone: "+91-44-1234-5678",
    supportPhone: "",
    email: "info@nido-tech.com",
    supportEmail: "support@nido-tech.com",
    website: "www.nido-tech.com",
    industry: "Information Technology",
    fiscalYearStart: "April",
    logoUrl: "",
    faviconUrl: "",
  },
  theme: {
    mode: "light",
    accentColor: "blue",
    density: "comfortable",
    fontSize: "medium",
  },
  localization: {
    language: "English (India)",
    timezone: "Asia/Kolkata (IST, GMT+5:30)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
    currency: "INR (₹)",
    currencySymbol: "₹",
    baseCurrency: "INR",
    exchangeRates: {
      INR: 1,
      USD: 0.010471,
      EUR: 0.009061,
      GBP: 0.007743,
      AED: 0.038454,
    },
    exchangeRatesUpdatedAt: "",
    numberFormat: "1,23,456.00 (Indian)",
    weekStartDay: "Monday",
    measurementUnit: "Metric",
  },
  procurement: {
    defaultCurrency: "INR (₹)",
    defaultPaymentTerms: "Net 30 (Payment due in 30 days)",
    defaultDeliveryTerms: "Ex-Works",
    defaultShippingMethod: "Direct Delivery",
    defaultGstPercent: "18",
    defaultLeadTimeDays: "14",
    defaultMOQ: "1",
    defaultQuoteValidityDays: "30",
    defaultOrderPriority: "Medium",
    approvalThreshold: "50000",
    autoApproveUnderThreshold: true,
    requireVendorQuoteComparison: true,
  },
  notifications: {
    email: true,
    sms: false,
    inApp: true,
    pushNotifications: false,
    orderStatusChanges: true,
    approvalRequests: true,
    budgetAlerts: true,
    weeklySummary: false,
    contractRenewalAlerts: true,
    slaAlerts: true,
    invoiceNotifications: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeoutMinutes: "30",
    passwordExpiryDays: "90",
    maxLoginAttempts: "5",
    accountLockDurationMinutes: "15",
    requireStrongPasswords: true,
    ipAllowlist: "",
    auditLogging: true,
    fileUploadLimitMB: "25",
    allowedFileTypes: ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
  },
  prefixes: [
    { key: "purchaseOrder",    label: "Purchase Order",          value: "PO-",   description: "Purchase Order documents",          builtIn: true },
    { key: "purchaseRequest",  label: "Purchase Request",        value: "PR-",   description: "Purchase Request documents",        builtIn: true },
    { key: "order",             label: "Order",                   value: "ORD-",  description: "Customer order IDs",                 builtIn: true },
    { key: "invoice",          label: "Invoice",                 value: "INV-",  description: "Invoice documents",                 builtIn: true },
    { key: "salesOrder",       label: "Sales Order / Sub-order", value: "SO-",   description: "Sales Orders and Sub-order IDs",    builtIn: true },
    { key: "salesQuote",       label: "Sales Quote",             value: "QT-",   description: "Sales Quotation documents",         builtIn: true },
    { key: "rfq",              label: "Request for Quotation",   value: "RFQ-",  description: "RFQ sent to vendors",               builtIn: true },
    { key: "bill",             label: "Bill",                    value: "BL-",   description: "Bills received from vendors",       builtIn: true },
    { key: "expense",          label: "Expense",                 value: "EXP-",  description: "Expense records",                   builtIn: true },
    { key: "payment",          label: "Payment",                 value: "PMT-",  description: "Payment records",                   builtIn: true },
    { key: "creditNote",       label: "Credit Note",             value: "CR-",   description: "Credit Note documents",             builtIn: true },
    { key: "vendorCredit",     label: "Vendor Credit",           value: "VC-",   description: "Vendor credit documents",             builtIn: true },
    { key: "debitNote",        label: "Debit Note",              value: "DN-",   description: "Debit Note documents",              builtIn: true },
    { key: "goodsReceipt",     label: "Goods Receipt Note",      value: "GRN-",  description: "Goods Receipt Note documents",      builtIn: true },
    { key: "deliveryChallan",  label: "Delivery Challan",        value: "DC-",   description: "Delivery Challan documents",          builtIn: true },
    { key: "contract",         label: "Contract",                value: "CTR-",  description: "Contract documents",                builtIn: true },
    { key: "serviceRequest",   label: "Service Request",         value: "SVC-",  description: "Service Request numbers",           builtIn: true },
    { key: "supportTicket",    label: "Support Ticket",          value: "TKT-",  description: "Support Ticket numbers",            builtIn: true },
    { key: "vendor",              label: "Vendor",                  value: "VND-",  description: "Vendor IDs",                              builtIn: true },
    { key: "client",              label: "Client",                  value: "CL-",   description: "Client IDs",                              builtIn: true },
    { key: "department",          label: "Department",              value: "DEPT-", description: "Department IDs",                          builtIn: true },
    { key: "vendorProductCode",   label: "Vendor Product Code",     value: "VPC-",  description: "Vendor-specific product codes",           builtIn: true },
    { key: "clientProductCode",   label: "Client Product Code",     value: "CPC-",  description: "Client catalogue product codes",          builtIn: true },
    { key: "masterProductCode",   label: "Master Product Code",     value: "MPC-",  description: "Master catalogue product codes",          builtIn: true },
    { key: "sku",                 label: "SKU",                     value: "SKU-",  description: "Stock Keeping Unit codes",                builtIn: true },
  ],
};

// ── Core Functions ─────────────────────────────────────────────────────────────

/** Load settings from localStorage, merged with defaults to handle schema evolution. */
export function loadConfig(): GeneralSettings {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return CONFIG_DEFAULTS;
    const parsed = JSON.parse(raw);

    // Merge prefixes: keep all built-in defaults, overlay saved values, append any custom entries
    const savedPrefixes: PrefixEntry[] = Array.isArray(parsed.prefixes) ? parsed.prefixes : [];
    const mergedPrefixes = CONFIG_DEFAULTS.prefixes.map((def) => {
      const saved = savedPrefixes.find((p) => p.key === def.key);
      return saved ? { ...def, value: saved.value } : def;
    });
    // Append user-added custom prefixes (builtIn === false) that aren't in defaults
    const defaultKeys = new Set(CONFIG_DEFAULTS.prefixes.map((p) => p.key));
    const customPrefixes = savedPrefixes.filter((p) => !defaultKeys.has(p.key));

    const savedOrganization = parsed.organization ?? {};
    const organization = { ...CONFIG_DEFAULTS.organization, ...savedOrganization };
    const savedBillingDetails = savedOrganization.billingAddressDetails as Partial<AddressDetails> | undefined;
    const savedShippingDetails = savedOrganization.shippingAddressDetails as Partial<AddressDetails> | undefined;

    // Load only explicitly saved structured addresses. New/default forms stay
    // empty instead of being populated from the old demo address fields.
    organization.billingAddressDetails = {
      ...CONFIG_DEFAULTS.organization.billingAddressDetails,
      ...savedBillingDetails,
    };
    organization.shippingAddressDetails = {
      ...CONFIG_DEFAULTS.organization.shippingAddressDetails,
      ...savedShippingDetails,
    };

    return {
      organization,
      theme: { ...CONFIG_DEFAULTS.theme, ...parsed.theme },
      localization: { ...CONFIG_DEFAULTS.localization, ...parsed.localization },
      procurement: { ...CONFIG_DEFAULTS.procurement, ...parsed.procurement },
      notifications: { ...CONFIG_DEFAULTS.notifications, ...parsed.notifications },
      security: { ...CONFIG_DEFAULTS.security, ...parsed.security },
      prefixes: [...mergedPrefixes, ...customPrefixes],
    };
  } catch {
    return CONFIG_DEFAULTS;
  }
}

/**
 * Get the current prefix string for a given key (e.g. "purchaseOrder" → "PO-").
 * Falls back to the default if not found. Safe to call from non-React code.
 */
export function getPrefix(key: string): string {
  const cfg = loadConfig();
  const entry = cfg.prefixes.find((p) => p.key === key);
  if (entry) return entry.value;
  const def = CONFIG_DEFAULTS.prefixes.find((p) => p.key === key);
  return def ? def.value : "";
}

/** Save settings to localStorage and notify all subscribers. */
export function saveConfig(settings: GeneralSettings): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(settings));
  // Notify same-tab subscribers
  window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: settings }));
}

/** Get current config synchronously (alias for loadConfig). */
export function getConfig(): GeneralSettings {
  return loadConfig();
}

/**
 * Subscribe to config changes (both same-tab and cross-tab via storage event).
 * Returns an unsubscribe function.
 */
export function subscribeToConfig(
  callback: (settings: GeneralSettings) => void
): () => void {
  const onCustom = (e: Event) => {
    callback((e as CustomEvent<GeneralSettings>).detail);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONFIG_STORAGE_KEY) {
      callback(loadConfig());
    }
  };
  window.addEventListener(CONFIG_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONFIG_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extract the symbol from a currency string like "INR (₹)" → "₹" */
export function parseCurrencySymbol(currency: string): string {
  const match = currency.match(/\((.+?)\)/);
  return match ? match[1] : currency;
}
