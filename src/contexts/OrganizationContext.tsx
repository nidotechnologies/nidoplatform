// ── Organization Context ───────────────────────────────────────────────────────
// Exposes org settings from the centralized config to any component.
// Stays in sync with ConfigContext automatically via subscribeToConfig.

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { loadConfig, subscribeToConfig, parseCurrencySymbol, type OrgSettings } from "@/lib/configService";

interface OrganizationContextType {
  org: OrgSettings;
  currencySymbol: string;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState(() => loadConfig());

  useEffect(() => {
    const unsub = subscribeToConfig((newCfg) => setCfg(newCfg));
    return unsub;
  }, []);

  const currencySymbol =
    cfg.localization.currencySymbol ||
    parseCurrencySymbol(cfg.localization.currency);

  return (
    <OrganizationContext.Provider value={{ org: cfg.organization, currencySymbol }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrganizationContextType {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within <OrganizationProvider>");
  return ctx;
}
