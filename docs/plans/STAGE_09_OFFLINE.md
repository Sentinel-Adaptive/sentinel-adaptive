# Stage 9 — Offline and compliance proof

## Objective

Prove that judged inference stays local after the `LLAMA_3_2_1B_INST_Q4_0` GGUF is already on disk: `npm run compliance` still forbids cloud AI, and a live QVAC assessment still returns schema-valid JSON while outbound internet is disabled.

## Why this stage matters

Stages 6–8 already run `@qvac/sdk` 0.19.0 in-process. Track 03 still needs an executable proof that the judged path does not depend on a remote model host once weights exist locally. The first download may use the catalog GGUF `fallbackSrc`. After that, completion must work from the cached file.

## Current repository state

Stages 0–8 are complete. `npm run compliance` pins QVAC 0.19.0 and scans for cloud providers, credentials, endpoints, and DHT/provider APIs. `loadModel` still passes a Hugging Face `fallbackSrc` because the Windows registry lock can fail. Weights already live under the SDK cache (`~/.qvac/models/`), which is gitignored.

## Product and proof policy

- Do not add a cloud inference path, cloud fallback, or DHT/provider API.
- Do not invent assessments, QoE, or accuracy claims.
- First-run download of checksum-validated catalog weights is not judged inference.
- After the GGUF is local, `fallbackSrc` must be that file, not an HTTPS URL.
- `npm run smoke:offline` must:
  1. fail if the local GGUF is missing (tell the operator to run `npm run smoke:qvac` once online);
  2. disable public outbound internet (loopback and RFC1918 stay reachable);
  3. prove a public HTTPS fetch fails;
  4. load the permitted model and assess one ambiguous evidence bundle;
  5. restore outbound rules even if the assessment fails.
- Unit tests stay offline and must not load the GGUF.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_09_OFFLINE.md`
- `apps/agent/src/qvac-source.ts` local GGUF resolver
- `apps/agent/src/offline-smoke.ts`
- `scripts/windows-offline-net.ps1`
- `scripts/smoke-offline.mjs`

Modify:

- `apps/agent/src/qvac.ts` to prefer the cached GGUF
- root and agent `package.json` scripts
- `docs/STATUS.md`, `docs/COMPLIANCE.md`, `docs/ARCHITECTURE.md`, `README.md`, `docs/PREEXISTING.md` if needed
- `.env.example` optional `QVAC_MODEL_PATH`

Do not add extra microservices, a new UI, or Stage 10 submission assets.

## Exact implementation tasks

- [x] Publish this persistent stage plan
- [x] Resolve cached `LLAMA_3_2_1B_INST_Q4_0` GGUF and use it as `fallbackSrc` when present
- [x] Add `npm run smoke:offline` that isolates outbound internet and runs live local QVAC
- [x] Keep typecheck, lint, unit tests, compliance, and health passing
- [x] Update STATUS/ARCHITECTURE/COMPLIANCE/README; commit and push; close the stage

## Dependencies

- Stage 6 local QVAC load + schema validation
- A previously cached GGUF from `smoke:qvac` or demo seed
- Windows Firewall (Administrator) on this host

## Risks

- Outbound isolation needs Administrator rights
- Public-outbound block rules affect every process until they are removed
- 1B Q4_0 JSON can still be `invalid`; the smoke requires a validated assessment
- A crash before teardown could leave the firewall rules in place

## Fallback strategy

- If the GGUF is missing, fail closed with an online-once instruction
- If firewall add is denied, fail closed rather than pretend the host is offline
- `finally` always removes the Stage 9 firewall rules
- Unit tests inject a temp cache directory and never call `loadModel`

## Acceptance criteria

- Cached GGUF is preferred over the Hugging Face URL
- `SENTINEL_OFFLINE=true` refuses to start judged inference without a local GGUF
- `npm run smoke:offline` proves a public HTTPS fetch fails, then a live local assessment succeeds
- Compliance still pins QVAC 0.19.0 and still forbids cloud AI
- No new cloud dependency or remote inference endpoint

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:offline
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 9 offline plan`
2. `feat: prove qvac still runs with outbound internet disabled`
3. `chore: complete stage 9 offline proof`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 9 complete and names Stage 10 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

None. Program-only Node/Bare block rules were not sufficient on this host; the passing proof uses public IPv4/IPv6 outbound block rules and restores them after the run.
