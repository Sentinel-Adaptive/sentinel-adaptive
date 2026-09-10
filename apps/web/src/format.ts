import type { SeverityHint } from "@sentinel-adaptive/contracts";

export function formatTime(iso: string): string {
  return `${iso.replace("T", " ").replace("Z", "")} UTC`;
}

export function formatRatio(value: number): string {
  return value.toFixed(3);
}

export function formatScore(value: number): string {
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
