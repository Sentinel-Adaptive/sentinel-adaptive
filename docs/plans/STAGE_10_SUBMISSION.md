# Stage 10 — README, video, and submission

## Objective

Make the public repository match the running system, give judges a reproducible demonstration under five minutes, and verify that private guardrails, weights, and secrets stay out of Git. Do not invent detection accuracy, customer impact, or a recorded video that does not exist.

## Why this stage matters

Stages 0–9 already implement the judged path. Judges still need a README that describes what is built, a short operator walkthrough, and a clean repository. The screen recording is an operator deliverable; this stage writes the script and checks the repo so the recording can stay truthful.

## Current repository state

Stages 0–9 are complete. The README still uses “planned” language in places and does not lead with a five-minute demo. There is no `docs/DEMO.md`. The public docs otherwise describe local QVAC 0.19.0, synthetic plus challenge-log data, QoE, Wazuh, correlation, the operator UI, and the offline proof.

## Product and submission policy

- Public docs must match verified behavior. Empty or missing data stays empty; never fill with placeholder KPIs.
- Judged inference remains local `@qvac/sdk` / `@qvac/inference` 0.19.0 and `LLAMA_3_2_1B_INST_Q4_0`.
- The five-minute clock starts after infra is up, the GGUF is cached, and `demo:seed` has run. First model download is outside that clock.
- The video, if recorded, follows `docs/DEMO.md` and shows live UI/API values. Do not narrate invented scores.
- Do not commit `.local-ai/`, `.cursor/`, private build specs, `.env`, or `*.gguf`.
- Do not add cloud AI, extra microservices, or DHT/provider APIs.

## Files and components that will be created or modified

Create:

- `docs/plans/STAGE_10_SUBMISSION.md`
- `docs/DEMO.md`
- `scripts/verify-submission.mjs`

Modify:

- `README.md` to present tense and a judge-facing demo path
- `docs/STATUS.md`, `docs/PREEXISTING.md`, `docs/DATA.md` if they still describe earlier-stage intent
- root `package.json` (`npm run submission`)

Do not add a placeholder video file.

## Exact implementation tasks

- [ ] Publish this persistent stage plan
- [ ] Rewrite the README to describe the built system and link the five-minute demo
- [ ] Write `docs/DEMO.md` with prep commands and a timed operator walkthrough
- [ ] Add `npm run submission` that checks tracked files and required public docs
- [ ] Keep typecheck, lint, unit tests, and compliance passing
- [ ] Record the demonstration video by following `docs/DEMO.md` (operator)
- [ ] Update STATUS; commit and push; close the stage only after the video exists or the operator accepts the written demo as the recorded artifact

## Dependencies

- Stage 8 operator UI and `demo:seed`
- Stage 9 offline proof (`npm run smoke:offline`)
- Local infra already proven by `npm run health`

## Risks

- First GGUF download can exceed five minutes
- 1B assessments vary; the video must show that run’s actual QVAC text
- `demo:seed` must finish before recording so Overview QoE and both incidents exist
- A video recorded against a stale `agent:serve` will show empty QoE or old QVAC rows

## Fallback strategy

- If infra is down, the demo script says so and does not invent windows or incidents
- If QVAC returns `invalid`, show that status; do not substitute a nicer explanation
- If the operator has not recorded a video, leave Stage 10 open and keep `docs/DEMO.md` as the script

## Acceptance criteria

- README describes the built system in present tense and names Track 03 + 04
- `docs/DEMO.md` is a reproducible walkthrough under five minutes after prep
- `npm run submission` fails if private/secret/weight files are tracked
- No new accuracy, SLA, or customer-impact claims
- Compliance still pins QVAC 0.19.0 and forbids cloud AI

## Tests and commands that must pass

```bash
npm run typecheck
npm run lint
npm run test
npm run compliance
npm run submission
```

## Git checkpoints expected during the stage

1. `docs: add stage 10 submission plan`
2. `docs: add judge demo walkthrough and submission check`
3. `chore: complete stage 10 submission`

## Definition of Done

- this plan exists in Git and remaining tasks are checked
- unresolved items, if any, are documented below
- `docs/STATUS.md` marks Stage 10 complete
- acceptance commands above pass
- latest stable state is committed and pushed

## Unresolved items

The screen recording has not been captured yet. `docs/DEMO.md` is the script for that recording.
