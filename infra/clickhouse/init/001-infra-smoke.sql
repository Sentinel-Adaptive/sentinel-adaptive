CREATE DATABASE IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.infra_smoke
(
    observed_at DateTime64(3),
    component LowCardinality(String),
    marker String,
    value Float64
)
ENGINE = MergeTree
ORDER BY (component, observed_at);
