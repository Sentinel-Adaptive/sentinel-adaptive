import { useOutletContext } from "react-router-dom";
import type { SystemStatus } from "@sentinel-adaptive/contracts";

import type { ShellContext } from "../AppShell.js";
import { healthClass } from "../format.js";
import { ErrorBanner, PageHeader, Panel } from "../ui.js";
import { useJson } from "../use-json.js";

export function SystemPage() {
  const { tick } = useOutletContext<ShellContext>();
  const { data, error, loading } = useJson<SystemStatus>("/api/system", tick);

  return (
    <div>
      <PageHeader
        title="System"
        description="Sovereignty and local service status. Judged inference is local QVAC only; there is no cloud inference path."
      />
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {loading && !data ? <p className="text-sm text-muted">Loading local data…</p> : null}
      {data ? (
        <div className="space-y-5">
          <Panel title="Tracks and inference">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Tracks</dt>
                <dd className="mt-0.5">{data.tracks.join(" + ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Cloud inference</dt>
                <dd className="mt-0.5">{String(data.cloudInference)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">QVAC_LOCAL_ONLY</dt>
                <dd className="mt-0.5">{String(data.qvac.localOnly)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">@qvac/sdk</dt>
                <dd className="mt-0.5 tabular-nums">{data.qvac.sdk}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">@qvac/inference</dt>
                <dd className="mt-0.5 tabular-nums">{data.qvac.inference}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Model</dt>
                <dd className="mt-0.5 font-mono text-xs">{data.qvac.model}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Local services">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="border-b border-line py-2 font-medium">Service</th>
                  <th className="border-b border-line py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.services).map(([name, state]) => (
                  <tr key={name}>
                    <td className="border-b border-line py-2 capitalize">{name}</td>
                    <td className={`border-b border-line py-2 ${healthClass(state)}`}>{state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
