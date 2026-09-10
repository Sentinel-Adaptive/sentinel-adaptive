import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";
import { processEvents } from "@sentinel-adaptive/detection";
import { wazuhIncidentEventSchema } from "@sentinel-adaptive/contracts";

import {
  emitWazuhIncidents,
  incidentIdForSignal,
  toWazuhIncidentEvent,
} from "./wazuh.js";

describe("Wazuh incident mapping", () => {
  it("maps each signal type onto the monitored JSON contract", () => {
    const dga = processEvents(generateScenario({ scenario: "dga", count: 20 }))
      .find((signal) => signal.type === "dga");
    const tunnel = processEvents(
      generateScenario({ scenario: "tunnel", count: 8 }),
    ).find((signal) => signal.type === "tunneling");
    const beacon = processEvents(
      generateScenario({ scenario: "beacon", count: 6 }),
    ).find((signal) => signal.type === "beaconing");
    const typo = processEvents(
      generateScenario({ scenario: "typosquat", count: 5 }),
    ).find((signal) => signal.type === "typosquatting");

    expect(dga).toBeDefined();
    expect(tunnel).toBeDefined();
    expect(beacon).toBeDefined();
    expect(typo).toBeDefined();

    expect(toWazuhIncidentEvent(dga!).classification).toBe("possible_dga");
    expect(toWazuhIncidentEvent(tunnel!).classification).toBe(
      "possible_dns_tunneling",
    );
    expect(toWazuhIncidentEvent(beacon!).classification).toBe(
      "possible_c2_beaconing",
    );
    expect(toWazuhIncidentEvent(typo!).classification).toBe(
      "possible_typosquatting",
    );
    expect(toWazuhIncidentEvent(dga!).signal_count).toBe(1);
    expect(dga!.incidentId).toBeNull();
    expect(toWazuhIncidentEvent(dga!).incident_id).toBe(
      incidentIdForSignal(dga!.signalId),
    );
    expect(toWazuhIncidentEvent(dga!)).toEqual(
      toWazuhIncidentEvent(dga!),
    );
  });

  it("appends validated JSONL without rewriting the log", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-wazuh-"));
    const eventLog = path.join(directory, "events.json");
    const signals = processEvents(
      generateScenario({ scenario: "dga", count: 20 }),
    ).filter((signal) => signal.type === "dga");

    const first = await emitWazuhIncidents(signals, eventLog);
    const second = await emitWazuhIncidents(signals, eventLog);
    const lines = readFileSync(eventLog, "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(lines).toHaveLength(2);
    expect(wazuhIncidentEventSchema.parse(JSON.parse(lines[0] ?? "{}")).incident_id).toBe(
      first[0]?.incident_id,
    );
    expect(lines[0]).toBe(lines[1]);
  });
});
