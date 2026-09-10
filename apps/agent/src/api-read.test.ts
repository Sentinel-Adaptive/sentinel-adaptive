import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIncidentDetail, buildOverview } from "./api-read.js";
import { OperatorStore } from "./store.js";

describe("operator read models", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
