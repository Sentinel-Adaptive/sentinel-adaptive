# Data sources

Sentinel Adaptive ingests DNS telemetry from two complementary sources onto the same local Kafka topic (`dns.telemetry`). They are not interchangeable, and they must not be described as the same kind of data.

## 1. Ovnicom challenge-provided DNS query logs

The Ovnicom challenge materials include BIND 9 query logs (`queries.0`, `queries.1`, …). Sentinel Adaptive replays those logs as a live Kafka stream. This is challenge-provided DNS query traffic, not claimed customer production telemetry, and not a substitute for labeled attacks.

The raw files stay on the local machine. They are not copied into Git. Point the replayer at them with `OVNICOM_DATASET_PATH` or `--path`.

Inspected source line shape:

```text
09-Sep-2026 08:04:59.901 queries: info: client @0x7fa2c438edf0 192.0.2.10#35082 (portal.example.test): query: portal.example.test IN A + (203.0.113.53)
```

### Source-derived fields (parsed from the logs)

| Contract / parser field | BIND origin | Notes |
| --- | --- | --- |
| `timestamp` | `dd-MMM-yyyy HH:mm:ss.SSS` | Naive datetime with no timezone. Stored as UTC ISO-8601. That timezone choice is an assumption, not a field present in the file. |
| `clientIp` | `client … <ip>#<port>` | IPv4 in the inspected sample. IPv6 is accepted if present. |
| `qname` | `query: <qname> …` | Includes single-label names, PTR names, and underscore SRV names. |
| `qtype` | query type token | `TYPE65` is stored as `HTTPS` and `TYPE64` as `SVCB` (RFC 9460 type codes). Other types are kept as logged (`A`, `AAAA`, `PTR`, `SRV`, …). |
| `resolverId` | trailing `(<ip>)` | Listener/resolver address from the log when present. |

Client port, query class, and BIND flag bits are present in the logs and are used only while parsing. They are not part of the Sentinel DNS event contract.

### Not present in the Ovnicom logs

The inspected files do not contain site identity, zone, latency, saturation, rcode/NXDOMAIN, or attack labels. Sentinel does not treat those values as challenge-derived.

## 2. Sentinel synthetic enrichment

Replay must satisfy the existing DNS event contract. Missing contract fields are filled locally and listed in `provenance.enrichedFields`:

| Field | Enrichment |
| --- | --- |
| `siteId` | Deterministic SHA-256 mapping from `clientIp` onto the fictional sites `PTY-BANK-01`, `PTY-HEALTH-01`, and `COL-GOV-01`. The same client IP always maps to the same site. |
| `zone` | Zone string from that fictional site profile. |
| `latencyMs` | Deterministic synthetic latency from the site profile. Not a measured resolver delay. |
| `saturation` | Synthetic site-profile value. |
| `rcode` | Always `NOERROR`. The logs do not include responses, so NXDOMAIN is never invented. |
| `scenarioTag` | `background`. This marks challenge replay, not an attack class. |
| `source` | `ovnicom-challenge` |
| `synthetic` | `false` |
| `provenance` | `originalFile` (basename only), `originalLine`, `enrichedFields` |

These enriched values are Sentinel simulation, not Ovnicom measurements.

## 3. Fully synthetic attack scenarios

The existing generator in `tools/generator` remains the source of labeled, deterministic scenarios:

- DGA
- DNS tunneling
- beaconing / possible C2
- typosquatting
- latency degradation
- saturation
- combined scenarios
- normal traffic for those fictional sites

Generator events use `source: "sentinel-synthetic"`, `synthetic: true`, generator seed/sequence metadata, and `provenance.scenario`. They are the only source of attack ground truth in this repository.

## Event provenance

Every DNS event records:

```ts
source: "ovnicom-challenge" | "sentinel-synthetic";
provenance?: {
  originalFile?: string;
  originalLine?: number;
  enrichedFields?: string[];
  scenario?: string;
};
```

Downstream detection consumes both sources through the same Kafka topic and Stage 3 feature/baseline path.

## ClickHouse persistence and QoE

Stage 4 stores validated DNS events in `sentinel.dns_events` and completed 10-second site windows in `sentinel.site_metrics`. QoE is calculated from those windows with documented weights:

```text
availability  = 1 - nxdomainRatio
latencyFactor = clamp(siteBaselineLatencyP95 / currentLatencyP95, 0, 1)
capacity      = 1 - saturation
qoeScore      = 0.45 × availability + 0.35 × latencyFactor + 0.20 × capacity
```

The score is an explainable site-experience number. It is not a detection verdict, not a measured Ovnicom SLA, and not a customer-impact claim. For challenge-replay events, `latencyMs` and `saturation` remain Sentinel synthetic enrichment, so those QoE components are synthetic as well.

## Wazuh emission

The agent appends one JSON line per correlated incident to the local file Wazuh already monitors (`infra/wazuh/runtime/events.json`). The payload matches the Stage 1 `dns_security_incident` shape. `incident_id` is the durable correlated identifier. `signal_count` is the number of member signals. `signal_id` is the highest-score member. Wazuh rule `100100` remains the decoder.

## Incident correlation

Signals on the same fictional site inside the same aligned 60-second window are merged. Raw Stage 3 objects keep `incidentId: null`; the correlator returns copies with the durable id. Mixed `demo:combined` streams can dilute individual rules, so correlation proofs use independently generated same-site DGA and beacon scenarios whose timestamps fit one window.

