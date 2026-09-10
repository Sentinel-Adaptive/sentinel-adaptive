import { describe, expect, it } from "vitest";

import { signalSchema, type Signal } from "@sentinel-adaptive/contracts";
import { processEvents } from "@sentinel-adaptive/detection";
import { generateScenario } from "@sentinel-adaptive/generator";

import {
  assessSignals,
  buildQvacPrompt,
  type QvacRuntime,
} from "./qvac-assess.js";

function sampleSignal(score: number): Signal {
  return signalSchema.parse({
    signalId: "11111111-1111-4111-8111-111111111111",
    timestamp: "2026-09-10T12:34:56.000Z",
    siteId: "PTY-BANK-01",
    type: "dga",
    score,
    severityHint: score >= 0.75 ? "high" : "medium",
    evidence: [
      {
        metric: "nxdomainRatio",
        value: 0.41,
        reason: "many names in this window fail to resolve",
      },
    ],
    source: "deterministic",
    incidentId: null,
  });
}

function runtime(overrides: Partial<QvacRuntime> = {}): QvacRuntime {
  return {
    load: async () => "model-local",
    complete: async () =>
      JSON.stringify({
        assessment: "uncertain",
        rationale: "NXDOMAIN ratio is elevated but the window is short.",
        usedEvidence: ["nxdomainRatio"],
      }),
    ...overrides,
  };
}

describe("assessSignals", () => {
  it("skips high-confidence signals without loading the model", async () => {
    const dga = processEvents(
      generateScenario({ scenario: "dga", count: 20 }),
    ).find((signal) => signal.type === "dga");
    expect(dga).toBeDefined();
    expect(dga!.score).toBeGreaterThanOrEqual(0.75);

    let loaded = false;
    const results = await assessSignals(
      [dga!],
      runtime({
        async load() {
          loaded = true;
          return "model-local";
        },
      }),
    );

    expect(loaded).toBe(false);
    expect(results).toEqual([
      { signalId: dga!.signalId, status: "skipped" },
    ]);
    expect(dga!.source).toBe("deterministic");
    expect(dga!.incidentId).toBeNull();
  });

  it("assesses an ambiguous evidence bundle", async () => {
    const signal = sampleSignal(0.68);
    const results = await assessSignals([signal], runtime());
    expect(results).toEqual([
      {
        signalId: signal.signalId,
        status: "ok",
        assessment: {
          assessment: "uncertain",
          rationale: "NXDOMAIN ratio is elevated but the window is short.",
          usedEvidence: ["nxdomainRatio"],
        },
      },
    ]);
    expect(buildQvacPrompt(signal)).toContain('"score":0.68');
    expect(buildQvacPrompt(signal)).toContain("nxdomainRatio");
    expect(buildQvacPrompt(signal)).not.toContain("whois");
  });

  it("marks invalid JSON and load failures without throwing", async () => {
    const signal = sampleSignal(0.68);
    await expect(
      assessSignals(
        [signal],
        runtime({
          complete: async () => "not-json",
        }),
      ),
    ).resolves.toEqual([{ signalId: signal.signalId, status: "invalid" }]);
    await expect(
      assessSignals(
        [signal],
        runtime({
          load: async () => {
            throw new Error("missing GGUF");
          },
        }),
      ),
    ).resolves.toEqual([
      { signalId: signal.signalId, status: "unavailable" },
    ]);
    await expect(
      assessSignals(
        [signal],
        runtime({
          complete: async () => {
            throw new Error("inference crashed");
          },
        }),
      ),
    ).resolves.toEqual([
      { signalId: signal.signalId, status: "unavailable" },
    ]);
  });
});
