# Stage 8 — Sentinel professional UI

## Objective

Expose a local operator API from `apps/agent` and a presentation-only React UI in `apps/web` with Overview, Incidents, Incident Detail, Site Detail, and System/Sovereignty views. Every number on screen must come from local ClickHouse, Wazuh, or the live agent store. Do not invent detection accuracy or customer impact.

## Why this stage matters

Stages 3–7 already produce evidenced signals, QoE windows, optional QVAC assessments, and correlated incidents. Judges still cannot inspect that path in the product UI. Stage 8 is the operator surface for Track 03/04, not a new detection engine.

## Current repository state

Stages 0–7 are complete. `apps/web` is a stub (`webStage = 0`). The agent consumes Kafka, writes ClickHouse, emits Wazuh, and can run QVAC. Incidents persist without member evidence rows. There is no REST or SSE server.

## Product and API policy

- `apps/agent` owns HTTP, SSE, ClickHouse reads, and Wazuh status lookups.
- `apps/web` is presentation only: fetch, route, and render.
- Empty states must say that no local data is available. Never fill with placeholder metrics.
- Incident Detail must show member evidence, site window context when present, QVAC status, uncertainty, affected entities, and Wazuh emit/index status.
- System/Sovereignty must show local QVAC 0.19.0, `LLAMA_3_2_1B_INST_Q4_0`, `QVAC_LOCAL_ONLY`, Track 03 + 04, and live infra checks. It must not claim cloud inference exists.
- Visual system follows `docs/DESIGN_SYSTEM.md`: charcoal sidebar, off-white canvas, restrained orange accent, tables over decorative charts.

Local API (default `SENTINEL_API_PORT=3001`):

```text
GET /api/system
GET /api/overview
GET /api/incidents
GET /api/incidents/:id
GET /api/sites/:siteId
GET /api/events          SSE incident notifications
```

Persist member signals (and QVAC results when they complete) so detail views survive process restart.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_08_UI.md`
- operator API schemas in `packages/contracts`
- agent HTTP/SSE server and operator store
- Vite/React UI under `apps/web`
- `smoke:ui`

Modify:

- agent consumer to persist signals/QVAC and feed the store
- ClickHouse schema for signals and QVAC rows
- root and workspace package manifests
- `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md` if needed, `docs/PREEXISTING.md`, `README.md`

Do not add cloud AI, extra microservices, DHT/provider APIs, or Stage 9 offline proof in this stage.

## Exact implementation tasks

- [ ] Publish this persistent stage plan
- [ ] Persist member signals and QVAC results for UI reads
- [ ] Add operator API contracts and a local HTTP/SSE server in `apps/agent`
- [ ] Serve overview, incidents, incident detail, site detail, and system payloads from real local data
- [ ] Scaffold `apps/web` with Vite, React, locally bundled IBM Plex Sans, and design tokens
- [ ] Implement the five operator views against the API, including empty and error states
- [ ] Add `npm run smoke:ui` that seeds local data, queries the API, and checks the five routes
- [ ] Keep typecheck, lint, unit tests, compliance, and health passing
- [ ] Update STATUS/ARCHITECTURE/README/PREEXISTING; commit and push; close the stage

## Dependencies

- Stage 4 ClickHouse site windows and QoE
- Stage 6 QVAC sidecar results
- Stage 7 incidents and Wazuh `incident_id`
- Design tokens in `docs/DESIGN_SYSTEM.md`

## Risks

- ClickHouse may have incidents from Stage 7 without evidence rows until new traffic is processed
- QVAC is asynchronous; detail views must allow missing/invalid/unavailable assessments
- Mixing detection into `apps/web` would violate architecture
- Windows Vite/path issues; keep the UI desktop-first at 1280×720

## Fallback strategy

- Read ClickHouse when the in-memory store is empty
- If Wazuh indexer lookup fails, report emit status only, not a fake “indexed”
- If a site has no windows, show an empty site view rather than invented QoE
- Unit-test API handlers with mocked ClickHouse; live `smoke:ui` uses local infra

## Acceptance criteria

- Five named views render against the local API
- Incident Detail shows real evidence for persisted member signals
- System view documents local-only QVAC 0.19.0 and forbids implying cloud inference
- No fabricated KPIs
- Existing detection/QoE/Wazuh/QVAC/correlation unit tests still pass

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:ui
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 8 operator ui plan`
2. `feat: add operator api for incidents and sites`
3. `feat: add sentinel operator ui`
4. `chore: complete stage 8 operator ui`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 8 complete and names Stage 9 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None at plan creation.
