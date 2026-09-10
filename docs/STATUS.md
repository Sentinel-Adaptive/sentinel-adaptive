# Build Status

## Current stage

Stage 3.5 — Ovnicom challenge dataset integration complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
- [x] Stage 3.5 — Ovnicom challenge dataset integration
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

`npm run smoke:ovnicom`

## Last verified result

The streaming replayer parsed 10,000 BIND query records from the local Ovnicom challenge dataset, published them to `dns.telemetry`, and the Stage 3 engine consumed them. Nine malformed lines were skipped. A subsequent synthetic DGA burst on the same topic still produced an evidenced DGA signal. Existing generator and detection smokes continue to pass.

## Next exact task

Begin Stage 4 by persisting site metrics, calculating transparent QoE, and wiring those values into the provisioned Grafana dashboard.

## Known risks

- QVAC local model load and performance
- Windows Vulkan 1.4 support
- End-to-end demo timing
