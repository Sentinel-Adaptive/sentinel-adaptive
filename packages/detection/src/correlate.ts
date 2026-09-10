import { createHash } from "node:crypto";

import {
  incidentSchema,
  signalSchema,
  signalTypeClassifications,
  type Incident,
  type QvacResult,
  type Signal,
  type SiteId,
} from "@sentinel-adaptive/contracts";

export const CORRELATION_WINDOW_MS = 60_000;

const entityMetrics = new Set(["dominantQname", "qname", "canonicalDomain"]);

export function correlationWindowStartMs(timestamp: string): number {
  const value = Date.parse(timestamp);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return Math.floor(value / CORRELATION_WINDOW_MS) * CORRELATION_WINDOW_MS;
}

export function incidentIdForWindow(
  siteId: SiteId,
  windowStartMs: number,
): string {
  const hex = createHash("sha1")
    .update(`${siteId}|${windowStartMs}`)
    .digest("hex");
  return `INC-${hex.slice(0, 16).toUpperCase()}`;
}

export function affectedEntities(signal: Pick<Signal, "evidence">): string[] {
  const values = new Set<string>();
  for (const item of signal.evidence) {
    if (entityMetrics.has(item.metric) && typeof item.value === "string") {
      values.add(item.value);
    }
  }
  return [...values].sort();
}

export class IncidentCorrelator {
  private readonly open = new Map<
    string,
    { windowStartMs: number; members: Map<string, Signal> }
  >();

  ingest(
    signals: readonly Signal[],
    qvac: readonly QvacResult[] = [],
  ): Incident[] {
    const changed = new Set<string>();

    for (const signal of signals) {
      const windowStartMs = correlationWindowStartMs(signal.timestamp);
      const incidentId = incidentIdForWindow(signal.siteId, windowStartMs);
      const current = this.open.get(incidentId) ?? {
        windowStartMs,
        members: new Map<string, Signal>(),
      };
      if (current.members.has(signal.signalId)) {
        this.open.set(incidentId, current);
        continue;
      }
      current.members.set(
        signal.signalId,
        signalSchema.parse({ ...signal, incidentId }),
      );
      this.open.set(incidentId, current);
      changed.add(incidentId);
    }

    return [...changed].map((incidentId) => {
      const current = this.open.get(incidentId);
      if (!current) {
        throw new Error(`Missing correlated incident ${incidentId}`);
      }
      return buildIncident(
        incidentId,
        current.windowStartMs,
        [...current.members.values()],
        qvac,
      );
    });
  }

  membersOf(incidentId: string): Signal[] {
    return [...(this.open.get(incidentId)?.members.values() ?? [])];
  }
}

export function correlateSignals(
  signals: readonly Signal[],
  qvac: readonly QvacResult[] = [],
): Incident[] {
  return new IncidentCorrelator().ingest(signals, qvac);
}

function buildIncident(
  incidentId: string,
  windowStartMs: number,
  members: readonly Signal[],
  qvac: readonly QvacResult[],
): Incident {
  const ordered = [...members].sort(compareSignals);
  const lead = ordered[0];
  if (!lead) {
    throw new Error("Cannot build an incident without signals.");
  }
  const types = [...new Set(ordered.map((signal) => signal.type))].sort();
  const entities = [
    ...new Set(ordered.flatMap((signal) => affectedEntities(signal))),
  ].sort();
  const memberIds = new Set(ordered.map((signal) => signal.signalId));
  const attached = qvac.filter((result) => memberIds.has(result.signalId));
  const reason = lead.evidence[0]?.reason ?? "deterministic detection evidence";
  const typeLabel = types.join(", ");

  return incidentSchema.parse({
    incidentId,
    timestamp: ordered
      .map((signal) => signal.timestamp)
      .sort()
      .at(-1),
    windowStart: new Date(windowStartMs).toISOString(),
    siteId: lead.siteId,
    classification: signalTypeClassifications[lead.type],
    severity: lead.severityHint,
    confidence: lead.score,
    signalCount: ordered.length,
    signalIds: ordered.map((signal) => signal.signalId),
    types,
    affectedEntities: entities,
    summary: truncate(
      `${ordered.length} correlated ${typeLabel} signal(s) on ${lead.siteId}: ${reason}`,
      500,
    ),
    ...(attached.length > 0 ? { qvac: attached } : {}),
  });
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function compareSignals(left: Signal, right: Signal): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  const typeOrder = left.type.localeCompare(right.type);
  if (typeOrder !== 0) {
    return typeOrder;
  }
  return left.signalId.localeCompare(right.signalId);
}
