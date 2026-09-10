import {
  qoeWeights,
  siteQoeSchema,
  type SiteQoe,
  type SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";

import { computeBaseline, type SiteBaseline } from "./baseline.js";
import { clamp, round } from "./stats.js";

const EPSILON = 1e-9;

export { qoeWeights };

export function calculateQoe(
  current: SiteWindowMetrics,
  baseline?: Pick<SiteBaseline, "latencyP95">,
): SiteQoe {
  const availability = clamp(1 - current.nxdomainRatio, 0, 1);
  const baselineLatency = baseline?.latencyP95.mean ?? 0;
  const latencyFactor =
    baselineLatency > EPSILON
      ? clamp(baselineLatency / Math.max(current.latencyP95, EPSILON), 0, 1)
      : 1;
  const capacity = clamp(1 - current.saturation, 0, 1);
  const score = clamp(
    qoeWeights.availability * availability +
      qoeWeights.latency * latencyFactor +
      qoeWeights.capacity * capacity,
    0,
    1,
  );

  return siteQoeSchema.parse({
    score: round(score),
    availability: round(availability),
    latencyFactor: round(latencyFactor),
    capacity: round(capacity),
    weights: qoeWeights,
    explanation:
      `QoE ${round(score).toFixed(2)} = ${qoeWeights.availability.toFixed(2)}×availability ${round(availability).toFixed(2)} ` +
      `+ ${qoeWeights.latency.toFixed(2)}×latencyFactor ${round(latencyFactor).toFixed(2)} ` +
      `+ ${qoeWeights.capacity.toFixed(2)}×capacity ${round(capacity).toFixed(2)}`,
  });
}

export function qoeForWindows(
  windows: readonly SiteWindowMetrics[],
): ReadonlyArray<{ metrics: SiteWindowMetrics; qoe: SiteQoe }> {
  const grouped = new Map<SiteWindowMetrics["siteId"], SiteWindowMetrics[]>();

  for (const window of [...windows].sort(
    (left, right) =>
      Date.parse(left.bucketStart) - Date.parse(right.bucketStart),
  )) {
    const existing = grouped.get(window.siteId) ?? [];
    existing.push(window);
    grouped.set(window.siteId, existing);
  }

  const scored: Array<{ metrics: SiteWindowMetrics; qoe: SiteQoe }> = [];
  for (const siteWindows of grouped.values()) {
    for (let index = 0; index < siteWindows.length; index += 1) {
      const current = siteWindows[index];
      if (!current) {
        continue;
      }
      const history = siteWindows.slice(0, index);
      scored.push({
        metrics: current,
        qoe: calculateQoe(
          current,
          history.length > 0 ? computeBaseline(history) : undefined,
        ),
      });
    }
  }

  return scored.sort(
    (left, right) =>
      Date.parse(left.metrics.bucketStart) -
      Date.parse(right.metrics.bucketStart),
  );
}
