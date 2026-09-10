import { Link, useOutletContext, useParams } from "react-router-dom";
import type { SiteDetail } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  compareIncidentSeverity,
  formatEnumLabel,
  formatLatencyMs,
  formatPercent,
  formatTime,
  severityClass,
} from "../format.js";
import { EmptyState, ErrorBanner, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

export function SiteDetailPage() {
  const { siteId } = useParams();
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<SiteDetail>(
    siteId ? `/api/sites/${encodeURIComponent(siteId)}` : undefined,
    tick,
  );
  const incidents = [...(data?.incidents ?? [])].sort(compareIncidentSeverity);

  return (
    <div>
      <PageHeader
        title={data?.siteId ?? siteId ?? "Site"}
        description="Per-site windows, QoE versus this site's own prior windows, and incidents stored locally."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <p className="text-sm text-muted">Loading local data…</p> : null}
      {data ? (
        <div className="space-y-5">
          <Panel title="QoE">
            {data.qoe ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Score</dt>
                  <dd className="mt-0.5 tabular-nums">{formatPercent(data.qoe.score)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Availability</dt>
                  <dd className="mt-0.5 tabular-nums">
                    {formatPercent(data.qoe.availability)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Latency factor</dt>
                  <dd className="mt-0.5 tabular-nums">
                    {data.qoe.latencyFactor.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Capacity</dt>
                  <dd className="mt-0.5 tabular-nums">{formatPercent(data.qoe.capacity)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Weights</dt>
                  <dd className="mt-0.5 tabular-nums">
                    {data.qoe.weights.availability} / {data.qoe.weights.latency} / {data.qoe.weights.capacity}
                  </dd>
                </div>
                {data.priorWindows ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Prior samples</dt>
                    <dd className="mt-0.5 tabular-nums">{data.priorWindows.samples}</dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Baseline</dt>
                    <dd className="mt-0.5 text-muted">No prior windows on this site</dd>
                  </div>
                )}
              </dl>
            ) : (
              <EmptyState>
                No local windows for this site, so QoE cannot be computed yet.
              </EmptyState>
            )}
            {data.qoe ? <p className="mt-3 text-sm text-muted">{data.qoe.explanation}</p> : null}
          </Panel>

          <Panel title="Windows">
            {data.windows.length === 0 ? (
              <EmptyState>No site_metrics rows are stored locally for this site.</EmptyState>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="border-b border-line py-2 font-medium">Bucket</th>
                    <th className="border-b border-line py-2 font-medium">Queries</th>
                    <th className="border-b border-line py-2 font-medium">NXDOMAIN</th>
                    <th className="border-b border-line py-2 font-medium">Latency p95</th>
                    <th className="border-b border-line py-2 font-medium">Saturation</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.windows].reverse().map((window) => (
                    <tr key={window.bucketStart}>
                      <td className="border-b border-line py-2 text-muted">{formatTime(window.bucketStart)}</td>
                      <td className="border-b border-line py-2 tabular-nums">
                        {window.queryCount}
                      </td>
                      <td className="border-b border-line py-2 tabular-nums">
                        {formatPercent(window.nxdomainRatio)}
                      </td>
                      <td className="border-b border-line py-2 tabular-nums">
                        {formatLatencyMs(window.latencyP95)}
                      </td>
                      <td className="border-b border-line py-2 tabular-nums">
                        {formatPercent(window.saturation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Incidents">
            {incidents.length === 0 ? (
              <EmptyState>No incidents are stored locally for this site.</EmptyState>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="border-b border-line py-2 font-medium">Incident</th>
                    <th className="border-b border-line py-2 font-medium">Class</th>
                    <th className="border-b border-line py-2 font-medium">Severity</th>
                    <th className="border-b border-line py-2 font-medium">Signals</th>
                    <th className="border-b border-line py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident.incidentId}>
                      <td className="border-b border-line py-2 font-mono text-xs">
                        <Link
                          className="text-ink underline-offset-2 hover:underline"
                          to={`/incidents/${incident.incidentId}`}
                        >
                          {incident.incidentId}
                        </Link>
                      </td>
                      <td className="border-b border-line py-2">{formatEnumLabel(incident.classification)}</td>
                      <td className={`border-b border-line py-2 ${severityClass(incident.severity)}`}>
                        {formatEnumLabel(incident.severity)}
                      </td>
                      <td className="border-b border-line py-2 tabular-nums">
                        {incident.signalCount}
                      </td>
                      <td className="border-b border-line py-2 text-muted">{formatTime(incident.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
