import { Link, useOutletContext } from "react-router-dom";
import type { Incident } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import {
  compareIncidentSeverity,
  formatScore,
  severityClass,
} from "../format.js";
import { EmptyState, ErrorBanner, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

export function IncidentsPage() {
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<Incident[]>("/api/incidents", tick);
  const incidents = [...(data ?? [])].sort(compareIncidentSeverity);

  return (
    <div>
      <PageHeader
        title="Incidents"
        description="Correlated DNS incidents stored locally. High-severity rows sort to the top."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <p className="text-sm text-muted">Loading local data…</p> : null}
      {data && incidents.length === 0 ? (
        <EmptyState>
          No incidents are available locally. The list stays empty until the agent correlates signals into ClickHouse or the live store.
        </EmptyState>
      ) : null}
      {incidents.length > 0 ? (
        <Panel title={`${incidents.length} local incident${incidents.length === 1 ? "" : "s"}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-line py-2 font-medium">Incident</th>
                <th className="border-b border-line py-2 font-medium">Site</th>
                <th className="border-b border-line py-2 font-medium">Class</th>
                <th className="border-b border-line py-2 font-medium">Severity</th>
                <th className="border-b border-line py-2 font-medium">Confidence</th>
                <th className="border-b border-line py-2 font-medium">Signals</th>
                <th className="border-b border-line py-2 font-medium">Summary</th>
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
                  <td className="border-b border-line py-2 text-muted">{incident.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </div>
  );
}
