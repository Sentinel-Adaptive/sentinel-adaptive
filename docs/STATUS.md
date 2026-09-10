# Build Status

## Current stage

Stage 3 — Detection, baseline, and rules complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
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

`npm run smoke:detection`

## Last verified result

The agent consumed live synthetic DNS events from `dns.telemetry`. Normal traffic did not emit high severity. DGA, tunnel, beacon, and typosquat scenarios produced typed deterministic signals with evidence. The same NXDOMAIN ratio scores as a larger deviation on `PTY-BANK-01` than on `COL-GOV-01`.

## Next exact task

Begin Stage 4 by persisting site metrics, calculating transparent QoE, and wiring those values into the provisioned Grafana dashboard.

## Known risks

- QVAC local model load and performance
- Windows Vulkan 1.4 support
- End-to-end demo timing
