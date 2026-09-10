import type { SeverityHint } from "@sentinel-adaptive/contracts";

const knownLabels: Record<string, string> = {
  possible_c2_beaconing: "Possible C2 Beaconing",
  possible_dns_tunneling: "Possible DNS Tunneling",
  possible_dga: "Possible DGA",
  possible_typosquatting: "Possible Typosquatting",
  baseline_deviation: "Baseline Deviation",
  beaconing: "Beaconing",
  tunneling: "Tunneling",
  dga: "DGA",
  typosquatting: "Typosquatting",
  high: "High",
  medium: "Medium",
  low: "Low",
  consistent: "Consistent",
  uncertain: "Uncertain",
  insufficient_evidence: "Insufficient Evidence",
  skipped: "Skipped",
  ok: "Assessed",
  invalid: "Invalid JSON",
  unavailable: "Unavailable",
  yes: "Yes",
  no: "No",
  unknown: "Unknown",
};

export function formatTime(iso: string): string {
  return `${iso.replace("T", " ").replace("Z", "")} UTC`;
}

const loneSeverityToken = /^(high|medium|low)$/i;

export function isLoneSeverityToken(value: string): boolean {
  return loneSeverityToken.test(value.trim());
}

export function qvacExplanation(rationale: string | undefined): string | undefined {
  const text = rationale?.trim();
  if (!text || isLoneSeverityToken(text)) {
    return undefined;
  }
  return text;
}

export function qvacConfidenceToken(
  rationale: string | undefined,
  confidence?: string,
): string | undefined {
  if (confidence && isLoneSeverityToken(confidence)) {
    return confidence.toLowerCase();
  }
  const text = rationale?.trim();
  if (text && isLoneSeverityToken(text)) {
    return text.toLowerCase();
  }
  return undefined;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatLatencyMs(value: number): string {
  return `${value.toFixed(2)} ms`;
}

export function formatEnumLabel(value: string): string {
  if (knownLabels[value]) {
    return knownLabels[value];
  }
  return value
    .split(/[_-]/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "c2") {
        return "C2";
      }
      if (lower === "dga") {
        return "DGA";
      }
      if (lower === "qoe") {
        return "QoE";
      }
      if (lower === "qvac") {
        return "QVAC";
      }
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

export function formatEvidenceValue(
  metric: string,
  value: string | number | boolean,
): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string") {
    return value;
  }
  const name = metric.toLowerCase();
  if (name.includes("latency") || name.endsWith("ms")) {
    return formatLatencyMs(value);
  }
  if (
    name.includes("ratio") ||
    name.includes("rate") ||
    name === "saturation" ||
    name === "availability" ||
    name === "capacity"
  ) {
    return formatPercent(value);
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2);
}

export function severityClass(severity: SeverityHint | string): string {
  if (severity === "high") {
    return "text-danger";
  }
  if (severity === "medium") {
    return "text-warning";
  }
  return "text-ink";
}

export function healthClass(state: string): string {
  if (state === "ok") {
    return "text-success";
  }
  if (state === "down") {
    return "text-danger";
  }
  return "text-muted";
}

const severityRank: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function compareIncidentSeverity(
  left: { severity: string; timestamp: string },
  right: { severity: string; timestamp: string },
): number {
  const rank =
    (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9);
  if (rank !== 0) {
    return rank;
  }
  return Date.parse(right.timestamp) - Date.parse(left.timestamp);
}
