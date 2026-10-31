// ── I18n Provider ──────────────────────────────────────────────────────────────
// Reads localization settings from ConfigContext and re-exports helpers so
// every component can format dates, currency, and numbers consistently.

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { loadConfig, subscribeToConfig, type LocalizationSettings } from "@/lib/configService";
import { formatCurrency, formatDate, formatDateTime, getCurrencySymbol, getLocale } from "@/lib/formatters";

interface I18nContextType {
  localization: LocalizationSettings;
  /** Format a monetary amount using the active currency settings. */
  fmt: (amount: number, compact?: boolean) => string;
  /** Format a date using the active date format. */
  fmtDate: (date: Date | string | number) => string;
  /** Format a date+time using the active date/time format. */
  fmtDateTime: (date: Date | string | number) => string;
  /** The active currency symbol (e.g. "₹", "$"). */
  currencySymbol: string;
  /** The JS Intl locale string (e.g. "en-IN"). */
  locale: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(() => loadConfig());

  useEffect(() => {
    const unsub = subscribeToConfig((cfg) => setConfig(cfg));
    return unsub;
  }, []);

  const localization = config.localization;
  const currencySymbol = getCurrencySymbol(config);
  const locale = getLocale(config);

  const value: I18nContextType = {
    localization,
    fmt: (amount, compact = false) => formatCurrency(amount, config, { compact }),
    fmtDate: (date) => formatDate(date, config),
    fmtDateTime: (date) => formatDateTime(date, config),
    currencySymbol,
    locale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
