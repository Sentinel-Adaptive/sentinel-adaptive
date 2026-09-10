import { describe, expect, it } from "vitest";

import { rollingStat } from "./baseline.js";
import { deviate } from "./deviation.js";
import { percentile } from "./stats.js";
import { BUCKET_MS, bucketStartMs } from "./window.js";

describe("window buckets", () => {
  it("aligns timestamps to 10-second demo buckets", () => {
    expect(bucketStartMs("2026-09-10T12:00:07.000Z")).toBe(
      Date.parse("2026-09-10T12:00:00.000Z"),
    );
    expect(bucketStartMs("2026-09-10T12:00:10.000Z")).toBe(
      Date.parse("2026-09-10T12:00:10.000Z"),
    );
    expect(BUCKET_MS).toBe(10_000);
  });
});

describe("latency percentiles", () => {
  it("computes p50 and p95 from ordered samples", () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentile(values, 50)).toBe(30);
    expect(percentile(values, 95)).toBe(48);
  });
});

describe("per-site NXDOMAIN deviation", () => {
  it("interprets the same current ratio differently for two site histories", () => {
    const current = 0.2;
    const bankHistory = Array.from({ length: 30 }, (_, index) =>
      0.01 + (index % 2 === 0 ? 0.002 : -0.001),
    );
    const govHistory = Array.from({ length: 30 }, (_, index) =>
      0.08 + (index % 2 === 0 ? 0.004 : -0.003),
    );

    const bank = deviate("nxdomainRatio", current, rollingStat(bankHistory));
    const gov = deviate("nxdomainRatio", current, rollingStat(govHistory));

    expect(bank.ratio).toBeGreaterThan(gov.ratio);
    expect(bank.zScore).toBeGreaterThan(gov.zScore);
    expect(bank.explanation).toMatch(/above this site's normal level/);
    expect(gov.explanation).toMatch(/above this site's normal level/);
  });
});
