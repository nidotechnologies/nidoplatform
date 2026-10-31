---
name: Sales order PDF fidelity
description: The shared renderer and label-only variation used to keep sales-order PDFs aligned with quote PDFs.
---

Sales-order PDFs should use the same reference-quote PDF renderer and data shape, changing only the document title and date labels to “SALES ORDER”, “Order Date”, and “Delivery Date”.

**Why:** The user explicitly requires sales-order PDFs to match the established quote PDF format; maintaining a second renderer caused visual drift.

**How to apply:** Extend the shared quote renderer with narrowly scoped document-label options rather than duplicating layout logic in a sales-order-specific generator.