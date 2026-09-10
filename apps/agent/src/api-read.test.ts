import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIncidentDetail, buildOverview } from "./api-read.js";
import { OperatorStore } from "./store.js";

describe("operator read models", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps latest QoE from ClickHouse without inventing values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const query = new URL(String(input)).searchParams.get("query") ?? "";
        if (query.includes("FROM site_metrics") && query.includes("GROUP BY")) {
          return new Response(
            [
              JSON.stringify({
                site_id: "PTY-BANK-01",
                latest_bucket: "2026-09-10 12:21:10.000",
                qoe_score: 0.956,
              }),
              JSON.stringify({
                site_id: "COL-GOV-01",
                latest_bucket: "2026-09-10 12:21:10.000",
                qoe_score: 0.746,
              }),
            ].join("\n"),
            { status: 200 },
          );
        }
        return new Response("", { status: 200 });
      }),
    );
    const overview = await buildOverview(new OperatorStore(), {
      url: "http://clickhouse.test:8123",
    });
    expect(overview.sites.find((site) => site.siteId === "PTY-BANK-01")?.latestQoe).toBe(
      0.956,
    );
    expect(overview.sites.find((site) => site.siteId === "COL-GOV-01")?.latestQoe).toBe(
      0.746,
    );
    expect(overview.sites.find((site) => site.siteId === "PTY-HEALTH-01")?.latestQoe).toBe(
      null,
    );
  });

  it("lists the three sites with empty incidents when ClickHouse is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 })),
    );
    const overview = await buildOverview(new OperatorStore(), {
      url: "http://clickhouse.test:8123",
    });
    expect(overview.sites.map((site) => site.siteId)).toEqual([
      "PTY-BANK-01",
      "PTY-HEALTH-01",
      "COL-GOV-01",
    ]);
    expect(overview.recentIncidents).toEqual([]);
    expect(overview.sites.every((site) => site.latestQoe === null)).toBe(true);
    expect(overview.sites.every((site) => site.incidentCount === 0)).toBe(true);
  });

  it("returns undefined for an unknown incident", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 })),
    );
    await expect(
      buildIncidentDetail(new OperatorStore(), "INC-0000000000000000", {
        url: "http://clickhouse.test:8123",
      }),
    ).resolves.toBeUndefined();
  });
});
