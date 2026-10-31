---
name: Vendor contract page parity
description: Vendor contract details follow the client contract page's shell and in-place section editing pattern.
---

Keep the vendor contract detail view aligned with the client contract page's header, metadata bar, section-card styling, top-right download menu, and section-level edit dialogs. Both contract lists support multiple records, archive actions, and a read-only archived detail view. Contract-owned fields can be edited and saved to the vendor contract record; vendor directory details are read-only and should not display misleading edit controls.

**Why:** The user wants the vendor contract workflow to match the client contract workflow, while vendor contact/address data still belongs to the vendor directory rather than the contract record.

**How to apply:** For future contract detail changes, preserve the shared visual and interaction pattern, keep archived contract details visible but non-editable, and keep vendor-specific labels and fields. Route vendor master-data changes through vendor management, not contract edits.
