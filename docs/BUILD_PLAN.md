# Build Plan

Work proceeds in order. A stage is complete only when its acceptance checks pass and `docs/STATUS.md` records the verified result.

## Stage 0 — Bootstrap and compliance

- npm workspace and TypeScript toolchain
- public documentation and source skeletons
- local compliance scanner
- private development guardrails kept outside version control

## Stage 1 — Infrastructure smoke test

Prove Kafka, ClickHouse, Grafana, and Wazuh locally before building application features. Confirm a handcrafted Sentinel-shaped JSON event is processed by Wazuh.

## Stage 2 — Synthetic streaming telemetry

Define the DNS event contract and deterministic Kafka scenarios for fictional sites with deliberately different normal behavior.

## Stage 3 — Features, baseline, and rules

Implement tested feature extraction, rolling per-site baselines, deviations, deterministic rules, and evidence-bearing signal objects.

## Stage 4 — ClickHouse, QoE, and Grafana

Persist telemetry and site metrics, calculate transparent QoE, and provision the Grafana datasource and dashboard.

## Stage 5 — Wazuh integration

Send structured incident events through a local monitored JSON log and verify processing in Wazuh.

## Stage 6 — QVAC

Pin QVAC 0.19.0, load `LLAMA_3_2_1B_INST_Q4_0`, route ambiguous evidence bundles to local inference, validate output, and tolerate failures.

## Stage 7 — Incident correlation

Merge compatible signals by site, time, entity, and threat type without deleting raw evidence.

## Stage 8 — Professional UI

Build Overview, Incidents, Incident Detail, Site Detail, and System/Sovereignty views against real local API data.

## Stage 9 — Offline and compliance proof

Run automated checks and prove the judged path remains functional locally after model availability with outbound internet disabled.

## Stage 10 — Submission

Update public documentation to match reality, record a reproducible demonstration under five minutes, and verify the final repository.
