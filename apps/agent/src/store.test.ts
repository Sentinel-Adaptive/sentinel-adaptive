import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";
import { IncidentCorrelator, processEvents } from "@sentinel-adaptive/detection";

import { OperatorStore } from "./store.js";
import { buildSystemStatus } from "./api-read.js";
import { parseSiteId } from "./api-read.js";

describe("operator store", () => {
  it("keeps correlated members for incident detail", () => {
    const dga = processEvents(
      generateScenario({
        scenario: "dga",
        count: 20,
        siteId: "PTY-BANK-01",
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).filter((signal) => signal.type === "dga");
    const beacon = processEvents(
      generateScenario({
        scenario: "beacon",
        count: 4,
        siteId: "PTY-BANK-01",
        startTime: "2026-09-10T12:00:00.000Z",
      }),
    ).filter((signal) => signal.type === "beaconing");
    const correlator = new IncidentCorrelator();
    const incidents = correlator.ingest([...dga, ...beacon]);
    const members = correlator.membersOf(incidents[0]!.incidentId);
    const store = new OperatorStore();
    store.recordIncidents(incidents, members);
    store.markWazuhEmitted([incidents[0]!.incidentId]);

    expect(store.listIncidents()).toHaveLength(1);
    expect(store.signalsFor(incidents[0]!.incidentId)).toHaveLength(2);
    expect(store.wazuhEmittedFor(incidents[0]!.incidentId)).toBe(true);
    expect(members.every((signal) => signal.incidentId === incidents[0]!.incidentId)).toBe(
      true,
    );
  });
});

describe("operator api contracts", () => {
  it("describes local-only QVAC and rejects unknown sites", () => {
    const status = buildSystemStatus({
      kafka: "ok",
      clickhouse: "ok",
      grafana: "ok",
      wazuh: "ok",
    });
    expect(status.cloudInference).toBe(false);
    expect(status.qvac.sdk).toBe("0.19.0");
    expect(status.qvac.model).toBe("LLAMA_3_2_1B_INST_Q4_0");
    expect(parseSiteId("NOPE")).toBeUndefined();
    expect(parseSiteId("PTY-BANK-01")).toBe("PTY-BANK-01");
  });
});
