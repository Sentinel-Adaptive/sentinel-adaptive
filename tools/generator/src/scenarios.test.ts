import { describe, expect, it } from "vitest";

import {
  dnsEventSchema,
  scenarioTags,
  siteIds,
  type ScenarioTag,
  type SiteId,
} from "@sentinel-adaptive/contracts";

import { generateScenario } from "./scenarios.js";

function averageLatency(events: ReturnType<typeof generateScenario>): number {
  return (
    events.reduce((total, event) => total + event.latencyMs, 0) / events.length
  );
}

describe("synthetic DNS scenarios", () => {
  it("is deterministic for the same inputs", () => {
    for (const scenario of scenarioTags) {
      const options = {
        scenario,
        count: 24,
        seed: 91,
        startTime: "2026-09-10T12:00:00.000Z",
      };

      expect(generateScenario(options)).toEqual(generateScenario(options));
    }
  });

  it("emits strict, explicitly synthetic events for every scenario", () => {
    for (const scenario of scenarioTags) {
      const events = generateScenario({ scenario, count: 12 });

      expect(events).toHaveLength(12);
      for (const event of events) {
        expect(dnsEventSchema.parse(event)).toEqual(event);
        expect(event.synthetic).toBe(true);
        expect(event.scenarioTag).toBe(scenario);
      }
    }
  });

  it("models three fictional sites with deliberately different normals", () => {
    const events = generateScenario({ scenario: "normal", count: 300 });
    const observedSites = new Set(events.map((event) => event.siteId));

    expect(observedSites).toEqual(new Set(siteIds));

    const averages = Object.fromEntries(
      siteIds.map((siteId) => [
        siteId,
        averageLatency(events.filter((event) => event.siteId === siteId)),
      ]),
    ) as Record<SiteId, number>;

    expect(averages["PTY-BANK-01"]).toBeLessThan(averages["PTY-HEALTH-01"]);
    expect(averages["PTY-HEALTH-01"]).toBeLessThan(averages["COL-GOV-01"]);
  });

  it("preserves the defining behavior of each attack scenario", () => {
    const dga = generateScenario({ scenario: "dga", count: 20 });
    const tunnel = generateScenario({ scenario: "tunnel", count: 5 });
    const beacon = generateScenario({ scenario: "beacon", count: 5 });
    const typosquat = generateScenario({ scenario: "typosquat", count: 5 });
    const saturation = generateScenario({ scenario: "saturation", count: 5 });

    expect(dga.filter((event) => event.rcode === "NXDOMAIN").length).toBe(16);
    expect(tunnel.every((event) => event.qtype === "TXT")).toBe(true);
    expect(tunnel[0]?.qname.split(".")[0]).toHaveLength(52);
    expect(new Date(beacon[1]?.timestamp ?? 0).getTime()).toBe(
      new Date(beacon[0]?.timestamp ?? 0).getTime() + 15_000,
    );
    expect(new Set(beacon.map((event) => event.qname))).toEqual(
      new Set(["heartbeat.edge-service.test"]),
    );
    expect(typosquat.map((event) => event.qname)).toContain(
      "secure-bnak.test",
    );
    expect(saturation.every((event) => event.saturation === 0.98)).toBe(true);
  });

  it("degrades one selected site's normal QoE measurements", () => {
    const options = { count: 30, siteId: "PTY-BANK-01" as const };
    const normal = generateScenario({ ...options, scenario: "normal" });
    const degraded = generateScenario({
      ...options,
      scenario: "degrade-qoe",
    });

    expect(averageLatency(degraded)).toBeGreaterThan(
      averageLatency(normal) * 4,
    );
    expect(degraded.every((event) => event.siteId === options.siteId)).toBe(
      true,
    );
  });

  it("rejects unsupported generation bounds", () => {
    expect(() =>
      generateScenario({
        scenario: "normal" as ScenarioTag,
        count: 0,
      }),
    ).toThrow("Event count");
  });
});
