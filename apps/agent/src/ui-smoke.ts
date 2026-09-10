import { systemStatusSchema } from "@sentinel-adaptive/contracts";
import {
  IncidentCorrelator,
  collectSiteWindows,
  processEvents,
} from "@sentinel-adaptive/detection";
import { generateScenario } from "@sentinel-adaptive/generator";

import { listenOperatorApi } from "./api.js";
import {
  ensureTelemetrySchema,
  persistIncidents,
  persistSignals,
  persistTelemetry,
} from "./clickhouse.js";
import { OperatorStore } from "./store.js";

const siteId = "PTY-BANK-01" as const;

try {
  await ensureTelemetrySchema();
  const dgaEvents = generateScenario({
    scenario: "dga",
    count: 20,
    siteId,
    seed: 8_108_100,
    startTime: "2026-09-10T12:00:00.000Z",
  });
  const beaconEvents = generateScenario({
    scenario: "beacon",
    count: 4,
    siteId,
    seed: 8_108_101,
    startTime: "2026-09-10T12:00:00.000Z",
  });
  const events = [...dgaEvents, ...beaconEvents];
  await persistTelemetry(events, collectSiteWindows(events));

  const dga = processEvents(dgaEvents).filter((signal) => signal.type === "dga");
  const beacon = processEvents(beaconEvents).filter(
    (signal) => signal.type === "beaconing",
  );
  const correlator = new IncidentCorrelator();
  const incidents = correlator.ingest([...dga, ...beacon]);
  const incident = incidents[0];
  if (!incident || incident.signalCount < 2) {
    throw new Error("Expected a multi-signal incident for UI smoke.");
  }
  const members = correlator.membersOf(incident.incidentId);
  const store = new OperatorStore();
  store.recordIncidents(incidents, members);
  store.markWazuhEmitted([incident.incidentId]);
  await persistIncidents(incidents);
  await persistSignals(members);

  const api = await listenOperatorApi(store, 0);
  const base = `http://127.0.0.1:${api.port}`;
  try {
    const system = systemStatusSchema.parse(await getJson(`${base}/api/system`));
    if (system.cloudInference !== false || system.qvac.sdk !== "0.19.0") {
      throw new Error("System view is not local-only QVAC 0.19.0.");
    }
    const overview = await getJson(`${base}/api/overview`);
    if (!Array.isArray(overview.sites) || overview.sites.length !== 3) {
      throw new Error("Overview did not list the three fictional sites.");
    }
    const list = await getJson(`${base}/api/incidents`);
    if (!Array.isArray(list) || list.length < 1) {
      throw new Error("Incidents list was empty.");
    }
    const detail = await getJson(`${base}/api/incidents/${incident.incidentId}`);
    const signals = detail.signals;
    if (!Array.isArray(signals) || signals.length < 2) {
      throw new Error("Incident detail did not include member evidence.");
    }
    if (
      signals.some(
        (signal) =>
          typeof signal !== "object" ||
          signal === null ||
          !Array.isArray((signal as { evidence?: unknown }).evidence) ||
          (signal as { evidence: unknown[] }).evidence.length === 0,
      )
    ) {
      throw new Error("Incident detail dropped evidence rows.");
    }
    const site = await getJson(`${base}/api/sites/${siteId}`);
    if (site.siteId !== siteId) {
      throw new Error("Site detail did not return the requested site.");
    }

    console.log("System     PASS");
    console.log("Overview   PASS");
    console.log("Incidents  PASS");
    console.log(`Detail     PASS (${incident.incidentId})`);
    console.log("Site       PASS");
  } finally {
    await api.close();
  }
} catch (error) {
  console.error("Operator UI smoke test: FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status} ${body}`);
  }
  return JSON.parse(body) as Record<string, unknown>;
}
