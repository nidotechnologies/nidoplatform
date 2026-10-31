---
name: Catalog bulk-import classification
description: The invariant for reliable master-catalog CSV imports and user-facing result reporting.
---

Master Catalog bulk imports must preflight normalized product names against both the stored catalog and rows already accepted from the same file. Result notifications must report imported, duplicate, and invalid rows independently; never use an “all duplicates” message merely because no row was saved.

**Why:** a mixed file can contain valid new products alongside existing or repeated names, and save-level booleans alone can misclassify the whole upload.

**How to apply:** keep duplicate detection case/whitespace insensitive, reserve generated product codes for rows that pass duplicate checks, and show a success plus separate warnings when an upload is mixed.