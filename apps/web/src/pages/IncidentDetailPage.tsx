import type { ReactNode } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import type { IncidentDetail, SystemStatus } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  formatEnumLabel,
  formatEvidenceValue,
  formatLatencyMs,
  formatPercent,
  formatTime,
  severityClass,
} from "../format.js";
import { EmptyState, ErrorBanner, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

export function IncidentDetailPage() {
  const { id } = useParams();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<IncidentDetail>(
    id ? `/api/incidents/${encodeURIComponent(id)}` : undefined,
    tick,
  );
  const system = useJson<SystemStatus>("/api/system", tick);

  return (
    <div>
      <PageHeader
        title={data?.incident.incidentId ?? "Incident"}
        description="Member evidence, optional QVAC assessment, Wazuh emit/index status, and site window context when stored locally."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <p className="text-sm text-muted">Loading local data…</p> : null}
      {data ? <IncidentBody detail={data} system={system.data} /> : null}
    </div>
  );
}

function IncidentBody({
  detail,
  system,
}: {
  detail: IncidentDetail;
  system: SystemStatus | null;
}) {
  const { incident, signals, qvac, wazuh } = detail;
  return (
    <div className="space-y-5">
      <Panel title="Incident">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-3">
          <Fact label="Site">
            <Link className="text-ink underline-offset-2 hover:underline" to={`/sites/${incident.siteId}`}>
              {incident.siteId}
            </Link>
          </Fact>
          <Fact label="Classification">{formatEnumLabel(incident.classification)}</Fact>
          <Fact label="Severity">
            <span className={severityClass(incident.severity)}>
              {formatEnumLabel(incident.severity)}
            </span>
          </Fact>
          <Fact label="Confidence">{formatPercent(incident.confidence)}</Fact>
          <Fact label="Signals">{incident.signalCount}</Fact>
          <Fact label="Window">{formatTime(incident.windowStart)}</Fact>
          <Fact label="Last signal">{formatTime(incident.timestamp)}</Fact>
          <Fact label="Types">{incident.types.map((type) => formatEnumLabel(type)).join(", ")}</Fact>
          <Fact label="Entities">
            {incident.affectedEntities.length > 0
              ? incident.affectedEntities.join(", ")
              : "None recorded on member evidence"}
          </Fact>
        </dl>
        <p className="mt-3 text-sm text-muted">{incident.summary}</p>
      </Panel>

      <Panel title="Wazuh pipeline">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Fact label="Sentinel → Wazuh log">{wazuh.emitted ? "Written" : "Not written"}</Fact>
          <Fact label="Wazuh indexer">{formatWazuhIndexed(wazuh.indexed)}</Fact>
        </dl>
        <p className="mt-2 text-sm text-muted">
          Written means this incident_id is in the local Wazuh event log or already present
          in the indexer from a previous emit. Indexer is a separate lookup of that same id.
        </p>
      </Panel>

      <Panel title="QVAC">
        {qvac.length === 0 ? (
          <p className="text-sm text-muted">
            No QVAC row is stored. Local QVAC runs only on ambiguous scores (0.60 ≤ score &lt; 0.75).
          </p>
        ) : (
          <div className="space-y-3">
            {system ? (
              <p className="text-sm text-muted">
                Local runtime {system.qvac.sdk} / {system.qvac.model}. Cloud inference:{" "}
                {String(system.cloudInference)}.
              </p>
            ) : null}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="border-b border-line py-2 font-medium">Signal</th>
                  <th className="border-b border-line py-2 font-medium">Inference</th>
                  <th className="border-b border-line py-2 font-medium">Classification</th>
                  <th className="border-b border-line py-2 font-medium">Uncertainty</th>
                  <th className="border-b border-line py-2 font-medium">Supporting evidence</th>
                  <th className="border-b border-line py-2 font-medium">Explanation</th>
                </tr>
              </thead>
              <tbody>
                {qvac.map((result) => (
                  <tr key={result.signalId}>
                    <td className="border-b border-line py-2 font-mono text-xs">{result.signalId}</td>
                    <td className="border-b border-line py-2">{formatEnumLabel(result.status)}</td>
                    <td className="border-b border-line py-2">
                      {result.assessment
                        ? formatEnumLabel(result.assessment.assessment)
                        : qvacSkipReason(result.status)}
                    </td>
                    <td className="border-b border-line py-2">
                      {qvacUncertainty(result.assessment?.assessment, result.status)}
                    </td>
                    <td className="border-b border-line py-2">
                      {result.assessment?.usedEvidence.join(", ") ?? "—"}
                    </td>
                    <td className="border-b border-line py-2 text-muted">
                      {result.assessment?.rationale ??
                        (result.status === "skipped"
                          ? "Deterministic score is outside the ambiguous band, so the local model was not invoked."
                          : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Member evidence">
        {signals.length === 0 ? (
          <EmptyState>
            No member signals are stored for this incident. Older ClickHouse rows from before signal persistence will not have evidence here.
          </EmptyState>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-line py-2 font-medium">Type</th>
                <th className="border-b border-line py-2 font-medium">Score</th>
                <th className="border-b border-line py-2 font-medium">Severity</th>
                <th className="border-b border-line py-2 font-medium">Metric</th>
                <th className="border-b border-line py-2 font-medium">Value</th>
                <th className="border-b border-line py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {signals.flatMap((signal) =>
                signal.evidence.map((item, index) => (
                  <tr key={`${signal.signalId}-${item.metric}-${index}`}>
                    <td className="border-b border-line py-2">
                      {index === 0 ? formatEnumLabel(signal.type) : ""}
                    </td>
                    <td className="border-b border-line py-2 tabular-nums">
                      {index === 0 ? formatPercent(signal.score) : ""}
                    </td>
                    <td className={`border-b border-line py-2 ${severityClass(signal.severityHint)}`}>
                      {index === 0 ? formatEnumLabel(signal.severityHint) : ""}
                    </td>
                    <td className="border-b border-line py-2 font-mono text-xs">{item.metric}</td>
                    <td className="border-b border-line py-2 tabular-nums">
                      {formatEvidenceValue(item.metric, item.value)}
                    </td>
                    <td className="border-b border-line py-2 text-muted">{item.reason}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Site window context">
        {detail.currentWindow ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-3">
            <Fact label="Bucket">{formatTime(detail.currentWindow.bucketStart)}</Fact>
            <Fact label="Queries">{detail.currentWindow.queryCount}</Fact>
            <Fact label="NXDOMAIN ratio">{formatPercent(detail.currentWindow.nxdomainRatio)}</Fact>
            <Fact label="Latency p95">{formatLatencyMs(detail.currentWindow.latencyP95)}</Fact>
            <Fact label="Saturation">{formatPercent(detail.currentWindow.saturation)}</Fact>
            <Fact label="Prior NXDOMAIN mean">
              {detail.priorNxdomainRatioMean === undefined
                ? "No prior windows"
                : formatPercent(detail.priorNxdomainRatioMean)}
            </Fact>
            <Fact label="Prior latency p95 mean">
              {detail.priorLatencyP95Mean === undefined
                ? "No prior windows"
                : formatLatencyMs(detail.priorLatencyP95Mean)}
            </Fact>
          </dl>
        ) : (
          <EmptyState>
            No site-window metrics are stored for this incident's site yet.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

function formatWazuhIndexed(state: "yes" | "no" | "unknown"): string {
  if (state === "yes") {
    return "Found";
  }
  if (state === "no") {
    return "Not found";
  }
  return "Lookup failed";
}

function qvacSkipReason(status: string): string {
  if (status === "skipped") {
    return "Not invoked";
  }
  return "—";
}

function qvacUncertainty(assessment: string | undefined, status: string): string {
  if (status === "skipped") {
    return "None — deterministic path";
  }
  if (assessment === "uncertain" || assessment === "insufficient_evidence") {
    return formatEnumLabel(assessment);
  }
  if (assessment === "consistent") {
    return "Low — evidence matches the rule";
  }
  if (status === "invalid" || status === "unavailable") {
    return formatEnumLabel(status);
  }
  return "—";
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
