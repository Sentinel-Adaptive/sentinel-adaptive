# Pre-existing Components and External Sources

## Pre-existing project-specific code

None. The initial public repository contained only a minimal project README before implementation began.

## Open-source dependencies

Standard dependencies are declared in package manifests and, in later stages, Docker configuration.

## Templates and UI bases

- Wazuh Docker single-node configuration adapted from `wazuh/wazuh-docker` tag `v4.14.7` (GPL-2.0) on 2026-09-10.
- Grafana ClickHouse datasource plugin `4.20.0` is downloaded from the official `grafana/clickhouse-datasource` release during local setup; the binary is not committed.
- The Stage 1 Grafana smoke dashboard is project-authored and not imported from a template.

Any generated shadcn components, additional imported dashboards, starters, or templates must be listed here when introduced.

## Public datasets

No public dataset has been added. Demo telemetry will initially be generated synthetically.

Any public domain list introduced later must record its source, license, purpose, and addition date here.
