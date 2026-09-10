# Stage 6 — QVAC load-bearing inference

## Objective

Pin `@qvac/sdk` and `@qvac/inference` to `0.19.0`, load `LLAMA_3_2_1B_INST_Q4_0` in-process, send only ambiguous evidenced candidates to local inference, schema-validate the JSON, and keep Kafka/detection running if the model fails.

## Why this stage matters

Stages 3–5 already produce deterministic signals and can emit them to Wazuh. Track 03 requires judged inference to run locally through QVAC. QVAC must interpret supplied evidence for mid-confidence signals only. It must not run once per DNS query, invent reputation or malware families, or become a cloud fallback.

## Current repository state

Stages 0–6 are complete. `@qvac/sdk` and `@qvac/inference` are pinned to `0.19.0`. Ambiguous evidenced signals are assessed locally; high-confidence signals skip QVAC.

## Routing policy

Reuse the Stage 3 emit and severity thresholds:

```text
score < 0.60          no signal (already true in rules)
0.60 ≤ score < 0.75   ambiguous → QVAC
score ≥ 0.75          high-confidence → skip QVAC
```

QVAC receives a structured evidence bundle (`siteId`, `type`, `score`, `severityHint`, evidence rows). It does not receive raw query streams, and it is not given tools, MCP, web search, or DHT/provider APIs.

Expected model JSON:

```json
{
  "assessment": "consistent" | "uncertain" | "insufficient_evidence",
  "rationale": "short explanation using only supplied evidence",
  "usedEvidence": ["metric", "..."]
}
```

Invalid JSON, schema failures, missing models, and runtime errors become `status: "invalid"` or `status: "unavailable"`. They must not throw out of the consumer. Thinking/chain-of-thought is discarded and not stored. The original deterministic signal is unchanged (`source: "deterministic"`, `incidentId: null`).

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_06_QVAC.md`
- QVAC assessment contract
- pure ambiguous-routing helper in `packages/detection`
- `apps/agent/src/qvac.ts` local loader and assessor
- agent `smoke:qvac`

Modify:

- `apps/agent/package.json` exact pins `@qvac/sdk` and `@qvac/inference` `0.19.0`
- `apps/agent` consumer to assess newly seen ambiguous signals
- `scripts/verify-compliance.mjs` to require the pins
- `docs/COMPLIANCE.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `README.md`

Do not add cloud providers, `startQVACProvider`, `.delegate(`, incident correlation, or the React UI.

## Exact implementation tasks

- [x] Publish this persistent stage plan
- [x] Add the QVAC JSON contract and ambiguous-score router with unit tests
- [x] Pin `@qvac/sdk` and `@qvac/inference` to `0.19.0` on the agent
- [x] Load `LLAMA_3_2_1B_INST_Q4_0` locally and complete from an evidence-only prompt
- [x] Validate output; treat invalid/unavailable as non-fatal
- [x] Skip QVAC for high-confidence signals
- [x] Wire assessment into `consumeDnsStream` without blocking Kafka on failure
- [x] Require the QVAC pins in `npm run compliance`
- [x] Add `npm run smoke:qvac` that loads the local model, assesses one ambiguous bundle, and proves a high-confidence skip
- [x] Update STATUS/ARCHITECTURE/COMPLIANCE/README; commit and push; close the stage

## Dependencies

- Stage 3 `Signal` + evidence
- Local disk/cache for the GGUF (gitignored `.qvac/`, `models/`, `*.gguf`)
- No extra microservice

## Risks

- First `loadModel` may download the GGUF and take minutes
- Windows Vulkan 1.4 / GPU probe issues; CPU inference must still be acceptable
- 1B Q4_0 JSON may be messy; extraction + Zod must fail closed
- Native `@qvac/inference` addon install on Windows

## Fallback strategy

- Inject a mock QVAC runtime in unit tests so CI does not need the GGUF
- Parse the first JSON object from the completion; if Zod fails, mark `invalid`
- If `loadModel`/`completion` throws, mark `unavailable` and continue
- Do not call QVAC when `QVAC_LOCAL_ONLY` is not true
- If the QVAC registry cannot lock/download on Windows, use the catalog model's checksum-validated GGUF `fallbackSrc`
- Constrain `usedEvidence` to the supplied metric names in the JSON schema

## Acceptance criteria

- `@qvac/sdk` and `@qvac/inference` are pinned to `0.19.0`
- The local `LLAMA_3_2_1B_INST_Q4_0` model can be loaded
- Only ambiguous evidenced signals are sent to QVAC
- Valid output matches the assessment schema
- Invalid or missing QVAC does not crash detection
- High-confidence signals skip inference
- Compliance requires the pins and still forbids cloud AI and DHT provider APIs
- Existing generator, detection, QoE, and Wazuh smokes still pass

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run smoke:qvac
npm run health
```

## Git checkpoints expected during the stage

1. `docs: add stage 6 qvac plan`
2. `feat: add qvac assessment routing`
3. `feat: load local qvac for ambiguous signals`
4. `chore: complete stage 6 qvac inference`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 6 complete and names Stage 7 as next
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

On this Windows host the QVAC registry download failed with `File descriptor could not be locked`. `loadModel` uses the catalog `LLAMA_3_2_1B_INST_Q4_0` GGUF `fallbackSrc`, checksum-validated by the SDK. Inference is forced to CPU (`gpu_layers: 0`). Neither is a cloud inference path.
