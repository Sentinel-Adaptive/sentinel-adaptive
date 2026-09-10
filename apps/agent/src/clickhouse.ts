import type {
  DnsEvent,
  Incident,
  SiteQoe,
  SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";
import { qoeForWindows } from "@sentinel-adaptive/detection";

export const defaultClickHouseUrl = "http://localhost:8123";
export const defaultClickHouseDatabase = "sentinel";

const telemetrySchemaStatements = [
  `CREATE TABLE IF NOT EXISTS dns_events
(
    timestamp DateTime64(3, 'UTC'),
    site_id LowCardinality(String),
    zone String,
    client_ip String,
    qname String,
    qtype LowCardinality(String),
    rcode LowCardinality(String),
    latency_ms Float64,
    resolver_id String,
    scenario_tag LowCardinality(String),
    source LowCardinality(String),
    synthetic UInt8,
    saturation Float64
)
ENGINE = MergeTree
ORDER BY (site_id, timestamp)`,
  `CREATE TABLE IF NOT EXISTS site_metrics
(
    bucket_start DateTime64(3, 'UTC'),
    site_id LowCardinality(String),
    query_count UInt64,
    nxdomain_count UInt64,
    nxdomain_ratio Float64,
    latency_median Float64,
    latency_p95 Float64,
    unique_domains UInt64,
    mean_entropy Float64,
    periodicity_score Float64,
    saturation Float64,
    qoe_score Float64,
    qoe_availability Float64,
    qoe_latency_factor Float64,
    qoe_capacity Float64,
    qoe_weight_availability Float64,
    qoe_weight_latency Float64,
    qoe_weight_capacity Float64,
    qoe_explanation String
)
ENGINE = MergeTree
ORDER BY (site_id, bucket_start)`,
  `CREATE TABLE IF NOT EXISTS incidents
(
    incident_id String,
    window_start DateTime64(3, 'UTC'),
    timestamp DateTime64(3, 'UTC'),
    site_id LowCardinality(String),
    classification LowCardinality(String),
    severity LowCardinality(String),
    confidence Float64,
    signal_count UInt32,
    signal_ids Array(String),
    types Array(String),
    affected_entities Array(String),
    summary String
)
ENGINE = ReplacingMergeTree(timestamp)
ORDER BY (site_id, incident_id)`,
];

export interface ClickHouseSettings {
  readonly url?: string;
  readonly database?: string;
  readonly user?: string;
  readonly password?: string;
}

function settings(overrides: ClickHouseSettings = {}): Required<ClickHouseSettings> {
  return {
    url: overrides.url ?? process.env.CLICKHOUSE_URL ?? defaultClickHouseUrl,
    database:
      overrides.database ??
      process.env.CLICKHOUSE_DATABASE ??
      defaultClickHouseDatabase,
    user: overrides.user ?? process.env.CLICKHOUSE_USER ?? "sentinel",
    password:
      overrides.password ?? process.env.CLICKHOUSE_PASSWORD ?? "sentinel-local",
  };
}

export function toClickHouseDateTime(iso: string): string {
  const milliseconds = Date.parse(iso);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return new Date(milliseconds).toISOString().replace("T", " ").replace("Z", "");
}

export async function clickHouseQuery(
  query: string,
  body?: string,
  overrides: ClickHouseSettings = {},
): Promise<string> {
  const config = settings(overrides);
  const url = new URL(config.url);
  url.searchParams.set("database", config.database);
  url.searchParams.set("query", query);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${config.user}:${config.password}`).toString("base64")}`,
    },
    body,
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`ClickHouse query failed (${response.status}): ${responseBody}`);
  }
  return responseBody;
}

export async function ensureTelemetrySchema(
  overrides: ClickHouseSettings = {},
): Promise<void> {
  for (const statement of telemetrySchemaStatements) {
    await clickHouseQuery(statement, undefined, overrides);
  }
}

