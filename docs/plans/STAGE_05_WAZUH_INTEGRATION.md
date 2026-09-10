# Stage 5 — Wazuh Integration

## Objective

Emit structured Sentinel incident events from live detection signals onto the JSON log Wazuh already monitors, then verify Wazuh indexes them. Do not implement incident correlation, QVAC, or the operator UI.

## Why this stage matters

Stage 1 proved that a handcrafted `dns_security_incident` JSON line is decoded by local Wazuh rule `100100`. Stage 3 produces evidenced signals, but nothing in the product path writes those signals to Wazuh. Stage 5 closes that gap so a deterministic DGA/beacon/tunnel/typosquat signal becomes a Wazuh alert. Merging multiple signals into one incident remains Stage 7.

## Current repository state

Stages 0–4 are complete. Wazuh 4.14.7 is healthy. The manager tails `/var/log/sentinel/events.json` (host path `infra/wazuh/runtime/events.json`). The Stage 1 fixture shape is:

```json
{
  "source": "sentinel-adaptive",
  "event_type": "dns_security_incident",
  "incident_id": "INC-STAGE1-SMOKE",
  "site_id": "PTY-BANK-01",
  "classification": "possible_c2_beaconing",
  "severity": "high",
  "confidence": 0.87,
  "signal_count": 3,
  "summary": "..."
}
```

Stage 3 `Signal.incidentId` stays `null` until correlation exists.

## Emission policy

- Map each newly observed Stage 3 signal to one Wazuh JSON line.
- Keep `signal_count: 1` and a provisional `incident_id` derived from `signalId`.
- Do not claim those rows are correlated incidents.
- Classification mapping is explicit:
  - `beaconing` → `possible_c2_beaconing`
  - `tunneling` → `possible_dns_tunneling`
  - `dga` → `possible_dga`
  - `typosquatting` → `possible_typosquatting`
  - `baseline_deviation` → `baseline_deviation`
- Kafka consumption and ClickHouse writes must continue if the Wazuh log write fails.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_05_WAZUH_INTEGRATION.md`
- Wazuh incident contract in `packages/contracts`
- `apps/agent/src/wazuh.ts` mapper and JSONL appender
- agent `smoke:wazuh`

Modify:

- `apps/agent` consumer to emit new signals
- root `package.json` script `smoke:wazuh`
- `.env.example` optional `WAZUH_EVENT_LOG`
- `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DATA.md`, `README.md`

Do not add QVAC, correlator logic, extra microservices, or a new Wazuh stack.

## Exact implementation tasks

- [ ] Publish this persistent stage plan
- [ ] Add a Wazuh incident event schema matching the monitored JSON fields
- [ ] Map Stage 3 signals onto that schema without changing detection math
- [ ] Append JSON lines to the existing monitored log
- [ ] Wire emission into `consumeDnsStream` for newly seen signals
- [ ] Add unit tests for mapping, provenance of `incident_id`, and JSONL writes
- [ ] Add `npm run smoke:wazuh` that generates a DGA (or equivalent) signal, writes the log, and finds the alert in the Wazuh indexer
- [ ] Keep generator, detection, QoE, health, and compliance checks passing
- [ ] Update STATUS/ARCHITECTURE/DATA/README; commit and push; close the stage

## Dependencies

- Stage 1 Wazuh localfile + rule `100100`
- Stage 3 `Signal` objects
- Host file `infra/wazuh/runtime/events.json` (gitignored)

## Risks

- Wazuh indexing can take tens of seconds; smoke must poll like Stage 1
- Extra JSON fields are acceptable to the JSON decoder, but required fixture fields must remain present
- Provisional `incident_id` values must not be described as correlated incident identifiers
- File append on Windows must use JSONL and not rewrite the log

## Fallback strategy

- Reuse the Stage 1 indexer search on `data.incident_id`
- Keep mapping and file I/O out of `packages/detection`
- If Wazuh is down, unit tests still prove mapping and log format; live smoke remains required for Done

## Acceptance criteria

- A live synthetic attack produces a Stage 3 signal
- That signal is written as `dns_security_incident` JSON to the monitored log
- Wazuh rule `100100` fires and the indexer contains the `incident_id`
- Detection math is unchanged
- Existing smokes still pass
- Compliance passes
- No customer or production Wazuh claims

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:generator
npm run smoke:detection
npm run smoke:wazuh
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 5 wazuh integration plan`
2. `feat: emit detection signals to wazuh`
3. `chore: complete stage 5 wazuh integration`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 5 complete and names Stage 6 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None at plan creation.
