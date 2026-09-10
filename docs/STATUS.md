# Build Status

## Current stage

Stage 2 — Synthetic streaming telemetry complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [ ] Stage 3 — Detection and baseline
- [ ] Stage 4 — ClickHouse, QoE, and Grafana
- [ ] Stage 5 — Wazuh integration
- [ ] Stage 6 — QVAC load-bearing inference
- [ ] Stage 7 — Incident correlation
- [ ] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:generator`

## Last verified result

The deterministic generator published and consumed 24 schema-validated synthetic DNS events through the local `dns.telemetry` Kafka topic. All eight scenarios are repeatable, explicitly tagged as synthetic, and cover three fictional sites with deliberately different normal profiles.

## Next exact task

Begin Stage 3 with pure entropy and domain-feature functions plus unit tests.

## Known risks

- QVAC local model load and performance
- Windows Vulkan 1.4 support
- End-to-end demo timing
