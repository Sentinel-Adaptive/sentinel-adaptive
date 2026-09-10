import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { processEvents } from "@sentinel-adaptive/detection";
import { generateScenario } from "@sentinel-adaptive/generator";
import type { DnsEvent } from "@sentinel-adaptive/contracts";

import { siteIdForClientIp, toReplayEvent } from "./enrich.js";
import {
  bindTimestampToIsoUtc,
  normalizeQtype,
  parseBindQueryLine,
} from "./parse.js";
import { replayOvnicomLogs } from "./replay.js";

const fixtureFile = fileURLToPath(
  new URL("./fixtures/bind-queries.txt", import.meta.url),
);

describe("BIND query parsing", () => {
  it("extracts timestamp, client IP, qname, and qtype from a valid line", () => {
    const parsed = parseBindQueryLine(
      "09-Sep-2026 08:04:59.901 queries: info: client @0x7fa2c438edf0 192.0.2.10#35082 (portal.example.test): query: portal.example.test IN A + (203.0.113.53)",
    );

    expect(parsed).toMatchObject({
      timestamp: "2026-09-09T08:04:59.901Z",
      clientIp: "192.0.2.10",
      clientPort: 35082,
      qname: "portal.example.test",
      qtype: "A",
      resolverId: "203.0.113.53",
    });
    expect(bindTimestampToIsoUtc("09-Sep-2026 08:04:59.901")).toBe(
      "2026-09-09T08:04:59.901Z",
    );
  });

  it("normalizes BIND TYPE65/TYPE64 codes and keeps single-label names", () => {
    expect(normalizeQtype("TYPE65")).toBe("HTTPS");
    expect(normalizeQtype("TYPE64")).toBe("SVCB");
    expect(normalizeQtype("PTR")).toBe("PTR");

    const parsed = parseBindQueryLine(
      "09-Sep-2026 08:04:59.912 queries: info: client @0x7fa2c438edf0 192.0.2.10#56836 (unifi): query: unifi IN A + (203.0.113.53)",
    );
    expect(parsed?.qname).toBe("unifi");
    expect(
      parseBindQueryLine(
        "09-Sep-2026 08:04:59.937 queries: info: client @0x7fa2d53e0c30 198.51.100.20#30200 (app.example.test): query: app.example.test IN TYPE65 + (203.0.113.53)",
      )?.qtype,
    ).toBe("HTTPS");
  });

  it("skips malformed lines", () => {
    expect(parseBindQueryLine("")).toBeUndefined();
    expect(parseBindQueryLine("not a bind query line")).toBeUndefined();
    expect(
      parseBindQueryLine("09-Sep-2026 08:05:00.050 queries: info: broken"),
    ).toBeUndefined();
  });
});

describe("synthetic enrichment and provenance", () => {
  it("maps the same client IP to the same fictional site", () => {
    expect(siteIdForClientIp("192.0.2.10")).toBe(siteIdForClientIp("192.0.2.10"));
    expect(siteIdForClientIp("192.0.2.10")).not.toBe(
      siteIdForClientIp("198.51.100.20"),
    );
  });

  it("marks contract-required fields as enriched, not source-derived", () => {
    const parsed = parseBindQueryLine(
      "09-Sep-2026 08:04:59.901 queries: info: client @0x7fa2c438edf0 192.0.2.10#35082 (portal.example.test): query: portal.example.test IN A + (203.0.113.53)",
    );
    expect(parsed).toBeDefined();
    const event = toReplayEvent(parsed!, "queries.0", 1);

    expect(event?.source).toBe("ovnicom-challenge");
    expect(event?.synthetic).toBe(false);
    expect(event?.scenarioTag).toBe("background");
    expect(event?.rcode).toBe("NOERROR");
    expect(event?.provenance).toEqual({
      originalFile: "queries.0",
      originalLine: 1,
      enrichedFields: [
        "siteId",
        "zone",
        "latencyMs",
        "saturation",
        "rcode",
        "scenarioTag",
      ],
    });
    expect(event?.generator).toBeUndefined();
  });
});

describe("Kafka replay and Stage 3 compatibility", () => {
  it("streams fixture lines, skips malformed records, and publishes valid events", async () => {
    const published: DnsEvent[] = [];
    const stats = await replayOvnicomLogs({
      path: fixtureFile,
      limit: 100,
      intervalMs: 0,
      publish: async (events) => {
        published.push(...events);
      },
    });

    expect(stats.published).toBe(7);
    expect(stats.skipped).toBe(2);
    expect(stats.linesRead).toBe(10);
    expect(published).toHaveLength(7);
    expect(published.every((event) => event.source === "ovnicom-challenge")).toBe(
      true,
    );
    expect(new Set(published.filter((event) => event.clientIp === "192.0.2.10").map((event) => event.siteId)).size).toBe(1);
  });

  it("does not load a directory of query files by concatenating them first", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-ovnicom-"));
    mkdirSync(path.join(directory, "LogsDNSQueries"));
    writeFileSync(
      path.join(directory, "LogsDNSQueries", "queries.0"),
      "09-Sep-2026 08:04:59.901 queries: info: client @0x7fa2c438edf0 192.0.2.10#35082 (portal.example.test): query: portal.example.test IN A + (203.0.113.53)\n",
    );
    writeFileSync(
      path.join(directory, "LogsDNSQueries", "queries.1"),
      "09-Sep-2026 08:04:59.912 queries: info: client @0x7fa2c438edf0 192.0.2.11#56836 (unifi): query: unifi IN A + (203.0.113.53)\n",
    );

    const published: DnsEvent[] = [];
    const stats = await replayOvnicomLogs({
      path: directory,
      limit: 2,
      publish: async (events) => {
        published.push(...events);
      },
    });

    expect(stats.files).toBe(2);
    expect(stats.published).toBe(2);
    expect(published.map((event) => event.qname)).toEqual([
      "portal.example.test",
      "unifi",
    ]);
  });

  it("lets Stage 3 process replayed background traffic and still detect a synthetic DGA burst", async () => {
    const published: DnsEvent[] = [];
    await replayOvnicomLogs({
      path: fixtureFile,
      limit: 100,
      publish: async (events) => {
        published.push(...events);
      },
    });

    const backgroundSignals = processEvents(published);
    expect(
      backgroundSignals.some((signal) => signal.severityHint === "high"),
    ).toBe(false);

    const mixed = [
      ...published,
      ...generateScenario({ scenario: "dga", count: 20, seed: 3_500_001 }),
    ];
    const mixedSignals = processEvents(mixed);
    expect(mixedSignals.some((signal) => signal.type === "dga")).toBe(true);
  });
});
