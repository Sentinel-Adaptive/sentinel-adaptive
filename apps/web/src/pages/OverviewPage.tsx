import { Link, useOutletContext } from "react-router-dom";
import type { OverviewResponse } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  compareIncidentSeverity,
  formatScore,
  formatTime,
  severityClass,
} from "../format.js";
import { EmptyState, ErrorBanner, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

export function OverviewPage() {
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<OverviewResponse>("/api/overview", tick);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Site windows and recent incidents from the local agent. Empty cells mean this machine has no stored data yet."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <p className="text-sm text-muted">Loading local data…</p> : null}
      {data ? (
        <div className="space-y-5">
          <Panel title="Sites">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="border-b border-line py-2 font-medium">Site</th>
                  <th className="border-b border-line py-2 font-medium">Latest QoE</th>
                  <th className="border-b border-line py-2 font-medium">Window</th>
                  <th className="border-b border-line py-2 font-medium">Incidents</th>
                </tr>
              </thead>
              <tbody>
                {data.sites.map((site) => (
                  <tr key={site.siteId}>
                    <td className="border-b border-line py-2">
                      <Link className="text-ink underline-offset-2 hover:underline" to={`/sites/${site.siteId}`}>
                        {site.siteId}
                      </Link>
                    </td>
                    <td className="border-b border-line py-2 tabular-nums">
                      {site.latestQoe === null ? "No local windows" : formatScore(site.latestQoe)}
                    </td>
                    <td className="border-b border-line py-2 text-muted">
                      {site.latestWindowStart ? formatTime(site.latestWindowStart) : "—"}
                    </td>
                    <td className="border-b border-line py-2 tabular-nums">
                      {site.incidentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Recent incidents">
            {data.recentIncidents.length === 0 ? (
              <EmptyState>
                No incidents in the local store or ClickHouse. Generate traffic and run the agent consumer to populate this view.
              </EmptyState>
            ) : (
              <IncidentTable
                incidents={[...data.recentIncidents].sort(compareIncidentSeverity)}
              />
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function IncidentTable({
  incidents,
}: {
  incidents: OverviewResponse["recentIncidents"];
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="border-b border-line py-2 font-medium">Incident</th>
          <th className="border-b border-line py-2 font-medium">Site</th>
          <th className="border-b border-line py-2 font-medium">Class</th>
          <th className="border-b border-line py-2 font-medium">Severity</th>
          <th className="border-b border-line py-2 font-medium">Confidence</th>
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
            <td className="border-b border-line py-2">
              <Link className="text-ink underline-offset-2 hover:underline" to={`/sites/${incident.siteId}`}>
                {incident.siteId}
              </Link>
            </td>
            <td className="border-b border-line py-2">{incident.classification}</td>
            <td className={`border-b border-line py-2 ${severityClass(incident.severity)}`}>
              {incident.severity}
            </td>
            <td className="border-b border-line py-2 tabular-nums">
              {formatScore(incident.confidence)}
            </td>
            <td className="border-b border-line py-2 tabular-nums">
              {incident.signalCount}
            </td>
            <td className="border-b border-line py-2 text-muted">{formatTime(incident.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
