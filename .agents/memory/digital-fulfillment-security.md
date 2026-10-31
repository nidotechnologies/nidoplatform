---
name: Digital fulfillment security boundary
description: Authorization and checkout guarantees for the digital fulfillment backend
---

Digital fulfillment endpoints must authorize from a server-authenticated principal, never from browser-supplied identity headers. The current localStorage login can only use an explicitly development-only header bridge; production must fail closed until server auth is connected.

**Why:** Browser storage and request headers are user-controlled, so accepting them in production would allow cross-client fulfillment access and internal actions.

**How to apply:** Keep the fulfillment API's server-principal adapter as the authorization boundary. When adding real auth, populate `req.authenticatedUser` (or the documented equivalent) and remove reliance on local identity claims; keep fulfillment creation ahead of local checkout commit so failures cannot silently create incomplete digital orders.