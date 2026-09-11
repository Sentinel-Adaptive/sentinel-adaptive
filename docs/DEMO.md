# Five-minute operator demonstration

This is the recording script for Stage 10. Show live local data only. If a cell is empty, say the machine has no stored row yet. Do not narrate invented scores, accuracy, or customer impact.

The five-minute clock starts after prep. First GGUF download and `infra:up` are outside the clock.

## Prep (not recorded, or cut)

```bash
npm install
cp .env.example .env
npm run infra:up
npm run health
npm run smoke:qvac
npm run demo:seed
```

If `agent:serve` is already running, stop it and start it again after `demo:seed`.

```bash
npm run agent:serve
npm run web:dev
```

Confirm:

- Operator API: `http://127.0.0.1:3001/api/system` shows `cloudInference: false`
- UI: `http://127.0.0.1:5173`

## Optional live simulation (instead of seed)

The `/simulation` page can replay the Ovnicom challenge logs, inject labeled synthetic attack scenarios, or mix both. This is useful when you want to demonstrate live-stream classification against real DNS background traffic.

Suggested settings:

- Mode: **Mixed real + attack**
- Real event limit: `10_000`
- Burst scenario: `beacon`
- Events per burst: `6`
- Inject every: `1_000` real events
- Publish interval: `0`

Then switch to `/` and watch incidents appear in real time. Incident ids will differ from the seeded ids below, so use the ids shown in the UI.

Expected seed incidents (deterministic from the demo fixtures):

| Incident | Site | QVAC |
| --- | --- | --- |
| `INC-1B41EDF624D62463` | `PTY-BANK-01` | Skipped (score ≥ 0.75) |
| `INC-1AC334C9BD19C07D` | `PTY-HEALTH-01` | Assessed (score ≈ 0.72) |

If those ids differ, use the ids the API actually returned. Do not keep reading from this table.

## Minute 0:00–0:40 — System

Open `/system`.

Say, and show:

- Tracks 03 + 04
- Cloud inference `false`
- `QVAC_LOCAL_ONLY` true
- `@qvac/sdk` / `@qvac/inference` `0.19.0`
- Model `LLAMA_3_2_1B_INST_Q4_0`
- Local Kafka / ClickHouse / Grafana / Wazuh state from this machine

Do not say the product calls a hosted model.

## Minute 0:40–1:20 — Overview QoE

Open `/`.

Show the three site rows and read the **Latest QoE** values on screen. After a successful seed those come from ClickHouse, not placeholders. `COL-GOV-01` is the degraded site in the seed; the other two are normal windows.

If a site says “No local windows”, stop and re-seed / restart the API. Do not invent a number.

## Minute 1:20–2:20 — High-confidence incident

Open `INC-1B41EDF624D62463` (or the high-confidence id from Overview).

Show:

- Classification and member evidence (DGA + beaconing)
- QVAC inference **Skipped** — deterministic score is outside the ambiguous band
- Wazuh log written / indexer lookup as the page reports it

Say that high-confidence rules do not call the model.

## Minute 2:20–4:00 — Ambiguous QVAC incident

Open `INC-1AC334C9BD19C07D` (or the ambiguous id from Overview).

Show the QVAC table as stored for this run:

- Inference status
- Classification
- Confidence (deterministic percent, plus a model token only if QVAC returned one)
- Uncertainty
- Supporting evidence metric names
- Explanation: the model’s sentence-length `rationale`

If Explanation is empty or the status is `invalid`, say that. Do not replace it with nicer copy. Assessments from `LLAMA_3_2_1B_INST_Q4_0` can vary across runs while remaining schema-valid.

## Minute 4:00–4:40 — Site and Wazuh

From the incident, open the site page. Show the stored window metrics.

Optionally open the local Wazuh event log path used by this repo (`infra/wazuh/runtime/events.json`) and point at the `incident_id` lines. Do not claim a production SOC deployment.

## Minute 4:40–5:00 — Offline proof (spoken, not re-run)

Do **not** start `npm run smoke:offline` inside the five-minute video. That command blocks public outbound internet and reloads the model.

Say that Stage 9 already proved, on this host:

```text
npm run smoke:offline
Isolation   PASS (https://example.com unreachable)
QVAC         PASS (consistent)
```

and that judged inference used the cached GGUF under `~/.qvac/models/`.

## After recording

If the video will be submitted, store it outside Git (or in the hackathon portal). Do not commit `.mp4` / `.webm` weights or a fake transcript of QVAC text from a different run.
