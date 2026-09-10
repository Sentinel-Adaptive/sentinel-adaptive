# Build Status

## Current stage

Stage 10 — README, video, and submission (in progress)

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
- [x] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:offline` (Administrator PowerShell)

## Last verified result

Public outbound isolation blocked `https://example.com`. Local `LLAMA_3_2_1B_INST_Q4_0` loaded from `~\.qvac\models\` and returned a schema-valid `consistent` assessment. Firewall rules were removed after the run. Compliance still pins `@qvac/sdk` and `@qvac/inference` 0.19.0 with no cloud inference path.

## Next exact task

Record the five-minute demonstration by following `docs/DEMO.md`. Do not close Stage 10 until that recording exists or the operator accepts the written walkthrough as the submitted artifact.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Mixed `demo:combined` traffic can dilute per-rule evidence; correlation smoke uses independently generated same-site attacks
- Beacon generator spacing is 15s, so a 6-event beacon crosses a 60s window
- `LLAMA_3_2_1B_INST_Q4_0` assessments can vary across runs while remaining schema-valid
- Incidents persisted before Stage 8 may lack ClickHouse member evidence until new traffic is processed
- End-to-end demo timing
- Restart `agent:serve` after `npm run demo:seed` so the UI process sees the seeded store path
