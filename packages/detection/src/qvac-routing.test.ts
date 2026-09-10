import { describe, expect, it } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";

import { processEvents } from "./pipeline.js";
import {
  evidenceBundle,
  isAmbiguousSignal,
  qvacAmbiguousMax,
  qvacAmbiguousMin,
} from "./qvac-routing.js";

describe("QVAC ambiguous routing", () => {
  it("sends only mid-confidence scores to QVAC", () => {
    expect(isAmbiguousSignal({ score: 0.59 })).toBe(false);
    expect(isAmbiguousSignal({ score: qvacAmbiguousMin })).toBe(true);
    expect(isAmbiguousSignal({ score: 0.74 })).toBe(true);
    expect(isAmbiguousSignal({ score: qvacAmbiguousMax })).toBe(false);
    expect(isAmbiguousSignal({ score: 0.86 })).toBe(false);
  });

  it("does not route high-confidence attack signals from Stage 3 demos", () => {
    const dga = processEvents(
      generateScenario({ scenario: "dga", count: 20 }),
    ).find((signal) => signal.type === "dga");
    expect(dga).toBeDefined();
    expect(isAmbiguousSignal(dga!)).toBe(false);
    expect(evidenceBundle(dga!).evidence.length).toBeGreaterThan(0);
  });

  it("routes a deterministic weak beacon whose score stays inside the existing band", () => {
    const beacon = processEvents(
      generateScenario({
        scenario: "ambiguous-beacon",
        count: 4,
        siteId: "PTY-HEALTH-01",
        seed: 910_001,
        startTime: "2026-09-10T12:10:00.000Z",
      }),
    ).find((signal) => signal.type === "beaconing");
    expect(beacon).toBeDefined();
    expect(beacon!.score).toBeGreaterThanOrEqual(qvacAmbiguousMin);
    expect(beacon!.score).toBeLessThan(qvacAmbiguousMax);
    expect(isAmbiguousSignal(beacon!)).toBe(true);
    expect(evidenceBundle(beacon!).evidence.length).toBeGreaterThan(0);
  });
});
