# Build Status

## Current stage

Stage 8 — Sentinel professional UI complete

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

Local operator API served system, overview, incidents, incident detail, and site payloads from ClickHouse plus the live store. Seeded DGA + beacon members on `PTY-BANK-01` returned as `INC-1B41EDF624D62463` with evidence rows. Vite preview returned HTTP 200 for `/`, `/incidents`, `/incidents/:id`, `/sites/PTY-BANK-01`, and `/system`. System payload pinned local QVAC 0.19.0 and `cloudInference: false`.

## Next exact task

Begin Stage 9 by proving the judged path still runs locally after model availability with outbound internet disabled.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Mixed `demo:combined` traffic can dilute per-rule evidence; correlation smoke uses independently generated same-site attacks
- Beacon generator spacing is 15s, so a 6-event beacon crosses a 60s window
- Incidents persisted before Stage 8 may lack ClickHouse member evidence until new traffic is processed
- End-to-end demo timing
