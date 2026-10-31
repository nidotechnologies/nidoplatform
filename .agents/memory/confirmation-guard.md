---
name: Confirmation guard dialogs
description: The global mutation confirmation guard must not intercept its own confirmation controls.
---

Confirmation dialogs rendered by the global action guard must mark their confirm action as exempt from the guard.

**Why:** The guard listens to document clicks and classifies buttons by label. A confirm button labeled “Save” can otherwise open a second confirmation instead of resuming the original mutation.

**How to apply:** Add the guard’s skip attribute to internal confirmation controls; do not bypass confirmation on the original save/delete action.