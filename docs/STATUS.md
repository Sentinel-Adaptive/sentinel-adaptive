# Build Status

## Current stage

Stage 6 — QVAC load-bearing inference complete

## Overall

- [x] Stage 0 — Bootstrap and compliance
- [x] Stage 1 — Infrastructure smoke test
- [x] Stage 2 — Synthetic stream
- [x] Stage 3 — Detection and baseline
- [x] Stage 3.5 — Ovnicom challenge dataset integration
- [x] Stage 4 — ClickHouse, QoE, and Grafana
- [x] Stage 5 — Wazuh integration
- [x] Stage 6 — QVAC load-bearing inference
- [ ] Stage 7 — Incident correlation
- [ ] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:qvac`

## Last verified result

Local `@qvac/sdk` 0.19.0 loaded `LLAMA_3_2_1B_INST_Q4_0`. A handcrafted ambiguous signal (score 0.68) produced a schema-valid `insufficient_evidence` assessment. A high-confidence DGA signal was skipped. Invalid JSON and a missing-model path returned `invalid` / `unavailable` without throwing. Deterministic `source` and `incidentId: null` were unchanged.

## Next exact task

Begin Stage 7 by correlating compatible signals into incidents without deleting raw evidence, and attach a durable `incidentId` for Wazuh and later UI use.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Windows Vulkan 1.4 / GPU probe issues; CPU inference is used (`gpu_layers: 0`)
- End-to-end demo timing
