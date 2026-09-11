import { translateKnown, type Translate } from "./i18n.js";
import { en, type MessageKey } from "./locales/en.js";

const evidenceReasonKeys: Record<string, MessageKey> = {
  "queries are highly periodic": "reason.periodicQueries",
  "repeated communication": "reason.repeatedCommunication",
  "recurring destination domain": "reason.recurringDestination",
  "labels are unusually long": "reason.longLabels",
  "label content is high-entropy": "reason.highEntropy",
  "many unique subdomains under one parent": "reason.uniqueSubdomains",
  "many generated-looking names fail to resolve": "reason.generatedNxdomain",
  "almost every query uses a distinct domain": "reason.distinctDomains",
  "almost every query uses a distinct name": "reason.distinctNames",
  "labels have an unusual lexical shape": "reason.lexicalShape",
  "query is a near-miss of a local canonical domain": "reason.nearMiss",
  "matched against a local brand list only": "reason.localBrandList",
  "edit distance is within two operations": "reason.editDistance",
  "compared with this site's own rolling baseline": "reason.siteBaseline",
  "many names in this window fail to resolve": "reason.windowNxdomain",
  "deterministic detection evidence": "reason.deterministicFallback",
};

const correlatedSummary =
  /^(\d+) correlated (.+) signal\(s\) on ([A-Z0-9-]+): (.+)$/;
const deviationReason =
  /^(\w+) is ([\d.]+)× (above|below) this site's normal level$/;

export function hasMessageKey(key: string): key is MessageKey {
  return key in en;
}

export function translateEvidenceReason(t: Translate, reason: string): string {
  const mapped = evidenceReasonKeys[reason];
  if (mapped) {
    return t(mapped);
  }
  const deviation = deviationReason.exec(reason);
  if (deviation?.[1] && deviation[2] && deviation[3]) {
    const metric = translateKnown(t, "metric", deviation[1]);
    return t(
      deviation[3] === "above" ? "reason.deviationAbove" : "reason.deviationBelow",
      { metric, factor: deviation[2] },
    );
  }
  return reason;
}

export function translateIncidentSummary(t: Translate, summary: string): string {
  const match = correlatedSummary.exec(summary);
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
    return translateEvidenceReason(t, summary);
  }
  const types = match[2]
    .split(", ")
    .map((type) => translateKnown(t, "enum", type))
    .join(", ");
  return t("incident.correlatedSummary", {
    count: match[1],
    types,
    site: match[3],
    reason: translateEvidenceReason(t, match[4]),
  });
}

export function translateSimulationError(
  t: Translate,
  error: string | undefined,
): string | undefined {
  if (!error) {
    return undefined;
  }
  const key = `simulation.error.${error}`;
  if (hasMessageKey(key)) {
    return t(key);
  }
  return error;
}