function dnsEventRow(event: DnsEvent): Record<string, unknown> {
  return {
    timestamp: toClickHouseDateTime(event.timestamp),
    site_id: event.siteId,
    zone: event.zone,
    client_ip: event.clientIp,
    qname: event.qname,
    qtype: event.qtype,
    rcode: event.rcode,
    latency_ms: event.latencyMs,
    resolver_id: event.resolverId,
    scenario_tag: event.scenarioTag,
    source: event.source,
    synthetic: event.synthetic ? 1 : 0,
    saturation: event.saturation,
  };
}

function siteMetricRow(
  metrics: SiteWindowMetrics,
  qoe: SiteQoe,
): Record<string, unknown> {
  return {
    bucket_start: toClickHouseDateTime(metrics.bucketStart),
    site_id: metrics.siteId,
    query_count: metrics.queryCount,
    nxdomain_count: metrics.nxdomainCount,
    nxdomain_ratio: metrics.nxdomainRatio,
    latency_median: metrics.latencyMedian,
    latency_p95: metrics.latencyP95,
    unique_domains: metrics.uniqueDomains,
    mean_entropy: metrics.meanEntropy,
    periodicity_score: metrics.periodicityScore,
    saturation: metrics.saturation,
    qoe_score: qoe.score,
    qoe_availability: qoe.availability,
    qoe_latency_factor: qoe.latencyFactor,
    qoe_capacity: qoe.capacity,
    qoe_weight_availability: qoe.weights.availability,
    qoe_weight_latency: qoe.weights.latency,
    qoe_weight_capacity: qoe.weights.capacity,
    qoe_explanation: qoe.explanation,
  };
}

async function insertRows(
  table: string,
  rows: readonly Record<string, unknown>[],
  overrides: ClickHouseSettings = {},
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500);
    await clickHouseQuery(
      `INSERT INTO ${table} FORMAT JSONEachRow`,
      chunk.map((row) => JSON.stringify(row)).join("\n"),
      overrides,
    );
  }
}

export async function persistDnsEvents(
  events: readonly DnsEvent[],
  overrides: ClickHouseSettings = {},
): Promise<void> {
  await insertRows("dns_events", events.map(dnsEventRow), overrides);
}

export async function persistSiteWindows(
  windows: readonly SiteWindowMetrics[],
  overrides: ClickHouseSettings = {},
): Promise<void> {
  await insertRows(
    "site_metrics",
    qoeForWindows(windows).map(({ metrics, qoe }) => siteMetricRow(metrics, qoe)),
    overrides,
  );
}

export async function persistBucket(
  metrics: SiteWindowMetrics,
  events: readonly DnsEvent[],
  qoe: SiteQoe,
  overrides: ClickHouseSettings = {},
): Promise<void> {
  await persistDnsEvents(events, overrides);
  await insertRows("site_metrics", [siteMetricRow(metrics, qoe)], overrides);
}

export async function persistTelemetry(
  events: readonly DnsEvent[],
  windows: readonly SiteWindowMetrics[],
  overrides: ClickHouseSettings = {},
): Promise<void> {
  await persistDnsEvents(events, overrides);
  await persistSiteWindows(windows, overrides);
}

function incidentRow(incident: Incident): Record<string, unknown> {
  return {
    incident_id: incident.incidentId,
    window_start: toClickHouseDateTime(incident.windowStart),
    timestamp: toClickHouseDateTime(incident.timestamp),
    site_id: incident.siteId,
    classification: incident.classification,
    severity: incident.severity,
    confidence: incident.confidence,
    signal_count: incident.signalCount,
    signal_ids: incident.signalIds,
    types: incident.types,
    affected_entities: incident.affectedEntities,
    summary: incident.summary,
  };
}

export async function persistIncidents(
  incidents: readonly Incident[],
  overrides: ClickHouseSettings = {},
): Promise<void> {
  await insertRows("incidents", incidents.map(incidentRow), overrides);
}
