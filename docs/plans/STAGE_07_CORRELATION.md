# Stage 7 — Incident correlation

## Objective

Merge compatible Stage 3 signals into durable incidents by site and time, keep every raw signal, attach `incidentId`, emit one Wazuh JSON line per incident, and persist incidents to ClickHouse. Do not build the operator UI.

## Why this stage matters

Stages 3–6 already produce evidenced signals, optional QVAC assessments, and one Wazuh row per uncorrelated signal. The judged flow and Stage 8 UI need incidents: a stable identifier, more than one related signal when they belong together, and raw evidence that is still inspectable.

## Current repository state

Stages 0–6 are complete. `Signal.incidentId` is always `null`. Wazuh uses a provisional `INC-` value derived from `signalId` with `signal_count: 1`. ClickHouse stores DNS events and site windows only. There is no incident contract or correlator.

## Correlation policy

```text
same siteId
same 60-second aligned window
```

Those two dimensions are the merge key. Threat type and entity are recorded on the incident; they are not extra partitions. Synthetic combined scenarios do not share one DNS name across DGA, beacon, tunnel, and typosquat, so splitting on entity or type would leave the demo as four unrelated rows.

Do not merge across sites. Do not drop member signals. Detection still emits `incidentId: null`; the correlator returns copies with the durable id set.

Incident fields:

- `incidentId`: `INC-` plus 16 uppercase hex from SHA-1 of `siteId|windowStart`
- `classification` / `severity` / `confidence`: from the highest-score member signal
- `signalIds`, `types`, `affectedEntities`: complete member lists
- `summary`: short deterministic text from site, types, and lead evidence
- QVAC results, when present, are attached as a sidecar list and never replace evidence

Wazuh keeps the existing `dns_security_incident` shape. `incident_id` becomes the correlated id, `signal_count` is the member count, and `signal_id` is the lead (highest-score) signal.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_07_CORRELATION.md`
- incident contract in `packages/contracts`
- pure correlator in `packages/detection`
- agent ClickHouse incident persistence
- agent `smoke:correlation`

Modify:

- `Signal.incidentId` to allow `string | null`
- `apps/agent` consumer, Wazuh mapper, and ClickHouse schema
- `infra/clickhouse/init/002-telemetry.sql`
- `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DATA.md`, `README.md`

Do not add REST/SSE, the React UI, extra microservices, or cloud AI.

## Exact implementation tasks

- [ ] Publish this persistent stage plan
- [ ] Add the incident contract and allow `Signal.incidentId` to be set after correlation
- [ ] Implement a pure site+window correlator with unit tests, including a combined multi-type merge and a cross-site split
- [ ] Keep raw member signals and evidence
- [ ] Map correlated incidents onto the existing Wazuh JSON contract
- [ ] Persist incidents to ClickHouse without blocking Kafka on failure
- [ ] Wire correlation into `consumeDnsStream` before Wazuh emission
- [ ] Add `npm run smoke:correlation` that correlates a same-site combined scenario, writes Wazuh, and finds the incident id in the indexer
- [ ] Update STATUS/ARCHITECTURE/DATA/README; commit and push; close the stage

## Dependencies

- Stage 3 `Signal` objects
- Stage 5 Wazuh log and rule `100100`
- Stage 4 ClickHouse
- Optional Stage 6 QVAC results as sidecar input

## Risks

- Combined generator rotates sites unless `siteId` is fixed; smoke must pin one site
- Short demo windows need a 60-second correlation bucket, not a long SOC window
- Re-emitting an updated incident with the same `incident_id` may create a second Wazuh alert; emit only when an incident is first opened or `signal_count` increases
- ClickHouse updates need a table that can represent the latest member list

## Fallback strategy

- Unit-test the correlator without Kafka, Wazuh, or ClickHouse
- A single signal still becomes an incident with `signal_count: 1`
- Wazuh or ClickHouse failures are logged and must not stop Kafka
- If QVAC is missing, incidents still form from deterministic signals

## Acceptance criteria

- Compatible signals on one site in one 60-second window share one `incidentId`
- Signals on different sites do not merge
- Member signals retain evidence and gain `incidentId`
- Wazuh receives the correlated `incident_id` and `signal_count`
- ClickHouse stores the incident
- Existing generator, detection, QoE, Wazuh, and QVAC unit tests still pass
- `smoke:wazuh` still indexes a DGA path (now as a one-signal incident)

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:correlation
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 7 correlation plan`
2. `feat: add incident correlation math`
3. `feat: emit correlated incidents to wazuh`
4. `chore: complete stage 7 incident correlation`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 7 complete and names Stage 8 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None at plan creation.
