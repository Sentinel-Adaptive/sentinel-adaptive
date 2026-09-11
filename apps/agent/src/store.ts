import {
  incidentSchema,
  qvacResultSchema,
  signalSchema,
  siteIds,
  siteWindowMetricsSchema,
  type Incident,
  type QvacResult,
  type Signal,
  type SimulationJob,
  type SiteId,
  type SiteWindowMetrics,
} from "@sentinel-adaptive/contracts";

export type OperatorEvent =
  | { type: "incident"; incidentId: string }
  | { type: "qvac"; signalId: string }
  | { type: "job"; jobId: string };

export class OperatorStore {
  private readonly incidents = new Map<string, Incident>();
  private readonly signals = new Map<string, Signal>();
  private readonly qvac = new Map<string, QvacResult>();
  private readonly wazuhEmitted = new Set<string>();
  private readonly jobs = new Map<string, SimulationJob>();
  private readonly listeners = new Set<(event: OperatorEvent) => void>();

  recordIncidents(incidents: readonly Incident[], members: readonly Signal[]): void {
    for (const incident of incidents) {
      this.incidents.set(incident.incidentId, incident);
    }
    for (const signal of members) {
      this.signals.set(signal.signalId, signal);
    }
    for (const incident of incidents) {
      this.emit({ type: "incident", incidentId: incident.incidentId });
    }
  }

  recordQvac(results: readonly QvacResult[]): void {
    for (const result of results) {
      this.qvac.set(result.signalId, result);
      this.emit({ type: "qvac", signalId: result.signalId });
    }
  }

  markWazuhEmitted(incidentIds: readonly string[]): void {
    for (const incidentId of incidentIds) {
      this.wazuhEmitted.add(incidentId);
    }
  }

  recordJob(job: SimulationJob): void {
    this.jobs.set(job.id, job);
    this.emit({ type: "job", jobId: job.id });
  }

  listJobs(): SimulationJob[] {
    return [...this.jobs.values()].sort(
      (left, right) =>
        Date.parse(right.startedAt) - Date.parse(left.startedAt),
    );
  }

  getJob(jobId: string): SimulationJob | undefined {
    return this.jobs.get(jobId);
  }

  listIncidents(): Incident[] {
    return [...this.incidents.values()].sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
  }

  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  signalsFor(incidentId: string): Signal[] {
    return [...this.signals.values()].filter(
      (signal) => signal.incidentId === incidentId,
    );
  }

  qvacFor(signalIds: readonly string[]): QvacResult[] {
    return signalIds.flatMap((signalId) => {
      const result = this.qvac.get(signalId);
      return result ? [result] : [];
    });
  }

  wazuhEmittedFor(incidentId: string): boolean {
    return this.wazuhEmitted.has(incidentId);
  }

  incidentsForSite(siteId: SiteId): Incident[] {
    return this.listIncidents().filter((incident) => incident.siteId === siteId);
  }

  subscribe(listener: (event: OperatorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: OperatorEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function parseIncidentRow(row: Record<string, unknown>): Incident {
  return incidentSchema.parse({
    incidentId: row.incident_id,
    timestamp: isoFromClickHouse(String(row.timestamp)),
    windowStart: isoFromClickHouse(String(row.window_start)),
    siteId: row.site_id,
    classification: row.classification,
    severity: row.severity,
    confidence: Number(row.confidence),
    signalCount: Number(row.signal_count),
    signalIds: row.signal_ids,
    types: row.types,
    affectedEntities: row.affected_entities,
    summary: row.summary,
  });
}

export function parseSignalRow(row: Record<string, unknown>): Signal {
  return signalSchema.parse({
    signalId: row.signal_id,
    timestamp: isoFromClickHouse(String(row.timestamp)),
    siteId: row.site_id,
    type: row.type,
    score: Number(row.score),
    severityHint: row.severity,
    evidence: JSON.parse(String(row.evidence_json)),
    source: "deterministic",
    incidentId: row.incident_id ? row.incident_id : null,
  });
}

export function parseQvacRow(row: Record<string, unknown>): QvacResult {
  const status = String(row.status);
  const assessment = String(row.assessment ?? "");
  if (status !== "ok" || assessment.length === 0) {
    return qvacResultSchema.parse({
      signalId: row.signal_id,
      status: status === "ok" ? "invalid" : status,
    });
  }
  const confidence = String(row.confidence ?? "").trim();
  return qvacResultSchema.parse({
    signalId: row.signal_id,
    status: "ok",
    assessment: {
      assessment,
      rationale: row.rationale,
      usedEvidence: row.used_evidence,
      ...(confidence === "high" || confidence === "medium" || confidence === "low"
        ? { confidence }
        : {}),
    },
  });
}

export function parseWindowRow(row: Record<string, unknown>): SiteWindowMetrics {
  return siteWindowMetricsSchema.parse({
    bucketStart: isoFromClickHouse(String(row.bucket_start)),
    siteId: row.site_id,
    queryCount: Number(row.query_count),
    nxdomainCount: Number(row.nxdomain_count),
    nxdomainRatio: Number(row.nxdomain_ratio),
    latencyMedian: Number(row.latency_median),
    latencyP95: Number(row.latency_p95),
    uniqueDomains: Number(row.unique_domains),
    meanEntropy: Number(row.mean_entropy),
    periodicityScore: Number(row.periodicity_score),
    saturation: Number(row.saturation),
  });
}

export function allSiteIds(): SiteId[] {
  return [...siteIds];
}

export const operatorStore = new OperatorStore();

function isoFromClickHouse(value: string): string {
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }
  return new Date(`${value.replace(" ", "T")}Z`).toISOString();
}
