# Stage 3.5 — Ovnicom Challenge Dataset Integration

## Objective

Replay the DNS query dataset supplied with the Ovnicom challenge as a live Kafka stream, without replacing the existing synthetic scenario generator. Both sources must feed the same `dns.telemetry` topic and Stage 3 detection path.

## Why this stage matters

The synthetic generator provides known ground truth for attacks. The challenge dataset provides BIND query-log background traffic. Combining them lets Sentinel Adaptive evaluate detection against challenge-provided DNS queries plus controlled scenarios, without claiming the challenge files are customer or production telemetry.

## Current repository state

Stages 0–3 are complete. Kafka, the synthetic generator, and QVAC-off detection already work. Stage 4 has not started.

Local inspection of the challenge dataset (not committed) found 36 BIND query-log files named `queries.0` through `queries.35`, about 20 MiB each, plus macOS metadata. A sampled file contained on the order of 125,000 lines. The inspected line format is BIND 9 query logging, for example:

```text
09-Sep-2026 08:04:59.901 queries: info: client @0x7fa2c438edf0 190.102.59.241#35082 (www.apple.com): query: www.apple.com IN A + (172.19.1.2)
```

### Source-derived fields actually present

- timestamp (naive BIND datetime, no timezone)
- client IPv4
- client UDP/TCP port (logged, not required by the Sentinel DNS contract)
- qname
- class (`IN`)
- qtype (`A`, `AAAA`, `PTR`, `TYPE65`, `SRV`, and others)
- query flags (recursion/EDNS bits)
- listener/resolver IPv4 in the trailing parentheses

### Not present in the source logs

- siteId, zone
- latencyMs, saturation
- rcode / NXDOMAIN
- scenario / attack labels
- timezone offset

Do not treat enriched values as Ovnicom-derived.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_03_5_OVNICOM_DATASET.md`
- `docs/DATA.md`
- `tools/ovnicom-replay/` streaming parser, enricher, Kafka publisher, tests, and BIND-format fixtures
- root scripts `ovnicom:replay` and `smoke:ovnicom`

Modify:

- `packages/contracts` DNS event provenance (`source`, optional `provenance`)
- `tools/generator` to set `source: "sentinel-synthetic"`
- `.gitignore` and `.env.example`
- `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/BUILD_PLAN.md`, `README.md`

Do not copy or commit raw `queries.*` files.

## Exact implementation tasks

- [x] Inspect the actual challenge files and record source-derived fields
- [ ] Publish this persistent stage plan
- [ ] Extend the DNS event contract with provenance without breaking Stage 2/3 events
- [ ] Stream BIND logs line-by-line, skip malformed lines, and count failures
- [ ] Enrich missing contract fields and list them in `provenance.enrichedFields`
- [ ] Publish replayed events to the existing Kafka topic
- [ ] Add unit tests for parse, provenance, site mapping, and pipeline compatibility
- [ ] Run a limited live integration (5,000–25,000 records) plus one synthetic attack
- [ ] Update DATA, README, STATUS, and ARCHITECTURE
- [ ] Confirm raw dataset paths are gitignored and untracked
- [ ] Commit and push stable checkpoints, then close the stage

## Dependencies

- Stage 2 generator and `dns.telemetry`
- Stage 3 `processEvents` / DetectionEngine
- Local Kafka
- A machine-local dataset path via `OVNICOM_DATASET_PATH` or `--path` (never hardcoded)

## Risks

- BIND qtypes such as `TYPE65` and `PTR` are outside the previous five-type enum
- Some qnames are single-label or otherwise looser than the current regex
- Naive timestamps have no timezone
- The dataset is hundreds of megabytes; loading it fully would exhaust memory
- Challenge domains must not be described as customer production data

## Fallback strategy

- Stream with `readline`; never `readFile` the full log
- Map `TYPE65`→`HTTPS` and `TYPE64`→`SVCB` as BIND type-code names, documented as normalization
- Default missing rcode to `NOERROR` and mark it enriched (do not invent NXDOMAIN)
- Skip unparsable lines and report counts
- Keep the synthetic generator unchanged in behavior aside from provenance fields

## Acceptance criteria

- Actual files inspected and fields documented
- Streaming parser does not load the full dataset
- Provenance and explicit enrichment are present
- Replay publishes to Kafka and Stage 3 accepts replayed events
- Existing synthetic attacks still work
- New and existing tests pass; compliance passes
- Raw dataset is not tracked by Git
- STATUS/DATA/README updated

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:generator
npm run smoke:detection
npm run smoke:ovnicom
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 3.5 ovnicom dataset plan`
2. `feat: add dns event provenance`
3. `feat: replay ovnicom bind query logs`
4. `chore: complete stage 3.5 ovnicom dataset integration`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 3.5 complete and names Stage 4 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None at plan creation.
