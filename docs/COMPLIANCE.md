# Hackathon Compliance

## Tracks

Sentinel Adaptive targets exactly:

- Track 03 — Sovereign Intelligence at the Edge
- Track 04 — Ovnicom Sentinel-DNS

## Local inference

All judged AI inference must run locally through:

```text
@qvac/sdk 0.19.0
@qvac/inference 0.19.0
LLAMA_3_2_1B_INST_Q4_0
Quantization: Q4_0
```

The application must not contain a cloud inference provider, remote inference endpoint, or cloud fallback. QVAC 0.19.0 delegated DHT/provider patterns are outside scope.

## Data

Only repository-generated synthetic telemetry and appropriately licensed, documented public data may be used. Real customer DNS telemetry is prohibited.

## Evidence and claims

- Deterministic signals must retain inspectable evidence.
- QVAC may reference only supplied evidence and must use cautious classifications.
- Model output must be schema-validated.
- No hidden chain-of-thought is stored.
- No detection accuracy, performance, customer impact, or deployment claim may be invented.

## Automated check

Run:

```bash
npm run compliance
```

Stage 0 checks executable configuration and package manifests for prohibited cloud-AI dependencies, credentials, and inference endpoints. Stage 6 requires `@qvac/sdk` and `@qvac/inference` to be pinned exactly to `0.19.0`. Stage 9 adds `npm run smoke:offline` to prove local inference after the GGUF is cached and outbound internet is disabled.

## Current status

`npm run compliance` requires `@qvac/sdk` and `@qvac/inference` 0.19.0. Judged inference loads `LLAMA_3_2_1B_INST_Q4_0` in-process. Invalid or unavailable QVAC output does not stop Kafka consumption. DHT/provider APIs remain forbidden. After the catalog GGUF is on disk, `fallbackSrc` is that local file. `npm run smoke:offline` blocks public outbound internet, then re-runs a live local assessment.
