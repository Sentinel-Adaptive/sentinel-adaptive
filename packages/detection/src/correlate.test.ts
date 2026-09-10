import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";

import {
  CORRELATION_WINDOW_MS,
  IncidentCorrelator,
  correlateSignals,
  correlationWindowStartMs,
  incidentIdForWindow,
} from "./correlate.js";
import { processEvents } from "./pipeline.js";

describe("incident correlation", () => {
  it("merges compatible same-site signals in a 60-second window", () => {
    const dga = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        seed: 7_100_100,
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).filter((signal) => signal.type === "dga");
    const beacon = processEvents(
      generateScenario({
        scenario: "beacon",
        count: 4,
        siteId: "PTY-BANK-01",
        seed: 7_100_101,
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).filter((signal) => signal.type === "beaconing");
    const signals = [...dga, ...beacon];
    expect(dga).toHaveLength(1);
    expect(beacon).toHaveLength(1);

    const [incident] = correlateSignals(signals);
    expect(incident).toBeDefined();
    expect(incident!.signalCount).toBe(2);
    expect(incident!.types).toEqual(["beaconing", "dga"]);
    expect(new Set(incident!.signalIds).size).toBe(2);
    expect(signals.every((signal) => signal.incidentId === null)).toBe(true);
  });

  it("does not merge signals from different sites", () => {
    const bank = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        seed: 7_100_200,
      }),
    );
    const health = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-HEALTH-01",
        seed: 7_100_201,
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    );
    const incidents = correlateSignals([...bank, ...health]);
    const sites = new Set(incidents.map((incident) => incident.siteId));
    expect(incidents).toHaveLength(2);
    expect(sites).toEqual(new Set(["PTY-BANK-01", "PTY-HEALTH-01"]));
    expect(incidents[0]?.incidentId).not.toBe(incidents[1]?.incidentId);
  });

  it("opens a new incident after the correlation window", () => {
    const first = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        seed: 7_100_300,
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    );
    const later = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        seed: 7_100_301,
        startTime: "2026-09-10T12:02:00.000Z",
      }),
    );
    const correlator = new IncidentCorrelator();
    const firstIncidents = correlator.ingest(first);
    const laterIncidents = correlator.ingest(later);
    expect(firstIncidents).toHaveLength(1);
    expect(laterIncidents).toHaveLength(1);
    expect(laterIncidents[0]?.incidentId).not.toBe(firstIncidents[0]?.incidentId);
    expect(laterIncidents[0]?.windowStart).not.toBe(firstIncidents[0]?.windowStart);
    expect(Date.parse(laterIncidents[0]!.windowStart)).toBe(
      Date.parse(firstIncidents[0]!.windowStart) + 2 * CORRELATION_WINDOW_MS,
    );
  });

  it("keeps member evidence and assigns a durable incident id", () => {
    const [dga] = processEvents(
      generateScenario({ scenario: "dga", count: 20 }),
    ).filter((signal) => signal.type === "dga");
    expect(dga).toBeDefined();
    const [incident] = correlateSignals([dga!]);
    expect(incident!.signalCount).toBe(1);
    expect(incident!.incidentId).toBe(
      incidentIdForWindow(dga!.siteId, correlationWindowStartMs(dga!.timestamp)),
    );
    expect(dga!.evidence.length).toBeGreaterThan(0);
    expect(dga!.incidentId).toBeNull();
  });
});
