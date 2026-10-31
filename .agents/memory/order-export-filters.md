---
name: Order export filters
description: Shared date, status, and client behavior for My Orders and Vendor Orders CSV exports.
---

Export-dialog criteria narrow the records already visible after each page's existing filters; they do not replace search, tabs, vendor scope, or other applied filters. Empty status/client selections mean all values, and date bounds are inclusive. My Orders uses the order date; Vendor Orders uses the purchase-order creation date.

**Why:** My Orders already exports its filtered result set, and Vendor Orders must continue respecting its current filters while gaining additional export criteria.

**How to apply:** Keep these semantics aligned when changing either page's export flow or adding new export criteria.