# Build Status

## Current stage

Stage 8 — Sentinel professional UI complete (demo-readiness pass)

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
- [x] Stage 3.5 — Ovnicom challenge dataset integration
- [x] Stage 4 — ClickHouse, QoE, and Grafana
- [x] Stage 5 — Wazuh integration
- [x] Stage 6 — QVAC load-bearing inference
- [x] Stage 7 — Incident correlation
- [x] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:ui`

## Last verified result

`npm run demo:seed` plus `npm run smoke:ui` populated three-site QoE windows from ClickHouse, kept high-confidence `INC-1B41EDF624D62463` on `PTY-BANK-01` as a QVAC skip, and ran live local QVAC on weak-beacon `INC-1AC334C9BD19C07D` (`PTY-HEALTH-01`, score ≈ 0.72). Wazuh emit is now derived from the event log and indexer, not only the current process memory. Overview QoE no longer disappears behind a ClickHouse `argMax` alias error.

## Next exact task

Begin Stage 9 by proving the judged path still runs locally after model availability with outbound internet disabled.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Mixed `demo:combined` traffic can dilute per-rule evidence; correlation smoke uses independently generated same-site attacks
- Beacon generator spacing is 15s, so a 6-event beacon crosses a 60s window
- `LLAMA_3_2_1B_INST_Q4_0` assessments can vary across runs while remaining schema-valid
- Incidents persisted before Stage 8 may lack ClickHouse member evidence until new traffic is processed
- End-to-end demo timing
- Restart `agent:serve` after `npm run demo:seed` so the UI process sees the seeded store path
