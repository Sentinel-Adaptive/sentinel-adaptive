import { describe, expect, it } from "vitest";

import { dnsEventSchema } from "./index.js";

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
