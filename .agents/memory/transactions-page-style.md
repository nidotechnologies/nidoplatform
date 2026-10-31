---
name: Transaction page shell style
description: The canonical page shell/card pattern used across Transactions pages (Orders, Bills, PO, etc.) for visual consistency
---

Transactions-section pages should use: outer wrapper `max-w-[1280px] mx-auto`, cards as `bg-white border border-gray-200 rounded-xl`, page title `text-2xl font-bold text-gray-900`, table header rows `bg-gray-50`. Avoid `slate-*` and `dark:*` classes — the app has no dark mode and uses gray as the neutral palette.

**Why:** Transactions pages were built ad hoc (different generations/prompts) with inconsistent wrappers (`bg-gray-100 min-h-screen p-4`, `bg-slate-100`, dark-mode leftovers) that didn't match the Orders page reference style the user pointed to.

**How to apply:** When touching any Transactions-area page, check it against this pattern before styling; grep for `slate-` and `dark:` as a regression check.
