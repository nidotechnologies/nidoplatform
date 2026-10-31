---
name: Approval engine local mode
description: Local approval workflow execution is the current pre-database mode and preserves the backend service contract.
---

The approval workflow service defaults to browser-local persistence so the complete workflow can be exercised before the database is connected. The same exported service functions retain the backend response shapes, and backend mode is enabled explicitly with `VITE_APPROVAL_BACKEND=true`.

**Why:** The imported NIDO application currently has backend approval routes but no configured approval database, while the workflow needs to be validated end-to-end before backend integration.

**How to apply:** Keep workflow configuration, requests, version history, condition evaluation, sequential approvals, and action timelines behind the shared approval service. Do not add separate module-specific approval stores; switch the adapter flag when persistent backend testing begins.

## Request lifecycle safeguards

Condition joins belong to the condition they join to (the second row's `OR` joins it to the first row), and an open request must be cancelled when its order is cancelled. PO release must also re-check the stored order status because approval responses can arrive late.

**Why:** Approval requests can be evaluated in another tab or backend response, so a cancelled order must not be revived by a delayed approval. Misreading the join row changes which workflows match.

**How to apply:** Keep local and backend condition evaluation identical, allow only the requester or an authorized administrator to cancel an open request, and make release idempotent and status-aware.

## Client order PO gate

Orders created from either the NIDO platform or the client portal that match an active approval workflow must not create vendor purchase orders while the request is pending. The shared approval action completes the workflow first, then releases the order's Draft POs idempotently after the final `Approved` status. Orders with no matching workflow continue directly to Draft PO creation.

**Why:** Creating a Draft PO before client approval lets procurement work begin on an order that may still be rejected, and repeated approval actions must never duplicate POs.

**How to apply:** Keep the gate in the shared order/approval services rather than only in a page button. Both owner approvals and client-portal approvals call the same approval action path, so both release behavior and duplicate protection stay consistent. Client-scoped workflows apply only to portal-originated orders; generic NIDO workflows still apply to platform orders for a selected client.

## Operational workflow policy sign-off

The NIDO operational workflow workbook is a target design, not evidence that each flow is already implemented or business-approved. Do not hardcode its proposed 72-hour return window, 2-day acceptance window, or customer-segment mapping without sign-off. Its acceptance scenarios remain unverified until staging UAT is run.

**Why:** The workbook marks these as proposed decisions and its acceptance checklist as not run; guessing would change business and financial behavior.

**How to apply:** Keep these values configurable or leave them unset until an authorized business owner confirms them. Report unrun UAT as unverified, not passed.