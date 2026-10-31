---
name: Quote PDF reference fidelity
description: The visual contract for quotation PDF downloads based on the uploaded estimate reference.
---

Quote downloads must render the current quote's products, pricing, client, dates, tax, totals, notes, terms, and organization details while preserving the uploaded estimate's one-page A4 visual shell and compact table style. The uploaded PDF remains a visual reference asset, not the dynamic download payload.

**Why:** The user refined the requirement from an unchanged static download to a quote-specific PDF that keeps the attached estimate's visual style.

**How to apply:** Use the `StoredQuote` and current organization configuration as the source of truth for the Download PDF controls. Keep the source PDF unchanged for reference and preserve the existing quote-email generator separately.