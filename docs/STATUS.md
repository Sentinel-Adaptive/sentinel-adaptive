# Build Status

## Current stage

Stage 9 — Offline and compliance proof (in progress)

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

`GET /api/overview` and `GET /api/incidents/INC-1AC334C9BD19C07D` through the restarted operator API and Vite proxy

## Last verified result

Ambiguous QVAC on `INC-1AC334C9BD19C07D` is assessed locally (`status: ok`, `cloudInference: false`). The 1B model had stuffed a lone `high` token into `rationale`; the schema now accepts optional `confidence` and requires a sentence-length `rationale`. The persisted result is `consistent` / `confidence: medium` with the model's own sentence in `rationale`. Incident Detail maps that token to Confidence and the sentence to Explanation. Overview QoE from ClickHouse is `PTY-BANK-01` 0.956, `PTY-HEALTH-01` 0.8827, `COL-GOV-01` 0.746.

## Next exact task

Publish the Stage 9 plan, prefer the cached local GGUF after first availability, and add `npm run smoke:offline` that disables outbound internet for Node/Bare and re-runs live local QVAC.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Mixed `demo:combined` traffic can dilute per-rule evidence; correlation smoke uses independently generated same-site attacks
- Beacon generator spacing is 15s, so a 6-event beacon crosses a 60s window
- `LLAMA_3_2_1B_INST_Q4_0` assessments can vary across runs while remaining schema-valid
- Incidents persisted before Stage 8 may lack ClickHouse member evidence until new traffic is processed
- End-to-end demo timing
- Restart `agent:serve` after `npm run demo:seed` so the UI process sees the seeded store path
