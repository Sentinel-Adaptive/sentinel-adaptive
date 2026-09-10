import {
  siteWindowMetricsSchema,
  type DnsEvent,
  type SiteId,
  type SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";

import { extractDomainFeatures } from "./domain-features.js";
import { summarizeDnsOutcomes } from "./dns-outcomes.js";
import { analyzePeriodicity } from "./periodicity.js";
import { mean, percentile } from "./stats.js";

export const BUCKET_MS = 10_000;
export const MAX_BUCKETS = 45;

export function bucketStartMs(timestamp: string | number): number {
  const value = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return Math.floor(value / BUCKET_MS) * BUCKET_MS;
}

export function buildBucketMetrics(
  siteId: SiteId,
  bucketStart: number,
  events: readonly DnsEvent[],
): SiteWindowMetrics {
  const outcomes = summarizeDnsOutcomes(events);
  const periodicity = analyzePeriodicity(events);
  const latencies = events.map((event) => event.latencyMs);
  const entropies = events.map(
    (event) => extractDomainFeatures(event.qname).shannonEntropy,
  );

  return siteWindowMetricsSchema.parse({
    bucketStart: new Date(bucketStart).toISOString(),
    siteId,
    queryCount: outcomes.queryCount,
    nxdomainCount: outcomes.nxdomainCount,
    nxdomainRatio: outcomes.nxdomainRatio,
    latencyMedian: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    uniqueDomains: outcomes.uniqueDomains,
    meanEntropy: mean(entropies),
    periodicityScore: periodicity.periodicityScore,
    saturation: outcomes.meanSaturation,
  });
}

export function windowCutoffMs(nowMs: number): number {
  return nowMs - MAX_BUCKETS * BUCKET_MS;
}
