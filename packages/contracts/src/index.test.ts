import { describe, expect, it } from "vitest";

import {
  dnsEventSchema,
  signalSchema,
  siteQoeSchema,
  siteWindowMetricsSchema,
  wazuhIncidentEventSchema,
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
  source: "sentinel-synthetic",
  synthetic: true,
  saturation: 0.2,
  generator: {
    seed: 424242,
    sequence: 0,
  },
  provenance: {
    scenario: "normal",
  },
};

describe("dnsEventSchema", () => {
  it("accepts a fully tagged synthetic DNS event", () => {
    expect(dnsEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("accepts challenge-replay events with explicit provenance", () => {
    const challengeEvent = {
      timestamp: "2026-09-09T08:04:59.901Z",
      siteId: "PTY-BANK-01",
      zone: "banking-east",
      clientIp: "192.0.2.10",
      qname: "unifi",
      qtype: "HTTPS",
      rcode: "NOERROR",
      latencyMs: 18,
      resolverId: "172.19.1.2",
      scenarioTag: "background",
      source: "ovnicom-challenge",
      synthetic: false,
      saturation: 0.18,
      provenance: {
        originalFile: "queries.0",
        originalLine: 1,
        enrichedFields: ["siteId", "zone", "latencyMs", "saturation", "rcode", "scenarioTag"],
      },
    };

    expect(dnsEventSchema.parse(challengeEvent)).toEqual(challengeEvent);
  });

  it("rejects untagged telemetry and unknown sources", () => {
    expect(() =>
      dnsEventSchema.parse({ ...validEvent, source: "customer-prod" }),
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

describe("siteQoeSchema", () => {
  it("accepts a transparent weighted QoE breakdown", () => {
    const qoe = {
      score: 0.91,
      availability: 0.99,
      latencyFactor: 1,
      capacity: 0.82,
      weights: {
        availability: 0.45,
        latency: 0.35,
        capacity: 0.2,
      },
      explanation:
        "QoE combines availability, latency versus this site's baseline, and unused capacity.",
    };

    expect(siteQoeSchema.parse(qoe)).toEqual(qoe);
  });
});

describe("wazuhIncidentEventSchema", () => {
  it("accepts the monitored JSON incident shape", () => {
    const event = {
      source: "sentinel-adaptive",
      event_type: "dns_security_incident",
      incident_id: "INC-1111111111114111",
      site_id: "PTY-BANK-01",
      classification: "possible_dga",
      severity: "high",
      confidence: 0.86,
      signal_count: 1,
      summary: "Deterministic dga signal on PTY-BANK-01: many generated-looking names fail to resolve",
      signal_id: "11111111-1111-4111-8111-111111111111",
    };

    expect(wazuhIncidentEventSchema.parse(event)).toEqual(event);
  });
});
