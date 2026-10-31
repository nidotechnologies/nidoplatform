---
name: Invoice import behavior
description: Rules for creating invoices from orders and delivering them to client recipients.
---

Order-to-invoice imports exclude items already in a return workflow because those items are no longer billable on the new invoice. Client invoice delivery supports a primary address plus additional recipients, while legacy invoices retain the primary field.

**Why:** Returned items must not be billed again, and client records commonly need invoices delivered to both an operational and an accounts mailbox.

**How to apply:** Keep the return-status filter tied to persisted sub-order status, resolve HSN/SAC from the tax/category configuration, and send the stored recipient set when an invoice is sent.