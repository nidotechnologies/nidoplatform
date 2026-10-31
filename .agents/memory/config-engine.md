---
name: Config Engine Architecture
description: Centralized configuration system — how settings flow from GeneralSettings UI to every component
---

# Configuration Engine Architecture

## Rule
All platform config (org info, theme, localization, procurement defaults, notifications, security) is read from `src/lib/configService.ts`. No hardcoding of org name, currency symbol, date format, or procurement defaults anywhere.

**Why:** The spec (ADDCLIENT docs) requires a "Global Configuration Engine" where every setting change in Configuration → General Settings immediately reflects across the entire platform.

## How to apply
- **New components that show currency/amounts** → import `useI18n` from `@/i18n/I18nProvider` and call `fmt(amount)` or `fmt(amount, true)` for compact (K/L/Cr) format.
- **New components that show dates** → use `fmtDate(dateString)` from `useI18n()`.
- **New components that show org name/email/address** → use `useOrgConfig()` from `@/contexts/ConfigContext`.
- **New procurement forms** → read defaults from `useProcurementConfig()` from `@/contexts/ConfigContext`.
- **PDF generators** → call `getConfig()` from `@/lib/configService` (sync, no React hooks) to get org and localization settings.

## File structure
- `src/lib/configService.ts` — types, defaults, `loadConfig()`, `saveConfig()`, `subscribeToConfig()`, `getConfig()`, `parseCurrencySymbol()`
- `src/lib/formatters.ts` — `formatCurrency()`, `formatDate()`, `formatDateTime()`, `getCurrencySymbol()`, `getLocale()`
- `src/contexts/ConfigContext.tsx` — React context: `useConfig()`, `useOrgConfig()`, `useLocalizationConfig()`, `useProcurementConfig()`, `useNotificationConfig()`, `useSecurityConfig()`
- `src/contexts/ThemeContext.tsx` — reads from `useConfig()`, applies dark/light mode + accent color + font size + density to `document.documentElement`
- `src/contexts/OrganizationContext.tsx` — `useOrganization()` → `{ org, currencySymbol }`
- `src/i18n/I18nProvider.tsx` — `useI18n()` → `{ fmt, fmtDate, fmtDateTime, currencySymbol, locale, localization }`

## localStorage key
`nido_general_settings` — merged with `CONFIG_DEFAULTS` on every read, so schema evolution is safe.

## Real-time update flow
1. User edits in GeneralSettingsTab → `updateSection()` → in-memory ConfigContext state updates
2. ThemeContext subscribes to ConfigContext → applies CSS vars immediately (live preview)
3. User clicks Save → `saveSettings()` → `saveConfig()` → fires `nido:config-changed` DOM event
4. All `subscribeToConfig()` listeners (OrganizationContext, I18nProvider) pick up the change
5. Components re-render with new values — no page reload required

## Client detail configuration save behavior
Edits in Client Details → Configuration → General and Price Setting remain local drafts until the user clicks Save Changes. General settings save per client; the three pricing subtabs share a save action that commits only changed pricing, slab, and market-price data. Switching among these subtabs must not persist edits.

**Why:** Client configuration changes must not take effect before the user explicitly confirms them.

**How to apply:** Keep client detail configuration inputs in draft state, compare against saved snapshots, and call the relevant store writers only from Save Changes.

## Provider order in App.tsx
ConfigProvider → ThemeProvider → I18nProvider → ... → OrganizationProvider
ThemeProvider and I18nProvider must be inside ConfigProvider.
