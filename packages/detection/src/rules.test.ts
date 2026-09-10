import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";

import { levenshtein, nearestCanonical } from "./canonical-domains.js";
import { processEvents } from "./pipeline.js";

describe("canonical domain matching", () => {
  it("treats adjacent transpositions as a single edit", () => {
    expect(levenshtein("bank", "bnak")).toBe(1);
    expect(nearestCanonical("secure-bnak.test")?.canonical).toBe(
      "secure-bank.test",
    );
    expect(nearestCanonical("citzien-services.test")?.distance).toBe(1);
    expect(nearestCanonical("health-protal.test")?.canonical).toBe(
      "health-portal.test",
    );
  });
});

describe("deterministic detection rules", () => {
  it("does not emit high severity for normal traffic", () => {
    const signals = processEvents(
      generateScenario({ scenario: "normal", count: 90 }),
    );
    expect(signals.some((signal) => signal.severityHint === "high")).toBe(
      false,
    );
  });

  it("emits evidenced DGA, tunnel, beacon, and typosquat signals", () => {
    const dga = processEvents(generateScenario({ scenario: "dga", count: 20 }));
    const tunnel = processEvents(
      generateScenario({ scenario: "tunnel", count: 8 }),
    );
    const beacon = processEvents(
      generateScenario({ scenario: "beacon", count: 6 }),
    );
    const typo = processEvents(
      generateScenario({ scenario: "typosquat", count: 5 }),
    );

    expect(dga.some((signal) => signal.type === "dga")).toBe(true);
    expect(tunnel.some((signal) => signal.type === "tunneling")).toBe(true);
    expect(beacon.some((signal) => signal.type === "beaconing")).toBe(true);
    expect(typo.some((signal) => signal.type === "typosquatting")).toBe(true);

    for (const signal of [...dga, ...tunnel, ...beacon, ...typo]) {
      expect(signal.source).toBe("deterministic");
      expect(signal.incidentId).toBeNull();
      expect(signal.evidence.length).toBeGreaterThan(0);
    }
  });
});
