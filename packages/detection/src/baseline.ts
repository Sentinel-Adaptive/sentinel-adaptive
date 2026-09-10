import type { SiteWindowMetrics } from "@sentinel-adaptive/contracts";

import { mean, stddev } from "./stats.js";

export interface RollingStat {
  mean: number;
  stddev: number;
  samples: number;
}

export interface SiteBaseline {
  queryCount: RollingStat;
  nxdomainRatio: RollingStat;
  latencyMedian: RollingStat;
  latencyP95: RollingStat;
  uniqueDomains: RollingStat;
  meanEntropy: RollingStat;
  periodicityScore: RollingStat;
}

export function rollingStat(values: readonly number[]): RollingStat {
  return {
    mean: mean(values),
    stddev: stddev(values),
    samples: values.length,
  };
}

export function computeBaseline(
  buckets: readonly SiteWindowMetrics[],
): SiteBaseline {
  return {
    queryCount: rollingStat(buckets.map((bucket) => bucket.queryCount)),
    nxdomainRatio: rollingStat(buckets.map((bucket) => bucket.nxdomainRatio)),
    latencyMedian: rollingStat(buckets.map((bucket) => bucket.latencyMedian)),
    latencyP95: rollingStat(buckets.map((bucket) => bucket.latencyP95)),
    uniqueDomains: rollingStat(buckets.map((bucket) => bucket.uniqueDomains)),
    meanEntropy: rollingStat(buckets.map((bucket) => bucket.meanEntropy)),
    periodicityScore: rollingStat(
      buckets.map((bucket) => bucket.periodicityScore),
    ),
  };
}
