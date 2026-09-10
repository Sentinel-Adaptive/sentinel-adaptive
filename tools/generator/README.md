# Synthetic DNS generator

The generator publishes deterministic, explicitly synthetic DNS telemetry to the local `dns.telemetry` Kafka topic. It never reads customer or production telemetry.

Fictional sites:

- `PTY-BANK-01`
- `PTY-HEALTH-01`
- `COL-GOV-01`

Each site has a deliberately different normal latency, NXDOMAIN rate, domain set, and saturation level so later per-site baselines can adapt independently.

## Scenarios

```bash
npm run demo:normal
npm run demo:beacon
npm run demo:ambiguous-beacon
npm run demo:tunnel
npm run demo:dga
npm run demo:typosquat
npm run demo:degrade-qoe
npm run demo:saturation
npm run demo:combined
```

Every command uses seed `424242` and event-time origin `2026-09-10T12:00:00.000Z` by default. The same arguments produce the same ordered event values. Kafka publication is local; `--dry-run` prints the events as NDJSON without requiring Kafka.

```bash
npm run demo:combined -- --dry-run --count 12
npm run demo:normal -- --site PTY-HEALTH-01 --seed 7 --count 50
```

Every event includes `source: "sentinel-synthetic"`, `synthetic: true`, a `scenarioTag`, deterministic generator metadata, optional `provenance.scenario`, and only fictional domains under `.test`.
