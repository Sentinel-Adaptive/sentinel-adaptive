import type { DnsEvent } from "@sentinel-adaptive/contracts";

import { splitLabels } from "./domain-features.js";
import { mean, stddev } from "./stats.js";

export interface PeriodicityStats {
  queryCount: number;
  meanInterArrivalMs: number;
  interArrivalStddevMs: number;
  interArrivalCv: number;
  periodicityScore: number;
  repeatedQueryCount: number;
  uniqueSubdomainCount: number;
  uniqueQnameCount: number;
  dominantQname: string | null;
  dominantQnameCount: number;
  dominantClientIp: string | null;
}

export function analyzePeriodicity(
  events: readonly DnsEvent[],
): PeriodicityStats {
  const timestamps = events
    .map((event) => Date.parse(event.timestamp))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const intervals: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    intervals.push((timestamps[index] ?? 0) - (timestamps[index - 1] ?? 0));
  }

  const meanInterArrivalMs = mean(intervals);
  const interArrivalStddevMs = stddev(intervals);
  const interArrivalCv =
    meanInterArrivalMs > 0 ? interArrivalStddevMs / meanInterArrivalMs : 0;
  const qnameCounts = new Map<string, number>();
  const clientCounts = new Map<string, number>();
  const subdomains = new Set<string>();

  for (const event of events) {
    qnameCounts.set(event.qname, (qnameCounts.get(event.qname) ?? 0) + 1);
    clientCounts.set(event.clientIp, (clientCounts.get(event.clientIp) ?? 0) + 1);
    const labels = splitLabels(event.qname);
    if (labels.length > 0) {
      subdomains.add(labels[0] ?? event.qname);
    }
  }

  const dominantQname = dominantKey(qnameCounts);
  const dominantClientIp = dominantKey(clientCounts);
  const repeatedQueryCount = [...qnameCounts.values()].filter(
    (count) => count > 1,
  ).reduce((total, count) => total + count, 0);

  return {
    queryCount: events.length,
    meanInterArrivalMs,
    interArrivalStddevMs,
    interArrivalCv,
    periodicityScore:
      intervals.length === 0 ? 0 : 1 / (1 + interArrivalCv),
    repeatedQueryCount,
    uniqueSubdomainCount: subdomains.size,
    uniqueQnameCount: qnameCounts.size,
    dominantQname,
    dominantQnameCount: dominantQname ? (qnameCounts.get(dominantQname) ?? 0) : 0,
    dominantClientIp,
  };
}

function dominantKey(counts: Map<string, number>): string | null {
  let winner: string | null = null;
  let highest = 0;
  for (const [key, count] of counts) {
    if (count > highest) {
      winner = key;
      highest = count;
    }
  }
  return winner;
}
