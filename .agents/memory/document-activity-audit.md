---
name: Document activity audit
description: Successful document uploads and downloads should appear in the matching order or PO Notes feed.
---

Successful document uploads and downloads from Order Details or PO Details must create an activity entry in that page's Notes feed, alongside status changes.

**Why:** The user asked for file actions to be traceable in the notes below the document sections, just like status updates.

**How to apply:** Log the filename and document type with the acting user and timestamp only after an upload is saved or a download is triggered. Store PO activity on the PO and order activity in the order's note feed.
