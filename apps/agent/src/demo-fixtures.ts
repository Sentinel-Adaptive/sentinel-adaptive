import {
  IncidentCorrelator,
  collectSiteWindows,
  isAmbiguousSignal,
  processEvents,
} from "@sentinel-adaptive/detection";
import { generateScenario } from "@sentinel-adaptive/generator";
import type { DnsEvent, Incident, QvacResult, Signal } from "@sentinel-adaptive/contracts";

import {
  ensureTelemetrySchema,
  persistIncidents,
  persistQvacResults,
  persistSignals,
  persistTelemetry,
} from "./clickhouse.js";
import { assessAmbiguousSignals, closeQvacRuntime } from "./qvac.js";
import { OperatorStore } from "./store.js";
import { emitWazuhIncidents } from "./wazuh.js";

export const highConfidenceSite = "PTY-BANK-01" as const;
export const ambiguousSite = "PTY-HEALTH-01" as const;
export const highConfidenceStart = "2026-09-10T12:00:00.000Z";
export const ambiguousStart = "2026-09-10T12:10:00.000Z";
export const qoeStart = "2026-09-10T12:20:00.000Z";

export interface DemoSeedResult {
  readonly store: OperatorStore;
  readonly highConfidence: Incident;
  readonly ambiguous: Incident;
  readonly highMembers: Signal[];
  readonly ambiguousMembers: Signal[];
  readonly qvac: readonly QvacResult[];
  readonly events: DnsEvent[];
}

export function buildDemoEvents(): {
  qoeEvents: DnsEvent[];
  highDga: DnsEvent[];
  highBeacon: DnsEvent[];
  ambiguousBeacon: DnsEvent[];
} {
  return {
    qoeEvents: [
      ...generateScenario({
        scenario: "normal",
        count: 80,
        siteId: "PTY-BANK-01",
        seed: 8_201,
        startTime: qoeStart,
      }),
      ...generateScenario({
        scenario: "normal",
        count: 80,
        siteId: "PTY-HEALTH-01",
        seed: 8_202,
        startTime: qoeStart,
      }),
      ...generateScenario({
        scenario: "degrade-qoe",
        count: 80,
        siteId: "COL-GOV-01",
        seed: 8_203,
        startTime: qoeStart,
      }),
    ],
    highDga: generateScenario({
      scenario: "dga",
      count: 20,
      siteId: highConfidenceSite,
      seed: 8_108_100,
      startTime: highConfidenceStart,
    }),
    highBeacon: generateScenario({
      scenario: "beacon",
      count: 4,
      siteId: highConfidenceSite,
      seed: 8_108_101,
      startTime: highConfidenceStart,
    }),
    ambiguousBeacon: generateScenario({
      scenario: "ambiguous-beacon",
      count: 4,
      siteId: ambiguousSite,
      seed: 910_001,
      startTime: ambiguousStart,
    }),
  };
}

export function buildDemoIncidents(): {
  events: DnsEvent[];
  highConfidence: Incident;
  ambiguous: Incident;
  highMembers: Signal[];
  ambiguousMembers: Signal[];
  highSignals: Signal[];
  ambiguousSignals: Signal[];
} {
  const built = buildDemoEvents();
  const highSignals = [
    ...processEvents(built.highDga).filter((signal) => signal.type === "dga"),
    ...processEvents(built.highBeacon).filter((signal) => signal.type === "beaconing"),
  ];
  const ambiguousSignals = processEvents(built.ambiguousBeacon).filter(
    (signal) => signal.type === "beaconing",
  );
  if (highSignals.some((signal) => isAmbiguousSignal(signal))) {
    throw new Error("High-confidence demo signals must stay outside the QVAC band.");
  }
  if (ambiguousSignals.length === 0 || !ambiguousSignals.every((signal) => isAmbiguousSignal(signal))) {
    throw new Error("Ambiguous-beacon demo must produce a score inside 0.60 ≤ score < 0.75.");
  }

  const highCorrelator = new IncidentCorrelator();
  const highIncidents = highCorrelator.ingest(highSignals);
  const highConfidence = highIncidents[0];
  if (!highConfidence || highConfidence.signalCount < 2) {
    throw new Error("Expected a multi-signal high-confidence incident.");
  }

  const ambiguousCorrelator = new IncidentCorrelator();
  const ambiguousIncidents = ambiguousCorrelator.ingest(ambiguousSignals);
  const ambiguous = ambiguousIncidents[0];
  if (!ambiguous) {
    throw new Error("Expected an ambiguous-beacon incident.");
  }

  return {
    events: [
      ...built.qoeEvents,
      ...built.highDga,
      ...built.highBeacon,
      ...built.ambiguousBeacon,
    ],
    highConfidence,
    ambiguous,
    highMembers: highCorrelator.membersOf(highConfidence.incidentId),
    ambiguousMembers: ambiguousCorrelator.membersOf(ambiguous.incidentId),
    highSignals,
    ambiguousSignals,
  };
}

export async function seedOperatorDemo(
  options: { assessQvac?: boolean; emitWazuh?: boolean } = {},
): Promise<DemoSeedResult> {
  const assessQvac = options.assessQvac ?? true;
  const emitWazuh = options.emitWazuh ?? true;
  await ensureTelemetrySchema();
  const demo = buildDemoIncidents();
  const store = new OperatorStore();
  const members = [...demo.highMembers, ...demo.ambiguousMembers];
  const incidents = [demo.highConfidence, demo.ambiguous];
  store.recordIncidents(incidents, members);
  await persistTelemetry(demo.events, collectSiteWindows(demo.events));
  await persistIncidents(incidents);
  await persistSignals(members);

  if (emitWazuh) {
    await emitWazuhIncidents(incidents);
    store.markWazuhEmitted(incidents.map((incident) => incident.incidentId));
  }

  let qvac: readonly QvacResult[] = [];
  if (assessQvac) {
    qvac = await assessAmbiguousSignals([...demo.highSignals, ...demo.ambiguousSignals]);
    store.recordQvac(qvac);
    await persistQvacResults(qvac);
  }

  return {
    store,
    highConfidence: demo.highConfidence,
    ambiguous: demo.ambiguous,
    highMembers: demo.highMembers,
    ambiguousMembers: demo.ambiguousMembers,
    qvac,
    events: demo.events,
  };
}

export async function closeDemoQvac(): Promise<void> {
  await closeQvacRuntime().catch(() => undefined);
}
