---
name: Dialog select positioning
description: Shared custom Select menus must escape transformed dialog content to position correctly.
---

Custom Select menus use viewport coordinates from the trigger. They must be portaled to document.body because the centered DialogContent transform changes the containing block for fixed-position descendants.

**Why:** Rendering a fixed menu inside the transformed dialog caused Role and Status menus to appear in the lower-left corner instead of under their triggers.

**How to apply:** Keep SelectContent document-level when used inside dialogs; preserve the trigger rectangle and outside-click ref behavior.