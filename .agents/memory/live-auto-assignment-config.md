---
name: Live auto-assignment configuration
description: Operational tier rules for new orders and the separate browser-only assignment test bench.
---

Keep real-order assignment rules and their round-robin position in shared server persistence. The mock-order test bench and its history are local-only and must never advance or overwrite the live rotation.

**Why:** Client orders are assigned by the server; browser-only settings cannot control that flow, and demo activity must not change operational assignments.

**How to apply:** Any change to tier configuration must be read and saved through the operational assignment service. Keep simulations and demo history isolated from real-order assignment state.
