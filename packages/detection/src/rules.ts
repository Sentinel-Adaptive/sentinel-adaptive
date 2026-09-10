import { randomUUID } from "node:crypto";

import {
  signalSchema,
  type DnsEvent,
  type EvidenceItem,
  type SeverityHint,
  type Signal,
  type SignalType,
  type SiteId,
  type SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";

import type { SiteBaseline } from "./baseline.js";
import { nearestCanonical } from "./canonical-domains.js";
import { deviate } from "./deviation.js";
import { extractDomainFeatures } from "./domain-features.js";
import { summarizeDnsOutcomes } from "./dns-outcomes.js";
import { analyzePeriodicity } from "./periodicity.js";
import { clamp, mean } from "./stats.js";

const EMIT_THRESHOLD = 0.6;

export interface RuleInput {
  siteId: SiteId;
  events: readonly DnsEvent[];
  current?: SiteWindowMetrics;
  baseline: SiteBaseline;
  historyCount: number;
}

export function evaluateRules(input: RuleInput): Signal[] {
  if (input.events.length === 0) {
    return [];
  }

  return [
    ...beaconingRule(input),
    ...tunnelingRule(input),
    ...dgaRule(input),
    ...typosquatRule(input),
    ...baselineDeviationRule(input),
  ];
}

function beaconingRule(input: RuleInput): Signal[] {
  const periodicity = analyzePeriodicity(input.events);
  const dominantRatio =
    periodicity.queryCount === 0
      ? 0
      : periodicity.dominantQnameCount / periodicity.queryCount;
  if (
    periodicity.queryCount < 4 ||
    periodicity.interArrivalCv > 0.15 ||
    dominantRatio < 0.75 ||
    !periodicity.dominantQname
  ) {
    return [];
  }

  const score = clamp(
    0.72 + (0.15 - periodicity.interArrivalCv) + (dominantRatio - 0.75),
    0,
    1,
  );
  return maybeSignal(input, "beaconing", score, [
    evidence(
      "interArrivalCv",
      roundValue(periodicity.interArrivalCv),
      "queries are highly periodic",
    ),
    evidence(
      "queriesInWindow",
      periodicity.queryCount,
      "repeated communication",
    ),
    evidence(
      "dominantQname",
      periodicity.dominantQname,
      "recurring destination domain",
    ),
  ]);
}

function tunnelingRule(input: RuleInput): Signal[] {
  const features = input.events.map((event) => extractDomainFeatures(event.qname));
  const outcomes = summarizeDnsOutcomes(input.events);
  const periodicity = analyzePeriodicity(input.events);
  const meanLongest = mean(features.map((item) => item.longestLabelLength));
  const meanLabelEntropy = mean(
    features.map((item) => item.longestLabelEntropy),
  );
  const txtRatio =
    outcomes.queryCount === 0 ? 0 : outcomes.txtCount / outcomes.queryCount;
  const uniqueSubdomainRatio =
    periodicity.queryCount === 0
      ? 0
      : periodicity.uniqueSubdomainCount / periodicity.queryCount;

  if (
    meanLongest < 32 ||
    meanLabelEntropy < 3.2 ||
    (txtRatio < 0.4 && uniqueSubdomainRatio < 0.7)
  ) {
    return [];
  }

  const score = clamp(0.7 + Math.min(meanLongest / 80, 0.2), 0, 1);
  return maybeSignal(input, "tunneling", score, [
    evidence("longestLabelLength", roundValue(meanLongest), "labels are unusually long"),
    evidence(
      "longestLabelEntropy",
      roundValue(meanLabelEntropy),
      "label content is high-entropy",
    ),
    evidence(
      "uniqueSubdomainRate",
      roundValue(uniqueSubdomainRatio),
      "many unique subdomains under one parent",
    ),
  ]);
}

function dgaRule(input: RuleInput): Signal[] {
  const features = input.events.map((event) => extractDomainFeatures(event.qname));
  const outcomes = summarizeDnsOutcomes(input.events);
  const periodicity = analyzePeriodicity(input.events);
  const meanLabelEntropy = mean(
    features.map((item) => item.longestLabelEntropy),
  );
  const meanLabelLength = mean(features.map((item) => item.longestLabelLength));
  const uniqueRatio =
    periodicity.queryCount === 0
      ? 0
      : periodicity.uniqueQnameCount / periodicity.queryCount;

  if (
    outcomes.nxdomainRatio < 0.45 ||
    uniqueRatio < 0.7 ||
    meanLabelEntropy < 3 ||
    meanLabelLength < 16
  ) {
    return [];
  }

  const score = clamp(
    0.68 + outcomes.nxdomainRatio * 0.2 + uniqueRatio * 0.1,
    0,
    1,
  );
  return maybeSignal(input, "dga", score, [
    evidence(
      "nxdomainRatio",
      roundValue(outcomes.nxdomainRatio),
      "many generated-looking names fail to resolve",
    ),
    evidence(
      "uniqueQnameRatio",
      roundValue(uniqueRatio),
      "almost every query uses a distinct domain",
    ),
    evidence(
      "longestLabelEntropy",
      roundValue(meanLabelEntropy),
      "labels have an unusual lexical shape",
    ),
  ]);
}

function typosquatRule(input: RuleInput): Signal[] {
  const matches = new Map<string, { canonical: string; distance: number }>();
  for (const event of input.events) {
    const nearest = nearestCanonical(event.qname);
    if (nearest && nearest.distance > 0 && nearest.distance <= 2) {
      matches.set(event.qname, nearest);
    }
  }
  if (matches.size === 0) {
    return [];
  }

  const [qname, match] = [...matches.entries()][0] ?? [];
  if (!qname || !match) {
    return [];
  }

  return maybeSignal(input, "typosquatting", 0.82, [
    evidence("qname", qname, "query is a near-miss of a local canonical domain"),
    evidence("canonicalDomain", match.canonical, "matched against a local brand list only"),
    evidence("editDistance", match.distance, "edit distance is within two operations"),
  ]);
}

function baselineDeviationRule(input: RuleInput): Signal[] {
  if (!input.current || input.historyCount < 10) {
    return [];
  }

  const nxdomain = deviate(
    "nxdomainRatio",
    input.current.nxdomainRatio,
    input.baseline.nxdomainRatio,
  );
  const latency = deviate(
    "latencyP95",
    input.current.latencyP95,
    input.baseline.latencyP95,
  );
  const nxdomainHit = nxdomain.ratio >= 3 || nxdomain.zScore >= 2.5;
  const latencyHit = latency.ratio >= 3 || latency.zScore >= 2.5;
  if (!nxdomainHit && !latencyHit) {
    return [];
  }

  const strongest = nxdomainHit && nxdomain.ratio >= latency.ratio ? nxdomain : latency;
  const score = clamp(0.55 + Math.min(strongest.ratio / 10, 0.35), 0, 1);
  return maybeSignal(input, "baseline_deviation", score, [
    evidence(strongest.metric, roundValue(strongest.current), strongest.explanation),
    evidence(
      "baselineMean",
      roundValue(strongest.baselineMean),
      "compared with this site's own rolling baseline",
    ),
  ]);
}

function maybeSignal(
  input: RuleInput,
  type: SignalType,
  score: number,
  evidenceItems: EvidenceItem[],
): Signal[] {
  if (score < EMIT_THRESHOLD || evidenceItems.length === 0) {
    return [];
  }
  return [
    createSignal({
      timestamp: input.events[input.events.length - 1]?.timestamp ?? new Date().toISOString(),
      siteId: input.siteId,
      type,
      score: clamp(score, 0, 1),
      severityHint: severityHint(score),
      evidence: evidenceItems,
    }),
  ];
}

function severityHint(score: number): SeverityHint {
  if (score >= 0.75) {
    return "high";
  }
  if (score >= 0.5) {
    return "medium";
  }
  return "low";
}

function evidence(
  metric: string,
  value: EvidenceItem["value"],
  reason: string,
): EvidenceItem {
  return { metric, value, reason };
}

function createSignal(
  fields: Omit<Signal, "signalId" | "source" | "incidentId">,
): Signal {
  return signalSchema.parse({
    signalId: randomUUID(),
    source: "deterministic",
    incidentId: null,
    ...fields,
  });
}

function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}
