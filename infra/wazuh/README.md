# Wazuh local smoke environment

This directory adapts the official Wazuh Docker single-node configuration from tag `v4.14.7`:

https://github.com/wazuh/wazuh-docker/tree/v4.14.7/single-node

Wazuh Docker configuration is distributed under GPL-2.0. Sentinel-specific additions are:

- a monitored JSON log at `/var/log/sentinel/events.json`;
- rule `100100` for `dns_security_incident`;
- a synthetic Stage 1 fixture.

Generated TLS certificates live under `certs/generated/` and are intentionally excluded from Git.

```bash
npm run infra:certs
npm run infra:up
npm run smoke:infra
npm run health
```

The credentials in the local Compose environment are development-only defaults from the isolated smoke environment. They must not be reused for a production deployment.
