import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";
import { correlateSignals, processEvents } from "@sentinel-adaptive/detection";
import { wazuhIncidentEventSchema } from "@sentinel-adaptive/contracts";

import { emitWazuhIncidents, toWazuhIncidentEvent } from "./wazuh.js";

describe("Wazuh incident mapping", () => {
  it("maps correlated incidents onto the monitored JSON contract", () => {
    const dga = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).find((signal) => signal.type === "dga");
    const tunnel = processEvents(
      generateScenario({ scenario: "tunnel", count: 8 }),
    ).find((signal) => signal.type === "tunneling");
    const beacon = processEvents(
      generateScenario({
        scenario: "beacon",
        count: 4,
        siteId: "PTY-BANK-01",
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).find((signal) => signal.type === "beaconing");
    const typo = processEvents(
      generateScenario({ scenario: "typosquat", count: 5 }),
    ).find((signal) => signal.type === "typosquatting");

    expect(dga).toBeDefined();
    expect(tunnel).toBeDefined();
    expect(beacon).toBeDefined();
    expect(typo).toBeDefined();

    expect(toWazuhIncidentEvent(correlateSignals([dga!])[0]!).classification).toBe(
      "possible_dga",
    );
    expect(
      toWazuhIncidentEvent(correlateSignals([tunnel!])[0]!).classification,
    ).toBe("possible_dns_tunneling");
    expect(
      toWazuhIncidentEvent(correlateSignals([beacon!])[0]!).classification,
    ).toBe("possible_c2_beaconing");
    expect(
      toWazuhIncidentEvent(correlateSignals([typo!])[0]!).classification,
    ).toBe("possible_typosquatting");

    const merged = correlateSignals([dga!, beacon!])[0];
    expect(merged).toBeDefined();
    expect(toWazuhIncidentEvent(merged!).signal_count).toBe(2);
    expect(toWazuhIncidentEvent(merged!).incident_id).toBe(merged!.incidentId);
    expect(dga!.incidentId).toBeNull();
  });

  it("appends validated JSONL without rewriting the log", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-wazuh-"));
    const eventLog = path.join(directory, "events.json");
    const incidents = correlateSignals(
      processEvents(generateScenario({ scenario: "dga", count: 20 })).filter(
        (signal) => signal.type === "dga",
      ),
    );

    const first = await emitWazuhIncidents(incidents, eventLog);
    const second = await emitWazuhIncidents(incidents, eventLog);
    const lines = readFileSync(eventLog, "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(lines).toHaveLength(2);
    expect(
      wazuhIncidentEventSchema.parse(JSON.parse(lines[0] ?? "{}")).incident_id,
    ).toBe(first[0]?.incident_id);
    expect(lines[0]).toBe(lines[1]);
  });
});
