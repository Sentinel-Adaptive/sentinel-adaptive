import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  wazuhIncidentEventSchema,
  type Incident,
  type WazuhIncidentEvent,
} from "@sentinel-adaptive/contracts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const composeFile = path.join(root, "infra", "docker-compose.yml");
const defaultEventLog = path.join(root, "infra", "wazuh", "runtime", "events.json");

export function defaultWazuhEventLog(): string {
  return process.env.WAZUH_EVENT_LOG ?? defaultEventLog;
}

export function toWazuhIncidentEvent(incident: Incident): WazuhIncidentEvent {
  return wazuhIncidentEventSchema.parse({
    source: "sentinel-adaptive",
    event_type: "dns_security_incident",
    incident_id: incident.incidentId,
    site_id: incident.siteId,
    classification: incident.classification,
    severity: incident.severity,
    confidence: incident.confidence,
    signal_count: incident.signalCount,
    summary: incident.summary,
    signal_id: incident.signalIds[0],
  });
}

export async function emitWazuhIncidents(
  incidents: readonly Incident[],
  eventLog = defaultWazuhEventLog(),
): Promise<readonly WazuhIncidentEvent[]> {
  const events = incidents.map(toWazuhIncidentEvent);
  if (events.length === 0) {
    return [];
  }

  await mkdir(path.dirname(eventLog), { recursive: true });
  await appendFile(
    eventLog,
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    "utf8",
  );
  return events;
}

export function searchWazuhAlert(incidentId: string): boolean {
  const user = process.env.WAZUH_INDEXER_USER ?? "admin";
  const password = process.env.WAZUH_INDEXER_PASSWORD ?? "SecretPassword";
  const query = JSON.stringify({
    query: {
      match: {
        "data.incident_id": incidentId,
      },
    },
  });
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "wazuh.indexer",
      "curl",
      "-kfsS",
      "-u",
      `${user}:${password}`,
      "-H",
      "Content-Type: application/json",
      "https://localhost:9200/wazuh-alerts-*/_search",
      "--data-binary",
      "@-",
    ],
    {
      cwd: root,
      encoding: "utf8",
      input: query,
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    return false;
  }

  try {
    const response = JSON.parse(result.stdout) as {
      hits?: { total?: { value?: number } };
    };
    return (response.hits?.total?.value ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function waitForWazuhAlert(
  incidentId: string,
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (searchWazuhAlert(incidentId)) {
      return;
    }
    await delay(5_000);
  }
  throw new Error(
    `Wazuh did not index processed incident '${incidentId}' within ${timeoutMs}ms.`,
  );
}
