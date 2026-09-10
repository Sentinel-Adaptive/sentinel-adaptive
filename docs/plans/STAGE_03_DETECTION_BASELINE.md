# Stage 3 — Detection, baseline, and rules

## Objective

Produce an evidence-bearing detection path from live synthetic DNS telemetry, with QVAC disabled:

- extract deterministic domain, temporal, DNS-outcome, and experience features
- maintain a rolling per-site baseline
- score explainable deviations
- emit structured Signal objects with evidence
- consume the existing `dns.telemetry` Kafka stream in `apps/agent`

## Why this stage matters

Stage 2 can generate repeatable synthetic attacks. Stage 3 must prove that the same NXDOMAIN ratio is interpreted differently per site, that normal traffic stays low-severity, and that DGA, tunnel, beacon, and typosquat scenarios produce inspectable signals. Later QoE, Wazuh, and QVAC stages depend on this math remaining pure and testable.

## Current repository state

Stage 2 is complete. The deterministic generator publishes schema-validated synthetic DNS events to the local `dns.telemetry` Kafka topic. Three fictional sites (`PTY-BANK-01`, `PTY-HEALTH-01`, `COL-GOV-01`) have deliberately different normal profiles.

No Stage 3 detection code exists yet:

- `packages/detection` still exports a Stage 0 placeholder
- `apps/agent` still exports a Stage 0 placeholder
- `packages/contracts` currently defines only the DNS event schema

QVAC, ClickHouse metric writes, Grafana QoE, Wazuh incident emission, and incident correlation are out of scope for this stage.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_03_DETECTION_BASELINE.md`
- Detection modules under `packages/detection/src/`: entropy, domain features, windows, periodicity, DNS outcomes, baseline, deviation, canonical domains, rules, pipeline, and focused tests
- Signal, evidence, and site-window schemas in `packages/contracts`
- Agent consumer, CLI, and live smoke under `apps/agent/src/`

Modify:

- `packages/detection/package.json` and public exports
- `apps/agent/package.json` and public exports
- root `package.json` scripts (`smoke:detection`, `agent:consume`)
- `docs/STATUS.md` and `docs/ARCHITECTURE.md` at stage close
- this plan’s checkboxes during implementation

## Exact implementation tasks

- [x] Publish this persistent stage plan before detection code
- [ ] Add Signal, evidence, and site-window contracts with tests
- [ ] Implement entropy and domain-feature functions with unit tests
- [ ] Implement rolling 10-second buckets, 45-bucket history, periodicity, NXDOMAIN ratio, and latency p50/p95
- [ ] Implement per-site rolling mean/stddev baseline and explainable deviation scores
- [ ] Prove the key test: identical current NXDOMAIN ratio yields a higher deviation on `PTY-BANK-01` than on `COL-GOV-01`
- [ ] Implement deterministic rules for beaconing, tunneling, DGA, typosquatting, and baseline deviation
- [ ] Emit Signal objects with score, severity hint, and non-empty evidence; keep `demo:normal` below high severity
- [ ] Add `processEvents` pipeline that validates DNS events and updates in-memory site windows
- [ ] Consume `dns.telemetry` from `apps/agent` with QVAC off
- [ ] Add `npm run smoke:detection` proving live consume, normal stays non-high, and attacks produce typed evidence
- [ ] Update STATUS and ARCHITECTURE; run acceptance commands; commit and push the completed stage

## Dependencies

- Stage 2 generator, `dnsEventSchema`, and local Kafka
- `zod` already pinned in contracts
- `kafkajs` already pinned in the generator; the agent uses the same version
- No QVAC packages, ClickHouse signal/metric writes, or Wazuh log emission in this stage

## Risks

- Demo windows are short; tests must inject synthetic bucket history for the NXDOMAIN key test
- Combined scenarios can fire more than one rule; Stage 3 allows multiple signals and does not correlate incidents
- KafkaJS may emit a timeout warning on current Node; agent scripts suppress that known warning
- Live smoke can race with other publishers; consume by offset snapshot like the generator smoke

## Fallback strategy

- Keep detection math pure so unit tests do not require Kafka
- Use 10-second buckets and a 45-bucket rolling window, with injected history in tests
- Evaluate rules independently; overlapping signals are acceptable
- If Kafka is down, unit tests still prove features, baseline, and rules; live smoke remains required for Done

## Acceptance criteria

With QVAC disabled:

- the live Kafka stream is consumed
- normal traffic does not emit `high` severity
- DGA, tunnel, beacon, and typosquat produce structured signals
- every signal includes evidence
- the same current NXDOMAIN value against two different site histories produces different deviation scores

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm audit --audit-level=moderate
npm run smoke:generator
npm run smoke:detection
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 3 detection baseline plan`
2. `feat: add dns feature extraction`
3. `feat: add per-site baseline deviation`
4. `feat: add deterministic detection rules`
5. `feat: consume dns stream for detection`
6. `chore: complete stage 3 detection baseline`

## Definition of Done

- this plan exists in Git and all tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 3 complete and names Stage 4 as next
- acceptance commands above pass
- the latest stable state is committed and pushed

## Unresolved items

None at plan creation.
