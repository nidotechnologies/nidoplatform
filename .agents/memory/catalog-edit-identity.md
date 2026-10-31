---
name: Catalog edit identity
description: Master catalog records may carry legacy IDs with inconsistent runtime types.
---

Master catalog edits must update in place by normalized record ID; duplicate-name checks apply to new products, not the existing record being edited.

**Why:** A record loaded from older local storage can have an ID whose runtime type differs from the route or newly built record. Strict comparison then treats the record being edited as a separate duplicate, and applying create validation during an edit can block legitimate changes.

**How to apply:** Use a normalized ID comparison for lookup and in-place update. Keep duplicate validation for creation, but let an edit replace the identified record without treating it as a new product. Mutation helpers must return an explicit success value after persistence so callers do not report a successful write as a failure.