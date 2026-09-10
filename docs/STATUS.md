# Build Status

## Current stage

Stage 5 — Wazuh integration complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
- [x] Stage 3.5 — Ovnicom challenge dataset integration
- [x] Stage 4 — ClickHouse, QoE, and Grafana
- [x] Stage 5 — Wazuh integration
- [ ] Stage 6 — QVAC load-bearing inference
- [ ] Stage 7 — Incident correlation
- [ ] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:wazuh`

## Last verified result

A live synthetic DGA scenario produced an evidenced Stage 3 signal. The agent wrote a `dns_security_incident` JSON line to the monitored Wazuh log. The indexer contained `INC-F9F2BA30A2FE4245`. Signal `incidentId` remains null until Stage 7 correlation.

## Next exact task

Begin Stage 6 by pinning QVAC 0.19.0, loading `LLAMA_3_2_1B_INST_Q4_0` locally, routing only ambiguous evidenced candidates to inference, and validating model JSON.

## Known risks

- QVAC local model load and performance
- Windows Vulkan 1.4 support
- End-to-end demo timing
