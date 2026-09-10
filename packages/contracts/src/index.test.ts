import { describe, expect, it } from "vitest";

import {
  dnsEventSchema,
  signalSchema,
  siteWindowMetricsSchema,
} from "./index.js";

const validEvent = {
  timestamp: "2026-09-10T12:34:56.000Z",
  siteId: "PTY-BANK-01",
  zone: "banking-east",
  clientIp: "10.10.4.23",
  qname: "portal.secure-bank.test",
  qtype: "A",
  rcode: "NOERROR",
  latencyMs: 21.4,
  resolverId: "dns-01",
  scenarioTag: "normal",
  synthetic: true,
  saturation: 0.2,
  generator: {
    seed: 424242,
    sequence: 0,
  },
};

describe("dnsEventSchema", () => {
  it("accepts a fully tagged synthetic DNS event", () => {
    expect(dnsEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("rejects untagged or non-synthetic telemetry", () => {
    expect(() =>
      dnsEventSchema.parse({ ...validEvent, synthetic: false }),
    ).toThrow();
    expect(() => {
      const untagged: Partial<typeof validEvent> = { ...validEvent };
      delete untagged.scenarioTag;
      return dnsEventSchema.parse(untagged);
    }).toThrow();
  });

  it("rejects invalid network and measurement values", () => {
    expect(() =>
      dnsEventSchema.parse({
        ...validEvent,
        clientIp: "203.0.113.999",
        latencyMs: -1,
        saturation: 1.2,
      }),
    ).toThrow();
  });
});

const validSignal = {
  signalId: "11111111-1111-4111-8111-111111111111",
  timestamp: "2026-09-10T12:34:56.000Z",
  siteId: "PTY-BANK-01",
  type: "beaconing",
  score: 0.86,
  severityHint: "high",
  evidence: [
    {
      metric: "interArrivalCv",
      value: 0.04,
      reason: "queries are highly periodic",
    },
  ],
  source: "deterministic",
  incidentId: null,
};

describe("signalSchema", () => {
  it("accepts a deterministic evidenced signal", () => {
    expect(signalSchema.parse(validSignal)).toEqual(validSignal);
  });

  it("rejects signals without evidence or with a non-deterministic source", () => {
    expect(() =>
      signalSchema.parse({ ...validSignal, evidence: [] }),
    ).toThrow();
    expect(() =>
      signalSchema.parse({ ...validSignal, source: "qvac" }),
    ).toThrow();
  });
});

describe("siteWindowMetricsSchema", () => {
  it("accepts aggregated site-window metrics", () => {
    const metrics = {
      bucketStart: "2026-09-10T12:00:00.000Z",
      siteId: "COL-GOV-01",
      queryCount: 12,
      nxdomainCount: 1,
      nxdomainRatio: 0.08,
      latencyMedian: 57,
      latencyP95: 71,
      uniqueDomains: 6,
      meanEntropy: 3.1,
      periodicityScore: 0.2,
      saturation: 0.52,
    };

    expect(siteWindowMetricsSchema.parse(metrics)).toEqual(metrics);
  });
});
