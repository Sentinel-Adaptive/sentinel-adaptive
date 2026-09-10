# Stage 4 — ClickHouse, QoE, and Grafana

## Objective

Persist DNS telemetry and per-site window metrics, calculate a transparent QoE score from those metrics, and show the values on a provisioned Grafana dashboard. Detection math stays in `packages/detection`. ClickHouse I/O stays in `apps/agent`.

## Why this stage matters

Stage 3 already produces inspectable site windows. Operators still cannot see those windows after the process exits, and there is no documented experience score. Stage 4 stores the same windows ClickHouse-side and turns latency, NXDOMAIN ratio, and saturation into an explainable QoE number. Wazuh, QVAC, correlation, and the React UI remain later stages.

## Current repository state

Stages 0–3.5 are complete. Kafka, the synthetic generator, Ovnicom replay, and QVAC-off detection work. ClickHouse and Grafana are already healthy from Stage 1, with only the `infra_smoke` table and smoke dashboard.

## QoE formula

QoE is a site-window score in `[0, 1]`. Higher is better. It is not a detection score and not a claim about customer impact.

```text
availability    = 1 - nxdomainRatio
latencyFactor   = clamp(baselineLatencyP95 / max(currentLatencyP95, ε), 0, 1)
                  or 1 when the site has no baseline history yet
capacity        = 1 - saturation

qoeScore        = 0.45 * availability
                + 0.35 * latencyFactor
                + 0.20 * capacity
```

`baselineLatencyP95` is this site's rolling mean of completed `latencyP95` buckets, the same baseline family Stage 3 already uses. Latency better than the site baseline is capped at `1`. The three weights are product constants and must be stored with every score so Grafana can show the recipe, not just the result.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_04_CLICKHOUSE_QOE.md`
- `packages/detection/src/qoe.ts` and tests
- `infra/clickhouse/init/002-telemetry.sql`
- `apps/agent/src/clickhouse.ts` schema + JSONEachRow writer
- `infra/grafana/dashboards/site-qoe.json`
- agent QoE smoke

Modify:

- `packages/contracts` QoE schema
- `packages/detection` pipeline to expose completed site windows
- `apps/agent` consumer to persist events and metrics
- root scripts `smoke:qoe`
- `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DATA.md`, `README.md`

Do not add QVAC, Wazuh emission, incident correlation, or the operator UI.

## Exact implementation tasks

- [ ] Publish this persistent stage plan
- [ ] Add the QoE contract and pure `calculateQoe` function with tests
- [ ] Prove `demo:degrade-qoe` scores lower than `demo:normal` for the same fictional site
- [ ] Add ClickHouse tables `dns_events` and `site_metrics` (init SQL plus runtime `CREATE IF NOT EXISTS`)
- [ ] Persist validated DNS events and completed site windows from the agent
- [ ] Store QoE components and weights with each site-metric row
- [ ] Provision a Grafana dashboard against `site_metrics`
- [ ] Add `npm run smoke:qoe` covering persist, query, QoE drop, and dashboard presence
- [ ] Keep existing generator, detection, Ovnicom, health, and infra smokes passing
- [ ] Update STATUS/ARCHITECTURE/DATA/README; commit and push checkpoints; close the stage

## Dependencies

- Stage 3 `SiteWindowMetrics`, `computeBaseline`, and `DetectionEngine`
- Local ClickHouse `26.8.2.7` and Grafana `13.2.1` with the pinned ClickHouse plugin
- Existing `CLICKHOUSE_*` and `GRAFANA_*` environment values
- No new cloud services and no extra microservice

## Risks

- ClickHouse init scripts do not rerun on an existing Docker volume; the agent must apply schema at runtime
- Synthetic event-time is `2026-09-10T12:00:00.000Z`, so Grafana `now-1h` can hide rows; the latest-values panels must not depend on that default window
- Challenge-replay `saturation` and `latencyMs` are synthetic enrichment; QoE must not be described as a measured Ovnicom SLA
- ClickHouse unavailability must not crash Kafka consumption

## Fallback strategy

- Keep QoE pure so unit tests do not need ClickHouse
- Use HTTP JSONEachRow, matching the Stage 1 smoke, instead of adding a new client library
- Continue consuming Kafka if a ClickHouse write fails, and record the error
- Verify Grafana by API dashboard JSON, and verify numbers by ClickHouse SELECT

## Acceptance criteria

- DNS events and site-window metrics are persisted in ClickHouse
- QoE is calculated with the documented weights and component breakdown
- The same site scores lower QoE under `degrade-qoe` than under `normal`
- Grafana has a provisioned dashboard reading `sentinel.site_metrics`
- Existing Stage 2, 3, and 3.5 tests and smokes still pass
- Compliance still passes
- No customer or production QoE claims

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:generator
npm run smoke:detection
npm run smoke:qoe
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 4 clickhouse qoe plan`
2. `feat: add transparent site qoe score`
3. `feat: persist dns metrics to clickhouse`
4. `feat: add grafana site qoe dashboard`
5. `chore: complete stage 4 clickhouse qoe`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 4 complete and names Stage 5 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None at plan creation.
