# Architecture Decisions

## ADR-001 — QVAC only for ambiguous candidates

**Status:** Accepted

Rules and statistical baselines perform inexpensive screening. QVAC assesses structured evidence bundles only when deterministic confidence lies between the low and high thresholds.

This keeps local inference meaningful without requiring one model call per DNS query.

## ADR-002 — No Pears or DHT inference

**Status:** Accepted

The MVP uses local in-process QVAC inference. Provider and delegated DHT patterns removed from the QVAC 0.19.0 path are not part of the design.

## ADR-003 — White and charcoal enterprise interface

**Status:** Accepted

The interface uses an off-white canvas, charcoal typography, warm neutral borders, and a restrained Ovnicom-inspired orange accent. Semantic colors retain their operational meanings.

## ADR-004 — TypeScript npm workspaces

**Status:** Accepted

The agent, web app, shared contracts, detection package, and generator use one npm workspace so schemas and tested pure functions can be shared without additional services.
