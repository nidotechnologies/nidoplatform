// ── Theme Context ──────────────────────────────────────────────────────────────
// Reads theme settings from ConfigContext and applies them to the DOM in real
// time: dark/light mode, accent color, font size, density.
// Reacts to BOTH in-memory config changes (live preview) AND persisted saves.

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { subscribeToConfig, loadConfig, type ThemeSettings } from "@/lib/configService";
import { useConfig } from "@/contexts/ConfigContext";

// ── Accent color presets ───────────────────────────────────────────────────────
const ACCENT_PRESETS: Record<
  ThemeSettings["accentColor"],
  { primary: string; primaryHover: string; accent: string; accentFg: string; ring: string; hex: string }
> = {
  blue: {
    primary: "221 83% 53%",
    primaryHover: "221 83% 43%",
    accent: "214 95% 93%",
    accentFg: "221 83% 53%",
    ring: "221 83% 53%",
    hex: "#2563eb",
  },
  purple: {
    primary: "262 83% 58%",
    primaryHover: "262 83% 48%",
    accent: "270 95% 93%",
    accentFg: "262 83% 58%",
    ring: "262 83% 58%",
    hex: "#7c3aed",
  },
  green: {
    primary: "142 76% 36%",
    primaryHover: "142 76% 28%",
    accent: "142 72% 90%",
    accentFg: "142 76% 36%",
    ring: "142 76% 36%",
    hex: "#16a34a",
  },
  orange: {
    primary: "25 95% 53%",
    primaryHover: "25 95% 43%",
    accent: "38 95% 93%",
    accentFg: "25 95% 53%",
    ring: "25 95% 53%",
    hex: "#ea580c",
  },
};

const FONT_SIZES: Record<ThemeSettings["fontSize"], string> = {
  small: "13px",
  medium: "15px",
  large: "17px",
};

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;

  // ── Dark / Light ─────────────────────────────────────────────────────────────
  root.classList.toggle("dark", theme.mode === "dark");

  // ── Accent color ─────────────────────────────────────────────────────────────
  const palette = ACCENT_PRESETS[theme.accentColor] ?? ACCENT_PRESETS.blue;
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--primary-hover", palette.primaryHover);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--accent-foreground", palette.accentFg);
  root.style.setProperty("--ring", palette.ring);
  root.style.setProperty("--ds-primary", palette.hex);

  // ── Font size ────────────────────────────────────────────────────────────────
  root.style.setProperty("--config-font-size", FONT_SIZES[theme.fontSize] ?? "15px");
  root.style.fontSize = FONT_SIZES[theme.fontSize] ?? "15px";

  // ── Density ──────────────────────────────────────────────────────────────────
  root.setAttribute("data-density", theme.density);
  root.style.setProperty(
    "--config-density-scale",
    theme.density === "compact" ? "0.85" : "1"
  );
}

// ── Context ────────────────────────────────────────────────────────────────────
const ThemeContext = createContext<{ theme: ThemeSettings } | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Use ConfigContext for live (in-memory) updates — applies immediately on change
  const { config } = useConfig();

  // Apply whenever the in-memory theme config changes (live preview before save)
  useEffect(() => {
    applyTheme(config.theme);
  }, [config.theme]);

  return (
    <ThemeContext.Provider value={{ theme: config.theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): { theme: ThemeSettings } {
  const ctx = useContext(ThemeContext);
  return ctx ?? { theme: loadConfig().theme };
}
