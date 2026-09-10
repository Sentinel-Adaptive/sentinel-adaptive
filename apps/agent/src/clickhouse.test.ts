import { afterEach, describe, expect, it, vi } from "vitest";

import { generateScenario } from "@sentinel-adaptive/generator";
import { collectSiteWindows, correlateSignals, processEvents } from "@sentinel-adaptive/detection";

import {
  persistIncidents,
  persistTelemetry,
  toClickHouseDateTime,
} from "./clickhouse.js";

describe("ClickHouse datetime mapping", () => {
  it("stores UTC event time without a timezone suffix", () => {
    expect(toClickHouseDateTime("2026-09-10T12:00:00.000Z")).toBe(
      "2026-09-10 12:00:00.000",
    );
  });
});

describe("ClickHouse persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates telemetry tables and inserts DNS events plus scored site windows", async () => {
    const requests: Array<{ query: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push({
          query: url.searchParams.get("query") ?? "",
          body:
            typeof init?.body === "string" ? init.body : undefined,
        });
        return new Response("", { status: 200 });
      }),
    );

    const events = generateScenario({
      scenario: "normal",
      count: 12,
      siteId: "PTY-BANK-01",
      seed: 4_104,
    });

    await persistTelemetry(events, collectSiteWindows(events), {
      url: "http://clickhouse.test:8123",
    });

    expect(
      requests.some((request) =>
        request.query.includes("CREATE TABLE IF NOT EXISTS dns_events"),
      ),
    ).toBe(false);
    expect(
      requests.some((request) =>
        request.query.startsWith("INSERT INTO dns_events"),
      ),
    ).toBe(true);
    expect(
      requests.some(
        (request) =>
          request.query.startsWith("INSERT INTO site_metrics") &&
          (request.body?.includes("qoe_score") ?? false),
      ),
    ).toBe(true);
    expect(requests.some((request) => request.body?.includes("PTY-BANK-01"))).toBe(
      true,
    );
  });

  it("inserts correlated incidents", async () => {
    const requests: Array<{ query: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push({
          query: url.searchParams.get("query") ?? "",
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        return new Response("", { status: 200 });
      }),
    );

    const incidents = correlateSignals(
      processEvents(generateScenario({ scenario: "dga", count: 20 })).filter(
        (signal) => signal.type === "dga",
      ),
    );
    await persistIncidents(incidents, { url: "http://clickhouse.test:8123" });
    expect(
      requests.some(
        (request) =>
          request.query.startsWith("INSERT INTO incidents") &&
          (request.body?.includes(incidents[0]?.incidentId ?? "") ?? false),
      ),
    ).toBe(true);
  });
});
