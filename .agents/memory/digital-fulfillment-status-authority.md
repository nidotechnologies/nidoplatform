---
name: Digital fulfillment status authority
description: The linked PO line is the source of truth for digital fulfillment progress.
---

The linked confirmed PO line is the source of truth for digital progress. Order Details must not advance beyond it, and Vendor Orders and My Orders summaries must reflect the same saved line status. Partial provisioning must reuse the exact completed quantity recorded on the PO. A single-unit order cannot be partially provisioned.

**Why:** The user explicitly requires PO-first status changes and consistent statuses across PO details, Order Details, Vendor Orders, and My Orders so the views do not diverge.

**How to apply:** Keep the check in both the visible Order Details status menu and its update handler. Project saved PO line progress into linked order items and derive list summaries from those items. Compare normalized digital stages so saved partial quantities still match their stage, and copy the PO's partial count rather than prompting for a second value.
