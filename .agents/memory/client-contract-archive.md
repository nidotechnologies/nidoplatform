---
name: Client contract archive behavior
description: Archive and read-only semantics for client contract records.
---

Archived client contracts remain available in the archived list and open as read-only details. Do not physically delete or silently edit archived records; active contracts remain editable.

**Why:** The user explicitly requested retained contract details with a read-only view for archived records.

**How to apply:** Keep archive status on each client contract record, route archived IDs to the existing detail view with editing disabled, and keep active and archived list actions distinct.
