---
name: Vendor data scoping
description: Rules for keeping vendor detail views and vendor analytics tied to explicitly linked live records.
---

Vendor detail tabs use explicit vendor ID/name references as the ownership boundary. Records without a vendor reference are excluded from scoped views rather than inferred from client, location, contact, or other unrelated fields. All-vendor dashboards should likewise exclude POs that do not match a current non-archived vendor record.

**Why:** Several legacy stores contain global or demo data and do not consistently record vendor ownership. Inferring ownership can expose another vendor's data or make vendor rollups disagree with the live vendor list.

**How to apply:** Preserve optional global-page behavior, but when a selected vendor is passed to a detail tab, filter live stores strictly by vendor ID/name and show empty or zeroed states when no matching records exist. For vendor dashboards, aggregate only records linked to current vendors and refresh from store events, cross-tab storage updates, and tab focus/visibility.