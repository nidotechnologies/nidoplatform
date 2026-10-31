// ── Configuration Context ──────────────────────────────────────────────────────
// Provides live GeneralSettings to every component in the tree.
// Wraps configService so components never touch localStorage directly.

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  loadConfig,
  saveConfig,
  subscribeToConfig,
  type GeneralSettings,
  type OrgSettings,
  type ThemeSettings,
  type LocalizationSettings,
  type ProcurementSettings,
  type NotificationSettings,
  type SecuritySettings,
} from "@/lib/configService";
import { getCurrencyCode } from "@/lib/formatters";

// ── Context shape ──────────────────────────────────────────────────────────────

interface ConfigContextType {
  config: GeneralSettings;
  /** Patch a single section in memory (not yet persisted). */
  updateSection: <K extends keyof GeneralSettings>(
    section: K,
    patch: Partial<GeneralSettings[K]>
  ) => void;
  /** Persist current in-memory state to localStorage and notify the whole app. */
  saveSettings: () => void;
  /**
   * Atomically commit a complete settings snapshot — sets both in-memory config
   * and the persisted baseline in one shot.  Used by GeneralSettingsTab so that
   * draft changes are only published when the user explicitly clicks Save.
   */
  commitSettings: (newConfig: GeneralSettings) => void;
  /** True when in-memory config differs from what is persisted. */
  isDirty: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────────

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GeneralSettings>(() => loadConfig());
  const [savedConfig, setSavedConfig] = useState<GeneralSettings>(() => loadConfig());

  // Subscribe to external changes (cross-tab storage events, or other saves)
  useEffect(() => {
    const unsub = subscribeToConfig((newConfig) => {
      setConfig(newConfig);
      setSavedConfig(newConfig);
    });
    return unsub;
  }, []);

  const updateSection = useCallback(
    <K extends keyof GeneralSettings>(section: K, patch: Partial<GeneralSettings[K]>) => {
      setConfig((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...patch },
      }));
    },
    []
  );

  const saveSettings = useCallback(() => {
    // saveConfig fires the CONFIG_CHANGED_EVENT which our subscriber above will pick
    // up, but we also update savedConfig immediately to clear the dirty flag.
    saveConfig(config);
    setSavedConfig(config);
  }, [config]);

  const commitSettings = useCallback((newConfig: GeneralSettings) => {
    const previousConfig = loadConfig();
    setConfig(newConfig);
    setSavedConfig(newConfig);
    saveConfig(newConfig);

    const previousCurrency = getCurrencyCode(previousConfig.localization.currency);
    const selectedCurrency = getCurrencyCode(newConfig.localization.currency);
    if (previousCurrency === selectedCurrency) return;

    // Apply the bundled rate immediately, then replace it with the latest
    // server-fetched rates when available.
    void fetch("/api/exchange-rates?base=INR")
      .then((response) => {
        if (!response.ok) throw new Error(`Exchange-rate request failed (${response.status})`);
        return response.json() as Promise<{ rates?: Record<string, number>; fetchedAt?: string }>;
      })
      .then((payload) => {
        if (!payload.rates || typeof payload.rates[selectedCurrency] !== "number") return;
        const updatedConfig: GeneralSettings = {
          ...newConfig,
          localization: {
            ...newConfig.localization,
            exchangeRates: { ...newConfig.localization.exchangeRates, ...payload.rates, INR: 1 },
            exchangeRatesUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
          },
        };
        setConfig(updatedConfig);
        setSavedConfig(updatedConfig);
        saveConfig(updatedConfig);
      })
      .catch((error) => {
        console.warn("[currency] live exchange rates unavailable; using cached rates", error);
      });
  }, []);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);

  return (
    <ConfigContext.Provider value={{ config, updateSection, saveSettings, commitSettings, isDirty }}>
      {children}
    </ConfigContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useConfig(): ConfigContextType {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within <ConfigProvider>");
  return ctx;
}

// ── Convenience section hooks ──────────────────────────────────────────────────

export function useOrgConfig(): OrgSettings {
  return useConfig().config.organization;
}

export function useThemeConfig(): ThemeSettings {
  return useConfig().config.theme;
}

export function useLocalizationConfig(): LocalizationSettings {
  return useConfig().config.localization;
}

export function useProcurementConfig(): ProcurementSettings {
  return useConfig().config.procurement;
}

export function useNotificationConfig(): NotificationSettings {
  return useConfig().config.notifications;
}

export function useSecurityConfig(): SecuritySettings {
  return useConfig().config.security;
}

// Re-export types for convenience
export type {
  GeneralSettings,
  OrgSettings,
  ThemeSettings,
  LocalizationSettings,
  ProcurementSettings,
  NotificationSettings,
  SecuritySettings,
};
