// ── Platform Formatters ────────────────────────────────────────────────────────
// All formatting driven by GeneralSettings from configService.
// Import these everywhere instead of hardcoding ₹, en-IN, DD/MM/YYYY, etc.

import { getConfig, parseCurrencySymbol, type GeneralSettings } from "./configService";

// ── Locale derivation ──────────────────────────────────────────────────────────

/** Map config language/timezone to a JS Intl locale string. */
export function getLocale(config?: GeneralSettings): string {
  const cfg = config ?? getConfig();
  const lang = cfg.localization.language;
  if (lang.includes("India") || lang.includes("Hindi") || lang.includes("Tamil")) return "en-IN";
  if (lang.includes("US")) return "en-US";
  if (lang.includes("UK") || lang.includes("British")) return "en-GB";
  return "en-IN";
}

/** Whether to use the Indian number grouping (lakh/crore). */
export function isIndianFormat(config?: GeneralSettings): boolean {
  const cfg = config ?? getConfig();
  return cfg.localization.numberFormat.includes("Indian");
}

// ── Currency ───────────────────────────────────────────────────────────────────

/** Get the currency symbol from config, e.g. "₹", "$", "€". */
export function getCurrencySymbol(config?: GeneralSettings): string {
  const cfg = config ?? getConfig();
  return cfg.localization.currencySymbol || parseCurrencySymbol(cfg.localization.currency);
}

/** Extract an ISO currency code from settings values such as "USD ($)". */
export function getCurrencyCode(currency?: string): string {
  return currency?.match(/^[A-Z]{3}/)?.[0] ?? "INR";
}

/**
 * Convert a stored base-currency amount to the currently selected display
 * currency. Existing records remain stored in INR; only presentation changes.
 */
export function convertCurrency(value: number, config?: GeneralSettings): number {
  const cfg = config ?? getConfig();
  const baseCode = getCurrencyCode(cfg.localization.baseCurrency || "INR");
  const targetCode = getCurrencyCode(cfg.localization.currency);
  if (baseCode === targetCode) return value;

  const rate = cfg.localization.exchangeRates?.[targetCode];
  return typeof rate === "number" && Number.isFinite(rate) ? value * rate : value;
}

/**
 * Format a number as a currency string using the active config.
 * Uses compact suffixes (K / L / Cr) for Indian format when compact=true.
 */
export function formatCurrency(
  value: number,
  config?: GeneralSettings,
  options?: { compact?: boolean; decimals?: number }
): string {
  const cfg = config ?? getConfig();
  const sym = getCurrencySymbol(cfg);
  const locale = getLocale(cfg);
  const dec = options?.decimals ?? 2;
  const convertedValue = convertCurrency(value, cfg);

  if (options?.compact) {
    if (isIndianFormat(cfg)) {
      if (convertedValue >= 10_000_000) return `${sym}${(convertedValue / 10_000_000).toFixed(2)}Cr`;
      if (convertedValue >= 100_000) return `${sym}${(convertedValue / 100_000).toFixed(2)}L`;
      if (convertedValue >= 1_000) return `${sym}${(convertedValue / 1_000).toFixed(1)}K`;
      return `${sym}${Math.round(convertedValue).toLocaleString(locale)}`;
    } else {
      if (convertedValue >= 1_000_000) return `${sym}${(convertedValue / 1_000_000).toFixed(2)}M`;
      if (convertedValue >= 1_000) return `${sym}${(convertedValue / 1_000).toFixed(1)}K`;
      return `${sym}${Math.round(convertedValue).toLocaleString(locale)}`;
    }
  }

  const formatted = convertedValue.toLocaleString(locale, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  return `${sym}${formatted}`;
}

/**
 * Format number only (no symbol), respecting locale grouping.
 */
export function formatNumber(value: number, config?: GeneralSettings, decimals = 2): string {
  const cfg = config ?? getConfig();
  const locale = getLocale(cfg);
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── Dates ──────────────────────────────────────────────────────────────────────

/**
 * Format a date according to the active localization config.
 * Accepts Date objects, ISO strings, or timestamps.
 */
export function formatDate(date: Date | string | number, config?: GeneralSettings): string {
  const cfg = config ?? getConfig();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const locale = getLocale(cfg);
  const fmt = cfg.localization.dateFormat;

  // Use Intl for reliable formatting, then reorder to match chosen format
  const day = d.toLocaleString(locale, { day: "2-digit" });
  const month = d.toLocaleString(locale, { month: "2-digit" });
  const year = d.getFullYear().toString();
  const shortMonth = d.toLocaleString(locale, { month: "short" });

  switch (fmt) {
    case "MM/DD/YYYY": return `${month}/${day}/${year}`;
    case "YYYY-MM-DD": return `${year}-${month}-${day}`;
    case "DD-MM-YYYY": return `${day}-${month}-${year}`;
    case "DD MMM YYYY": return `${day} ${shortMonth} ${year}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format a date with time according to active config.
 */
export function formatDateTime(date: Date | string | number, config?: GeneralSettings): string {
  const cfg = config ?? getConfig();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const locale = getLocale(cfg);
  const use12h = cfg.localization.timeFormat === "12h";
  const datePart = formatDate(d, cfg);
  const timePart = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: use12h,
  });
  return `${datePart} ${timePart}`;
}

// ── Re-export helpers ──────────────────────────────────────────────────────────
export { parseCurrencySymbol } from "./configService";
