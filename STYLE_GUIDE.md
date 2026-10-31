# Nido Tech Design System (source of truth)

This file mirrors `attached_assets/Font_and_styles_for_Nido_Tech_1783617058230.docx`.
**Any new UI must follow this spec.** Do not introduce new font sizes, colors,
radii, or spacing values outside of what's listed here — extend this file and
the tokens below first if a new need arises.

## Fonts
- Primary: **Inter** (everywhere)
- Accent: **Poppins** (headings only, optional) — currently used for H1 only.
- Loaded via Google Fonts in `index.html` and `src/index.css`.

## Type scale (use the `.text-*` utility classes in `src/index.css`)
| Style | Class | Size | Weight | Notes |
|---|---|---|---|---|
| H1 Page Title | `.text-h1` / `<h1>` | 24px | SemiBold | -0.3px tracking, Poppins |
| H2 Section Title | `.text-h2` / `<h2>` | 18px | Medium | |
| H3 Card Title | `.text-h3` / `<h3>` | 16px | Medium | |
| Body Large | `.text-body-lg` | 15px | Regular | |
| Body Default | `.text-body` | 14px | Regular | default body size |
| Body Small | `.text-body-sm` | 13px | Regular | |
| Label | `.text-label` | 13px | Medium | |
| Helper Text | `.text-helper` | 12px | Regular | muted color |
| Button Text | `.text-button` | 14px | Medium | |
| Table Text | `.text-table` | 13px | Regular | |

Line heights: headings 120–130%, body 140–150%, tables ~130%.

## Colors (Tailwind tokens, see `tailwind.config.js` / `src/index.css`)
- Primary Blue `#2563EB` (`bg-primary`), Hover `#1D4ED8`, Light `#DBEAFE`
- Background `#F8FAFC`, Card `#FFFFFF`, Border `#E5E7EB`, Divider `#F1F5F9`
- Text Primary `#111827` (`text-text-primary`), Secondary `#6B7280`, Muted `#9CA3AF`
- Success `#16A34A` / light `#DCFCE7`
- Warning `#F59E0B` / light `#FEF3C7`
- Error `#DC2626` / light `#FEE2E2`
- Info `#0EA5E9` / light `#E0F2FE`
- SLA status reuses Success/Warning/Error for Within SLA / Near Breach / Breached.

## Spacing (8pt grid — must follow)
4, 8, 12, 16, 20, 24, 32, 40, 48px. Card padding 20–24px, input padding 12–16px,
section gap 24–32px, table row height 44–48px.

## Layout
Sidebar 240px, content padding 24px, max width 1440px, 12-column grid, 24px gutter.

## Components
- Card: white bg, 1px `#E5E7EB` border, 12px radius, 20px padding, shadow `0 1px 2px rgba(0,0,0,0.05)`.
- Button primary: `#2563EB` bg, white text, 8px radius, 10px/16px padding.
- Input: 40px height, `#E5E7EB` border, 8px radius, blue focus border, 12px padding.
- Table: header bg `#F9FAFB`, 44px row height, hover `#F1F5F9`, 13px text.
- Status pill: pill radius (999px), 4px/10px padding, success/warning/error tinted bg (`Badge` variants `success|warning|error|info`).

## Rules for future work
1. Reuse the `.text-*` utilities and Tailwind color tokens (`primary`, `success`,
   `warning`, `error`, `info`, `text-primary`, `text-secondary`, `text-muted`,
   `border`, `divider`, `card`) instead of hardcoding hex values or `text-[Npx]`.
2. New shadcn/ui components should be re-themed to pull from these tokens
   (see `src/components/ui/*` for examples already aligned: `button`, `input`,
   `table`, `badge`).
3. Keep spacing to the 8pt scale (`tailwind.config.js` `spacing` extension).
4. If the docx spec is updated, update this file and the CSS/Tailwind tokens together.
