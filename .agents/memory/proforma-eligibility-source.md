---
name: Proforma eligibility source
description: The durable rule for determining whether an order item can generate a proforma invoice.
---

Proforma eligibility must be determined from the original product metadata carried by the cart/order item, including physical type, product type, and fulfillment type. Display-only commercial terms are not authoritative because legacy fallbacks can label an item as Physical Product when the source type is absent or non-physical. Missing, conflicting, or unknown metadata must be rejected; generic/default catalog labels must not override a meaningful non-physical classification.

**Why:** Products added through the Product Detail flow previously omitted type metadata, so a generic commercial-terms fallback made non-physical products appear eligible in Order Details.

**How to apply:** Preserve product-type fields whenever items move from catalog to cart to order to invoice, and use a shared fail-closed classifier at both UI action gates and persistence boundaries.