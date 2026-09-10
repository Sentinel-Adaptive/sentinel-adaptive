import { describe, expect, it } from "vitest";

import type { SiteWindowMetrics } from "@sentinel-adaptive/contracts";
import { generateScenario } from "@sentinel-adaptive/generator";

import { calculateQoe, qoeForWindows, qoeWeights } from "./qoe.js";
import { collectSiteWindows } from "./pipeline.js";

const bankWindow = (
  overrides: Partial<SiteWindowMetrics> = {},
): SiteWindowMetrics => ({
  bucketStart: "2026-09-10T12:00:00.000Z",
  siteId: "PTY-BANK-01",
  queryCount: 10,
  nxdomainCount: 0,
  nxdomainRatio: 0.01,
  latencyMedian: 18,
  latencyP95: 22,
  uniqueDomains: 4,
  meanEntropy: 2.4,
  periodicityScore: 0.1,
  saturation: 0.18,
  ...overrides,
});

describe("transparent QoE", () => {
  it("keeps documented weights that sum to one", () => {
    expect(
      qoeWeights.availability + qoeWeights.latency + qoeWeights.capacity,
    ).toBe(1);
  });

  it("treats missing baseline latency as a neutral latency factor", () => {
    const qoe = calculateQoe(bankWindow());
    expect(qoe.latencyFactor).toBe(1);
    expect(qoe.availability).toBeCloseTo(0.99);
    expect(qoe.capacity).toBeCloseTo(0.82);
    expect(qoe.explanation).toMatch(/0\.45×availability/);
  });

  it("lowers the score when latency, NXDOMAIN ratio, or saturation worsen", () => {
    const baseline = {
      latencyP95: { mean: 22, stddev: 1, samples: 8 },
    };
    const healthy = calculateQoe(bankWindow(), baseline);
    const slower = calculateQoe(bankWindow({ latencyP95: 110 }), baseline);
    const noisier = calculateQoe(bankWindow({ nxdomainRatio: 0.4 }), baseline);
    const busier = calculateQoe(bankWindow({ saturation: 0.95 }), baseline);

    expect(slower.score).toBeLessThan(healthy.score);
    expect(noisier.score).toBeLessThan(healthy.score);
    expect(busier.score).toBeLessThan(healthy.score);
    expect(slower.latencyFactor).toBeLessThan(healthy.latencyFactor);
  });

  it("scores degrade-qoe lower than normal for the same fictional site", () => {
    const options = { count: 40, siteId: "PTY-BANK-01" as const, seed: 4_100 };
    const normalEvents = generateScenario({ ...options, scenario: "normal" });
    const degradedEvents = generateScenario({
      ...options,
      scenario: "degrade-qoe",
      startTime: "2026-09-10T12:01:00.000Z",
    });
    const scored = qoeForWindows(
      collectSiteWindows([...normalEvents, ...degradedEvents]),
    );
    const cutoff = Date.parse("2026-09-10T12:01:00.000Z");
    const normalMean =
      scored
        .filter((row) => Date.parse(row.metrics.bucketStart) < cutoff)
        .reduce((total, row) => total + row.qoe.score, 0) /
      scored.filter((row) => Date.parse(row.metrics.bucketStart) < cutoff)
        .length;
    const degradedMean =
      scored
        .filter((row) => Date.parse(row.metrics.bucketStart) >= cutoff)
        .reduce((total, row) => total + row.qoe.score, 0) /
      scored.filter((row) => Date.parse(row.metrics.bucketStart) >= cutoff)
        .length;

    expect(normalMean).toBeGreaterThan(0);
    expect(degradedMean).toBeLessThan(normalMean * 0.75);
    expect(
      scored.find((row) => Date.parse(row.metrics.bucketStart) >= cutoff)?.qoe
        .latencyFactor,
    ).toBeLessThan(0.5);
  });
});
