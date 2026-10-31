---
name: Order pricing and cancellation
description: Customer-versus-vendor price sources, checkout snapshots, and grouped-PO cancellation rules.
---

- Customer order totals and invoice line prices use the customer selling price saved at checkout. Purchase orders continue to use supplier cost.
- Cancellation is allowed until the affected item starts shipping. Keep cancelled PO lines for audit; recalculate totals from active lines and cancel a grouped PO only when every line is cancelled.
- New orders use exact checkout price and tax snapshots. For legacy orders without snapshots, allocate the saved order total across remaining lines in proportion to saved cart-line values.
- Do not rewrite issued invoice history. Exclude cancelled sub-orders from later invoice imports.

**Why:** The user selected customer selling prices for orders and invoices, supplier costs for POs, and a shipment-start cancellation cutoff with line-level cancellation for grouped POs.

**How to apply:** Keep these price sources and lifecycle rules consistent when changing Cart, Review, Order Details, invoice imports, PO updates, or PO documents.
