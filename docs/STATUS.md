# Build Status

## Current stage

Stage 7 — Incident correlation complete

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
- [ ] Stage 8 — Sentinel professional UI
- [ ] Stage 9 — Offline and compliance proof
- [ ] Stage 10 — README, video, and submission

## Current blockers

None.

## Last verified command

`npm run smoke:correlation`

## Last verified result

Independently evidenced DGA and beaconing signals on `PTY-BANK-01` in the same 60-second window merged into incident `INC-1B41EDF624D62463` with `signal_count` 2. ClickHouse stored that count. Wazuh indexed the correlated `incident_id`. Raw detection signals kept `incidentId` null until the correlator assigned copies.

## Next exact task

Begin Stage 8 by building the professional operator UI (Overview, Incidents, Incident Detail, Site Detail, System/Sovereignty) against real local API data.

## Known risks

- First QVAC model download can take several minutes
- Windows registry file locking may require the catalog GGUF `fallbackSrc`
- Mixed `demo:combined` traffic can dilute per-rule evidence; correlation smoke uses independently generated same-site attacks
- Beacon generator spacing is 15s, so a 6-event beacon crosses a 60s window
- End-to-end demo timing
