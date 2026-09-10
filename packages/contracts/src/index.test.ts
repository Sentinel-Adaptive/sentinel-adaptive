import { describe, expect, it } from "vitest";

import {
  dnsEventSchema,
  signalSchema,
  siteQoeSchema,
  siteWindowMetricsSchema,
  wazuhIncidentEventSchema,
  qvacAssessmentSchema,
  qvacResultSchema,
  incidentSchema,
  systemStatusSchema,
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

  it("accepts a correlated incident identifier without dropping evidence", () => {
    expect(
      signalSchema.parse({
        ...validSignal,
        incidentId: "INC-0123456789ABCDEF",
      }).incidentId,
    ).toBe("INC-0123456789ABCDEF");
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

describe("qvacAssessmentSchema", () => {
  it("accepts a cautious evidence-only assessment", () => {
    const assessment = {
      assessment: "uncertain",
      rationale: "NXDOMAIN ratio is elevated but the supplied window is short.",
      usedEvidence: ["nxdomainRatio"],
    };
    expect(qvacAssessmentSchema.parse(assessment)).toEqual(assessment);
    expect(
      qvacAssessmentSchema.parse({
        ...assessment,
        confidence: "high",
      }).confidence,
    ).toBe("high");
  });

  it("rejects empty usedEvidence or extra fields", () => {
    expect(() =>
      qvacAssessmentSchema.parse({
        assessment: "consistent",
        rationale: "matches supplied metrics",
        usedEvidence: [],
      }),
    ).toThrow();
    expect(() =>
      qvacAssessmentSchema.parse({
        assessment: "consistent",
        rationale: "matches supplied metrics",
        usedEvidence: ["nxdomainRatio"],
        malwareFamily: "invented",
      }),
    ).toThrow();
  });
});

describe("qvacResultSchema", () => {
  it("accepts skipped and ok results with the matching payload", () => {
    expect(
      qvacResultSchema.parse({
        signalId: validSignal.signalId,
        status: "skipped",
      }).status,
    ).toBe("skipped");
    expect(
      qvacResultSchema.parse({
        signalId: validSignal.signalId,
        status: "ok",
        assessment: {
          assessment: "uncertain",
          rationale: "periodicity is present but the window is short",
          usedEvidence: ["interArrivalCv"],
        },
      }).status,
    ).toBe("ok");
  });

  it("rejects an ok result without assessment", () => {
    expect(() =>
      qvacResultSchema.parse({
        signalId: validSignal.signalId,
        status: "ok",
      }),
    ).toThrow();
  });
});

describe("incidentSchema", () => {
  it("accepts a correlated multi-signal incident", () => {
    const incident = {
      incidentId: "INC-0123456789ABCDEF",
      timestamp: "2026-09-10T12:00:20.000Z",
      windowStart: "2026-09-10T12:00:00.000Z",
      siteId: "PTY-BANK-01",
      classification: "possible_dga",
      severity: "high",
      confidence: 0.9,
      signalCount: 2,
      signalIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      types: ["dga", "tunneling"],
      affectedEntities: ["c2.secure-bank.test"],
      summary:
        "2 correlated dga, tunneling signal(s) on PTY-BANK-01: many names fail to resolve",
    };
    expect(incidentSchema.parse(incident)).toEqual(incident);
  });
});

describe("systemStatusSchema", () => {
  it("records local-only QVAC and forbids cloud inference", () => {
    const status = {
      tracks: ["03", "04"] as const,
      qvac: {
        sdk: "0.19.0" as const,
        inference: "0.19.0" as const,
        model: "LLAMA_3_2_1B_INST_Q4_0" as const,
        localOnly: true,
      },
      cloudInference: false as const,
      services: {
        kafka: "ok" as const,
        clickhouse: "ok" as const,
        grafana: "unknown" as const,
        wazuh: "down" as const,
      },
    };
    expect(systemStatusSchema.parse(status)).toEqual(status);
    expect(() =>
      systemStatusSchema.parse({ ...status, cloudInference: true }),
    ).toThrow();
  });
});
