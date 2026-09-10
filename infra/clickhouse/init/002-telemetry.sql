CREATE TABLE IF NOT EXISTS sentinel.dns_events
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
ORDER BY (site_id, timestamp);

CREATE TABLE IF NOT EXISTS sentinel.site_metrics
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
ORDER BY (site_id, bucket_start);

CREATE TABLE IF NOT EXISTS sentinel.incidents
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
ORDER BY (site_id, incident_id);

CREATE TABLE IF NOT EXISTS sentinel.signals
(
    signal_id String,
    timestamp DateTime64(3, 'UTC'),
    site_id LowCardinality(String),
    type LowCardinality(String),
    score Float64,
    severity LowCardinality(String),
    incident_id String,
    evidence_json String
)
ENGINE = ReplacingMergeTree(timestamp)
ORDER BY (incident_id, signal_id);

CREATE TABLE IF NOT EXISTS sentinel.qvac_results
(
    signal_id String,
    status LowCardinality(String),
    assessment LowCardinality(String),
    rationale String,
    used_evidence Array(String),
    updated_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY signal_id;
