import { round } from "./stats.js";
import type { RollingStat } from "./baseline.js";

export interface MetricDeviation {
  metric: string;
  current: number;
  baselineMean: number;
  zScore: number;
  ratio: number;
  explanation: string;
}

export function deviate(
  metric: string,
  current: number,
  baseline: RollingStat,
): MetricDeviation {
  const zScore =
    baseline.stddev > 1e-9
      ? (current - baseline.mean) / baseline.stddev
      : current === baseline.mean
        ? 0
        : current > baseline.mean
          ? 8
          : -8;
  const ratio =
    baseline.mean > 1e-9 ? current / baseline.mean : current > 0 ? 8 : 1;
  const comparison = ratio >= 1 ? "above" : "below";
  const displayRatio = ratio >= 1 ? ratio : ratio === 0 ? 0 : 1 / ratio;

  return {
    metric,
    current,
    baselineMean: baseline.mean,
    zScore: round(zScore),
    ratio: round(ratio),
    explanation: `${metric} is ${displayRatio.toFixed(1)}× ${comparison} this site's normal level`,
  };
}
