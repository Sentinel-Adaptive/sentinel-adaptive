# Build Status

## Current stage

Stage 4 — ClickHouse, QoE, and Grafana complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
- [x] Stage 3.5 — Ovnicom challenge dataset integration
- [x] Stage 4 — ClickHouse, QoE, and Grafana
- [ ] Stage 5 — Wazuh integration
- [ ] Stage 6 — QVAC load-bearing inference
- [ ] Stage 7 — Incident correlation
- [ ] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:qoe`

## Last verified result

Kafka events were persisted to ClickHouse `dns_events` and `site_metrics`. For `PTY-BANK-01`, mean QoE was 0.956 on normal traffic and 0.509 on `degrade-qoe`. The provisioned Grafana dashboard `sentinel-site-qoe` reads `sentinel.site_metrics`. Generator and detection smokes still pass.

## Next exact task

Begin Stage 5 by emitting structured incident events through the local Wazuh monitored JSON log and verifying they are processed.

## Known risks

- QVAC local model load and performance
- Windows Vulkan 1.4 support
- End-to-end demo timing
