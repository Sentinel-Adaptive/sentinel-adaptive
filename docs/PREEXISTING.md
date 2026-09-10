# Pre-existing Components and External Sources

## Pre-existing project-specific code

None. The initial public repository contained only a minimal project README before implementation began.

## Open-source dependencies

Standard dependencies are declared in package manifests and Docker configuration.

- `@qvac/sdk` and `@qvac/inference` 0.19.0 (Apache-2.0) were added on 2026-09-10 for local judged inference. The GGUF weights for `LLAMA_3_2_1B_INST_Q4_0` are downloaded by the SDK and are not committed.

## Templates and UI bases

- Wazuh Docker single-node configuration adapted from `wazuh/wazuh-docker` tag `v4.14.7` (GPL-2.0) on 2026-09-10.
- Grafana ClickHouse datasource plugin `4.20.0` is downloaded from the official `grafana/clickhouse-datasource` release during local setup; the binary is not committed.
- The Stage 1 Grafana smoke dashboard is project-authored and not imported from a template.
- The Stage 4 Grafana site QoE dashboard is project-authored and not imported from a template.
- The Stage 8 operator UI is project-authored Vite + React + Tailwind CSS with locally bundled IBM Plex Sans (`@fontsource/ibm-plex-sans` 5.3.0). It is not a shadcn dashboard template.

Any generated shadcn components, additional imported dashboards, starters, or templates must be listed here when introduced.

## Public datasets

No public dataset has been added. Demo telemetry will initially be generated synthetically.

Any public domain list introduced later must record its source, license, purpose, and addition date here.
