import {
  qvacAmbiguousMax,
  qvacAmbiguousMin,
  type Signal,
} from "@sentinel-adaptive/contracts";

export { qvacAmbiguousMax, qvacAmbiguousMin };

export function isAmbiguousSignal(signal: Pick<Signal, "score">): boolean {
  return signal.score >= qvacAmbiguousMin && signal.score < qvacAmbiguousMax;
}

export function evidenceBundle(signal: Signal): {
  siteId: Signal["siteId"];
  type: Signal["type"];
  score: number;
  severityHint: Signal["severityHint"];
  evidence: Signal["evidence"];
} {
  return {
    siteId: signal.siteId,
    type: signal.type,
    score: signal.score,
    severityHint: signal.severityHint,
    evidence: signal.evidence,
  };
}
