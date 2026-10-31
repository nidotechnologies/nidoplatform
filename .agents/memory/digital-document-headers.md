---
name: Digital document headers
description: Shared terminology for digital products across operational and financial documents.
---

Digital-only products use the Vendor Products terminology across order, procurement, billing, invoice, receipt, and generated-document surfaces: Users / Licenses, Tenure / Billing, and Provisioning Time. Physical products keep their existing Qty, Rate, MOQ, and delivery terminology; hybrid products remain physical-style unless explicitly reclassified.

When document metadata conflicts, an explicit `commercialTerms.productType` takes precedence over legacy `physicalType`.

**Why:** Financial documents still need stored rates and totals for accounting, but exposing physical unit-price headers on digital products creates inconsistent commercial language and can disclose a field the digital vendor flow intentionally hides. Legacy physical classifications can also be stale when commercial terms explicitly identify a digital product.

**How to apply:** Resolve type through the shared product classification rules and document presentation helper. Split mixed physical/digital generated documents into separate tables; do not apply one header set to every mixed row.