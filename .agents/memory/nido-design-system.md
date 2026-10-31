---
name: Nido Tech design system
description: Where the brand style spec lives and the rule to avoid when theming Tailwind config.
---

The full font/color/spacing/component spec (Inter/Poppins, enterprise blue
`#2563EB` palette, 8pt spacing) is documented in `STYLE_GUIDE.md` at the repo
root, sourced from a client-provided docx. `replit.md` links to it. All new UI
must reuse the `.text-*` typography utilities (`src/index.css`) and Tailwind
color tokens instead of hardcoding fonts/hex values.

**Tailwind config pitfall:** `theme.extend.colors` is a plain JS object —
defining `primary`/`background`/`card`/`border` twice (once var-driven via
`hsl(var(--x))`, once as a fixed hex enterprise override) silently drops the
var-driven entry since later keys win, which breaks `.dark`/`.comfort` theming.
**Why:** found this exact duplicate-key bug already present in `tailwind.config.js`
when applying the brand spec; fixed by keeping `primary`/`background`/`card`/`border`
var-driven only, and setting their CSS variables in `src/index.css` to the
enterprise hex values (converted to HSL) instead of redefining the Tailwind key.
**How to apply:** when adding/adjusting brand colors in this project, edit the
CSS variables in `src/index.css`, not by adding a second same-named key in
`tailwind.config.js`.
