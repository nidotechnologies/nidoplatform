---
name: Prefix configuration behavior
description: Rules for centralized document and entity prefix changes across generated identifiers
---

# Prefix configuration behavior

New document and entity identifiers must read their prefix from the General Settings prefix map at creation time. Vendor credits are a distinct document type from customer credit notes and therefore use their own configurable prefix.

**Why:** Prefix changes are intended to affect newly generated records without renumbering or breaking links to existing records. Sub-order IDs also need to be snapshotted when an order is created so later prefix changes cannot change their identity.

**How to apply:** Add new identifier types to the built-in prefix map, use `getPrefix()` in generators and creation forms, and preserve old stored values. For derived order identifiers, persist the generated value with the order rather than rebuilding it from the current setting during display.